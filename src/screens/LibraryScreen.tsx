import { open } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useState } from 'react'
import type { SkillDescriptor } from '../api/bindings'
import { api, inTauri } from '../api/client'
import { InstalledRow } from '../components/InstalledRow'
import { useApp } from '../state/AppContext'

export function LibraryScreen() {
  const { activeTarget, setEditing, setTab } = useApp()
  const [skills, setSkills] = useState<SkillDescriptor[] | null>(null)
  const [error, setError] = useState<string | null>(() =>
    inTauri() ? null : 'Run inside the desktop app to list installed skills.',
  )
  const [installing, setInstalling] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!inTauri()) return
    let cancelled = false
    api
      .listSkills(activeTarget)
      .then((s) => {
        if (cancelled) return
        setSkills(s)
        setError(null)
      })
      .catch(
        (e) =>
          !cancelled &&
          setError(
            typeof e === 'string' ? e : (e?.message ?? 'Failed to list skills'),
          ),
      )
    return () => {
      cancelled = true
    }
  }, [activeTarget])

  useEffect(() => load(), [load])

  // Pick a local skill directory and install it into the active target. This is
  // the working install path (validate → atomic copy), exercised end-to-end:
  // the native folder picker feeds `install_local_skill`, which wraps the tested
  // core engine. GitHub-fetch shop install is the follow-on.
  const installFromFolder = useCallback(async () => {
    if (!inTauri() || installing) return
    setNotice(null)
    const picked = await open({
      directory: true,
      multiple: false,
      title: 'Choose a skill folder',
    })
    if (typeof picked !== 'string') return // cancelled
    setInstalling(true)
    try {
      const desc = await api.installLocalSkill(picked, activeTarget)
      setNotice(`Installed “${desc.name}” (${desc.conformance.verdict}).`)
      load()
    } catch (e) {
      const err = e as {
        message?: string
        conformance?: { findings?: { message: string }[] }
      }
      const detail = err?.conformance?.findings?.[0]?.message
      setNotice(`Install failed: ${detail ?? err?.message ?? String(e)}`)
    } finally {
      setInstalling(false)
    }
  }, [activeTarget, installing, load])

  if (error) return <div className="screen empty">{error}</div>
  if (!skills)
    return <div className="screen empty">Loading installed skills…</div>

  return (
    <div className="screen">
      <h2 className="shelf-title">
        Installed ({skills.length})
        <span className="target-label">
          {activeTarget.kind === 'global' ? 'global' : activeTarget.path}
        </span>
        <button
          type="button"
          className="btn"
          onClick={installFromFolder}
          disabled={installing}
        >
          {installing ? 'Installing…' : 'Install from folder…'}
        </button>
      </h2>

      {notice && <div className="banner">{notice}</div>}

      {skills.length === 0 ? (
        <div className="empty">No skills installed in this target yet.</div>
      ) : (
        <ul className="rows">
          {skills.map((s) => (
            <InstalledRow
              key={s.path}
              skill={s}
              onEdit={() => {
                setEditing({ target: activeTarget, dirName: s.dir_name })
                setTab('craft')
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
