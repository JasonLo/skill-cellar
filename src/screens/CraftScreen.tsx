import { useEffect, useMemo, useRef, useState } from 'react'
import type { Conformance } from '../api/bindings'
import { api, inTauri } from '../api/client'
import { ConformanceBadge } from '../components/ConformanceBadge'
import {
  assembleSkillMd,
  EMPTY_FIELDS,
  parseSkillMd,
  type SkillFields,
} from '../craft/skillmd'
import { useApp } from '../state/AppContext'

// Debounce for live validation: long enough to coalesce keystrokes, short
// enough to feel immediate.
const VALIDATE_DEBOUNCE_MS = 250

export function CraftScreen() {
  const { activeTarget, editing, setEditing } = useApp()
  const [fields, setFields] = useState<SkillFields>({ ...EMPTY_FIELDS })
  const [body, setBody] = useState('')
  const [conformance, setConformance] = useState<Conformance | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load an existing skill into the form when arriving from "Edit in Craft".
  useEffect(() => {
    if (!editing || !inTauri()) return
    let cancelled = false
    api
      .readSkill(editing.target, editing.dirName)
      .then((text) => {
        if (cancelled) return
        const parsed = parseSkillMd(text)
        setFields(parsed.fields)
        setBody(parsed.body)
        setLoadError(null)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [editing])

  const assembled = useMemo(() => assembleSkillMd(fields, body), [fields, body])

  // Live conformance: re-validate (debounced) on every edit through the same
  // backend gate the install path uses — the UI never re-implements any rule.
  const seq = useRef(0)
  useEffect(() => {
    const ticket = ++seq.current
    const handle = setTimeout(() => {
      api
        .checkConformance(assembled, fields.name)
        .then((c) => {
          // Ignore results that a newer edit has superseded.
          if (ticket === seq.current) setConformance(c)
        })
        .catch(() => {})
    }, VALIDATE_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [assembled, fields.name])

  const setField = (key: keyof SkillFields) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }))

  const findingsFor = (field: string) =>
    conformance?.findings.filter((f) => f.field === field) ?? []

  // Findings whose field has no dedicated input (e.g. `frontmatter`, `metadata`)
  // still need to be shown so the gate's reason is never hidden.
  const FORM_FIELDS = ['name', 'description', 'license', 'compatibility']
  const otherFindings =
    conformance?.findings.filter((f) => !FORM_FIELDS.includes(f.field)) ?? []

  // The gate (mirrors `is_installable`): block on Invalid, allow Valid/Warnings.
  // No conformance yet → not publishable.
  const blocked = !conformance || conformance.verdict === 'invalid'

  const publish = async () => {
    if (publishing) return
    if (!inTauri()) {
      setPublishError('Run inside the desktop app to publish a skill.')
      return
    }
    setPublishing(true)
    setPublishError(null)
    setNotice(null)
    try {
      const desc = await api.publishSkill(activeTarget, fields.name, assembled)
      setNotice(`Published “${desc.name}” to ${targetLabel()}.`)
      // Re-publishing is now an edit of what we just wrote.
      setEditing({ target: activeTarget, dirName: desc.dir_name })
    } catch (e) {
      // Defense in depth: surface the backend's re-validation findings inline.
      const conf = (e as { conformance?: Conformance })?.conformance
      if (conf) setConformance(conf)
      setPublishError(errorMessage(e))
    } finally {
      setPublishing(false)
    }
  }

  const targetLabel = () =>
    activeTarget.kind === 'global' ? 'global' : activeTarget.path

  return (
    <div className="screen">
      <h2 className="shelf-title">
        {editing ? 'Edit skill' : 'Craft a new skill'}
        <span className="target-label">{targetLabel()}</span>
        {conformance && <ConformanceBadge conformance={conformance} />}
      </h2>

      {loadError && (
        <div className="banner">Could not load skill: {loadError}</div>
      )}
      {notice && <div className="banner">{notice}</div>}

      <div className="craft-form">
        <Field
          id="craft-name"
          label="name"
          hint="lowercase letters, digits, single hyphens — also the folder name"
          value={fields.name}
          onChange={setField('name')}
          findings={findingsFor('name')}
        />
        <Field
          id="craft-description"
          label="description"
          hint="one line, ≤ 1024 characters"
          value={fields.description}
          onChange={setField('description')}
          findings={findingsFor('description')}
          textarea
        />
        <Field
          id="craft-license"
          label="license"
          hint="optional, e.g. MIT"
          value={fields.license}
          onChange={setField('license')}
          findings={findingsFor('license')}
        />
        <Field
          id="craft-compatibility"
          label="compatibility"
          hint="optional"
          value={fields.compatibility}
          onChange={setField('compatibility')}
          findings={findingsFor('compatibility')}
        />

        <label className="craft-field" htmlFor="craft-body">
          <span className="craft-label">body</span>
          <textarea
            id="craft-body"
            className="craft-input craft-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="# Skill instructions…"
          />
        </label>

        {otherFindings.map((f) => (
          <p
            key={f.code}
            className={
              f.severity === 'error'
                ? 'craft-finding-error'
                : 'craft-finding-warn'
            }
          >
            {f.message}
          </p>
        ))}

        {publishError && <p className="craft-finding-error">{publishError}</p>}

        <div className="craft-actions">
          <button
            type="button"
            className="btn"
            onClick={publish}
            disabled={publishing || blocked}
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
          {blocked && conformance && (
            <span className="craft-blocked-note">
              Fix the errors above to publish.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  findings,
  textarea = false,
}: {
  id: string
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  findings: Conformance['findings']
  textarea?: boolean
}) {
  return (
    <label className="craft-field" htmlFor={id}>
      <span className="craft-label">
        {label}
        <span className="craft-hint">{hint}</span>
      </span>
      {textarea ? (
        <textarea
          id={id}
          className="craft-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="craft-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {findings.map((f) => (
        <span
          key={f.code}
          className={
            f.severity === 'error'
              ? 'craft-finding-error'
              : 'craft-finding-warn'
          }
        >
          {f.message}
        </span>
      ))}
    </label>
  )
}

function errorMessage(e: unknown): string {
  if (typeof e === 'string') return e
  const msg = (e as { message?: string })?.message
  return msg ?? String(e)
}
