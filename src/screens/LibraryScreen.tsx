import { useEffect, useState } from 'react'
import { api, inTauri } from '../api/client'
import type { SkillDescriptor } from '../api/bindings'
import { useApp } from '../state/AppContext'
import { InstalledRow } from '../components/InstalledRow'

export function LibraryScreen() {
  const { activeTarget } = useApp()
  const [skills, setSkills] = useState<SkillDescriptor[] | null>(null)
  const [error, setError] = useState<string | null>(() =>
    inTauri() ? null : 'Run inside the desktop app to list installed skills.',
  )

  useEffect(() => {
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
          setError(typeof e === 'string' ? e : (e?.message ?? 'Failed to list skills')),
      )
    return () => {
      cancelled = true
    }
  }, [activeTarget])

  if (error) return <div className="screen empty">{error}</div>
  if (!skills) return <div className="screen empty">Loading installed skills…</div>
  if (skills.length === 0)
    return (
      <div className="screen empty">
        No skills installed in this target yet.
      </div>
    )

  return (
    <div className="screen">
      <h2 className="shelf-title">
        Installed ({skills.length})
        <span className="target-label">
          {activeTarget.kind === 'global' ? 'global' : activeTarget.path}
        </span>
      </h2>
      <ul className="rows">
        {skills.map((s) => (
          <InstalledRow key={s.path} skill={s} />
        ))}
      </ul>
    </div>
  )
}
