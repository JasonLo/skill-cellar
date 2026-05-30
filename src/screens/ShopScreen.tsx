import { useEffect, useState } from 'react'
import { api, inTauri } from '../api/client'
import type { RegistryResult } from '../api/bindings'
import { SkillCard } from '../components/SkillCard'

const SOURCE_NOTE: Record<RegistryResult['source'], string | null> = {
  network: null,
  cache: 'Offline — showing the cached registry.',
  bundled: 'Offline — showing the bundled starter registry.',
}

export function ShopScreen() {
  const [result, setResult] = useState<RegistryResult | null>(null)
  const [error, setError] = useState<string | null>(() =>
    inTauri() ? null : 'Run inside the desktop app to load the registry.',
  )

  useEffect(() => {
    if (!inTauri()) return
    let cancelled = false
    api
      .getRegistry()
      .then((r) => !cancelled && setResult(r))
      .catch(
        (e) =>
          !cancelled &&
          setError(typeof e === 'string' ? e : (e?.message ?? 'Failed to load registry')),
      )
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <div className="screen empty">{error}</div>
  if (!result) return <div className="screen empty">Loading the shop…</div>

  const note = SOURCE_NOTE[result.source]
  const featured = result.manifest.entries.filter((e) => e.featured)
  const rest = result.manifest.entries.filter((e) => !e.featured)

  return (
    <div className="screen">
      {note && <div className="banner banner-offline">{note}</div>}

      <h2 className="shelf-title">Featured</h2>
      <div className="grid">
        {featured.map((e) => (
          <SkillCard key={`${e.repo}/${e.name}`} entry={e} />
        ))}
      </div>

      {rest.length > 0 && (
        <>
          <h2 className="shelf-title">More skills</h2>
          <div className="grid">
            {rest.map((e) => (
              <SkillCard key={`${e.repo}/${e.name}`} entry={e} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
