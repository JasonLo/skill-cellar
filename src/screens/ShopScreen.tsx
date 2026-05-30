import { useCallback, useEffect, useState } from 'react'
import type { RegistryEntry, RegistryResult } from '../api/bindings'
import { api, inTauri } from '../api/client'
import { SkillCard } from '../components/SkillCard'
import { useApp } from '../state/AppContext'

const SOURCE_NOTE: Record<RegistryResult['source'], string | null> = {
  network: null,
  cache: 'Offline — showing the cached registry.',
  bundled: 'Offline — showing the bundled starter registry.',
}

/** Stable key for a registry entry (matches the card `key`). */
const entryKey = (e: RegistryEntry) => `${e.repo}/${e.name}`

export function ShopScreen() {
  const { activeTarget } = useApp()
  const [result, setResult] = useState<RegistryResult | null>(null)
  const [error, setError] = useState<string | null>(() =>
    inTauri() ? null : 'Run inside the desktop app to load the registry.',
  )
  // The entry currently installing (by key), so only its button shows busy.
  const [installingKey, setInstallingKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!inTauri()) return
    let cancelled = false
    api
      .getRegistry()
      .then((r) => !cancelled && setResult(r))
      .catch(
        (e) =>
          !cancelled &&
          setError(
            typeof e === 'string'
              ? e
              : (e?.message ?? 'Failed to load registry'),
          ),
      )
    return () => {
      cancelled = true
    }
  }, [])

  // Install a shop entry into the active target: fetch from GitHub → validate →
  // atomic copy, all in the Rust core. The verdict shows against the skill in
  // the Library once installed.
  const install = useCallback(
    async (entry: RegistryEntry) => {
      if (!inTauri() || installingKey) return
      setNotice(null)
      setInstallingKey(entryKey(entry))
      try {
        const desc = await api.installRegistrySkill(entry, activeTarget)
        setNotice(`Installed “${desc.name}” (${desc.conformance.verdict}).`)
      } catch (e) {
        const err = e as {
          message?: string
          conformance?: { findings?: { message: string }[] }
        }
        const detail = err?.conformance?.findings?.[0]?.message
        setNotice(`Install failed: ${detail ?? err?.message ?? String(e)}`)
      } finally {
        setInstallingKey(null)
      }
    },
    [activeTarget, installingKey],
  )

  if (error) return <div className="screen empty">{error}</div>
  if (!result) return <div className="screen empty">Loading the shop…</div>

  const note = SOURCE_NOTE[result.source]
  const featured = result.manifest.entries.filter((e) => e.featured)
  const rest = result.manifest.entries.filter((e) => !e.featured)

  const renderCard = (e: RegistryEntry) => (
    <SkillCard
      key={entryKey(e)}
      entry={e}
      onInstall={inTauri() ? install : undefined}
      busy={installingKey === entryKey(e)}
      disabledReason="Run inside the desktop app to install."
    />
  )

  return (
    <div className="screen">
      {note && <div className="banner banner-offline">{note}</div>}
      {notice && <div className="banner">{notice}</div>}

      <h2 className="shelf-title">Featured</h2>
      <div className="grid">{featured.map(renderCard)}</div>

      {rest.length > 0 && (
        <>
          <h2 className="shelf-title">More skills</h2>
          <div className="grid">{rest.map(renderCard)}</div>
        </>
      )}
    </div>
  )
}
