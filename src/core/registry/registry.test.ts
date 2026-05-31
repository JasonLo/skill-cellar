import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NetworkError } from '../errors'
import { DEFAULT_STALENESS_SECONDS, getRegistry, resolveCatalog } from './index'
import type { RegistryFetcher } from './fetcher'

function sampleJson(marker: string): string {
  return JSON.stringify({
    schema_version: 1,
    generated_at: '2026-05-29T12:00:00Z',
    entries: [
      {
        name: marker,
        description: 'fetched live',
        repo: 'agentskills/examples',
        subdir: null,
        git_ref: null,
        featured: true,
      },
    ],
  })
}

class GistFetcher implements RegistryFetcher {
  constructor(private readonly body: string) {}
  fetchCatalog(): string {
    return this.body
  }
}

class OfflineFetcher implements RegistryFetcher {
  fetchCatalog(): string {
    throw new NetworkError('simulated offline')
  }
}

describe('registry catalog resolution', () => {
  const created: string[] = []
  beforeEach(() => {
    created.length = 0
  })
  afterEach(() => {
    for (const p of created) rmSync(p, { recursive: true, force: true })
  })
  function newTmp(prefix: string): string {
    const p = mkdtempSync(join(tmpdir(), prefix))
    created.push(p)
    return p
  }

  // I-5 outcome 1: opening the Shop loads the catalog from the gist and
  // persists it for offline reuse.
  it('catalog_loads_from_gist_and_caches', () => {
    const dir = newTmp('sc-reg-')
    const gist = new GistFetcher(sampleJson('from-gist'))

    const live = getRegistry(gist, dir)
    expect(live.source).toBe('network')
    expect(live.manifest.entries[0].name).toBe('from-gist')
    expect(existsSync(join(dir, 'registry-cache.json'))).toBe(true)

    const reused = getRegistry(new OfflineFetcher(), dir)
    expect(reused.source).toBe('cache')
    expect(reused.manifest).toEqual(live.manifest)
  })

  // I-5 outcome 2: a malformed entry is skipped; valid ones survive.
  it('catalog_skips_invalid_entries', () => {
    const dir = newTmp('sc-reg-')
    const json = JSON.stringify({
      schema_version: 1,
      generated_at: '2026-05-29T12:00:00Z',
      entries: [
        {
          name: 'valid-one',
          description: 'ok',
          repo: 'acme/one',
          featured: true,
        },
        // missing repo
        { name: 'broken', description: 'no repo', featured: false },
        {
          name: 'valid-two',
          description: 'ok',
          repo: 'acme/two',
          featured: false,
        },
      ],
    })

    const res = getRegistry(new GistFetcher(json), dir)
    expect(res.source).toBe('network')
    expect(res.manifest.entries.map((e) => e.name)).toEqual([
      'valid-one',
      'valid-two',
    ])
  })

  // I-5 outcome 3: staleness-gated refresh.
  it('catalog_refreshes_when_stale', () => {
    const dir = newTmp('sc-reg-')
    const t0 = 1_000_000
    const primed = resolveCatalog(
      new GistFetcher(sampleJson('v1')),
      dir,
      t0,
      DEFAULT_STALENESS_SECONDS,
    )
    expect(primed.source).toBe('network')

    const fresh = resolveCatalog(
      new GistFetcher(sampleJson('v2')),
      dir,
      t0 + 3_600,
      DEFAULT_STALENESS_SECONDS,
    )
    expect(fresh.source).toBe('cache')
    expect(fresh.manifest.entries[0].name).toBe('v1')

    const refreshed = resolveCatalog(
      new GistFetcher(sampleJson('v2')),
      dir,
      t0 + 25 * 3_600,
      DEFAULT_STALENESS_SECONDS,
    )
    expect(refreshed.source).toBe('network')
    expect(refreshed.manifest.entries[0].name).toBe('v2')

    const offline = resolveCatalog(
      new OfflineFetcher(),
      dir,
      t0 + 50 * 3_600,
      DEFAULT_STALENESS_SECONDS,
    )
    expect(offline.source).toBe('cache')
    expect(offline.manifest.entries[0].name).toBe('v2')
  })

  // I-1 outcome 4: offline fallback chain.
  it('registry_falls_back_to_cache_when_offline', () => {
    const dir = newTmp('sc-reg-')

    const online = getRegistry(
      new GistFetcher(sampleJson('from-network')),
      dir,
    )
    expect(online.source).toBe('network')

    const cached = getRegistry(new OfflineFetcher(), dir)
    expect(cached.source).toBe('cache')
    expect(cached.manifest).toEqual(online.manifest)

    const cold = newTmp('sc-reg-cold-')
    const bundled = getRegistry(new OfflineFetcher(), cold)
    expect(bundled.source).toBe('bundled')
    expect(bundled.manifest.entries.length).toBeGreaterThan(0)
  })

  it('all-invalid catalog does not poison cache', () => {
    const dir = newTmp('sc-reg-')
    const t0 = 1_000_000
    const primed = resolveCatalog(
      new GistFetcher(sampleJson('good')),
      dir,
      t0,
      DEFAULT_STALENESS_SECONDS,
    )
    expect(primed.source).toBe('network')

    const allBad = JSON.stringify({
      schema_version: 1,
      generated_at: '2026-05-30T00:00:00Z',
      entries: [{ name: 'broken', description: 'no repo', featured: false }],
    })
    const res = resolveCatalog(
      new GistFetcher(allBad),
      dir,
      t0 + 25 * 3_600,
      DEFAULT_STALENESS_SECONDS,
    )
    expect(res.source).toBe('cache')
    expect(res.manifest.entries[0].name).toBe('good')
  })
})
