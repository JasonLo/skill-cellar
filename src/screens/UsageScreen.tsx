import { useEffect, useState } from 'react'
import type { UsageView } from '../api/bindings'
import { api, inTauri } from '../api/client'

export function UsageScreen() {
  const [usage, setUsage] = useState<UsageView | null>(null)
  const [error, setError] = useState<string | null>(() =>
    inTauri() ? null : 'Run inside the desktop app to see skill usage.',
  )

  useEffect(() => {
    if (!inTauri()) return
    let cancelled = false
    api
      .getUsage()
      .then((u) => {
        if (cancelled) return
        setUsage(u)
        setError(null)
      })
      .catch(
        (e) =>
          !cancelled &&
          setError(
            typeof e === 'string' ? e : (e?.message ?? 'Failed to load usage'),
          ),
      )
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <div className="screen empty">{error}</div>
  if (!usage) return <div className="screen empty">Reading transcripts…</div>

  const unused = usage.installed.filter((s) => s.total === 0)

  if (usage.projects.length === 0 && usage.installed.length === 0)
    return (
      <div className="screen empty">
        No skill invocations found in your local transcripts yet.
      </div>
    )

  return (
    <div className="screen">
      {usage.installed.length > 0 && (
        <section>
          <h2 className="shelf-title">
            Installed skills ({usage.installed.length})
            {unused.length > 0 && (
              <span className="target-label">{unused.length} unused</span>
            )}
          </h2>
          <ul className="rows">
            {usage.installed.map((s) => (
              <li className="row" key={s.skill}>
                <div className="row-main">
                  <span className="row-name">{s.skill}</span>
                  {s.total === 0 && (
                    <span className="row-desc">
                      never invoked — candidate for pruning
                    </span>
                  )}
                </div>
                <span
                  className={`badge ${s.total === 0 ? 'badge-warnings' : 'badge-valid'}`}
                >
                  {s.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {usage.projects.map((p) => (
        <section key={p.project}>
          <h2 className="shelf-title">
            {p.project}
            <span className="target-label">{p.total} total</span>
          </h2>
          <ul className="rows">
            {p.skills.map((s) => (
              <li className="row" key={s.skill}>
                <div className="row-main">
                  <span className="row-name">{s.skill}</span>
                </div>
                <span className="badge badge-valid">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
