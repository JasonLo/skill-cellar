import { NetworkError } from '../errors'
import { bundledSnapshot, readCache, writeCache } from './cache'
import type { RegistryFetcher } from './fetcher'
import { parseCatalog } from './parse'
import type { RegistryManifest, RegistryResult } from './types'

export type { RegistryFetcher } from './fetcher'
export { parseCatalog } from './parse'
export type {
  RegistryEntry,
  RegistryManifest,
  RegistryResult,
  RegistrySource,
} from './types'

/** Default staleness threshold: 24 hours in seconds. */
export const DEFAULT_STALENESS_SECONDS = 24 * 60 * 60

export function getRegistry(
  fetcher: RegistryFetcher,
  appDataDir: string,
): RegistryResult {
  return resolveCatalog(
    fetcher,
    appDataDir,
    Math.floor(Date.now() / 1000),
    DEFAULT_STALENESS_SECONDS,
  )
}

export function resolveCatalog(
  fetcher: RegistryFetcher,
  appDataDir: string,
  nowUnix: number,
  maxAgeSeconds: number,
): RegistryResult {
  const cached = readCache(appDataDir)

  if (
    cached !== null &&
    !isStale(cached.fetchedAtUnix, nowUnix, maxAgeSeconds)
  ) {
    return { manifest: cached.manifest, source: 'cache' }
  }

  try {
    const manifest = fetchAndParse(fetcher)
    try {
      writeCache(appDataDir, manifest, nowUnix)
    } catch {
      // best-effort
    }
    return { manifest, source: 'network' }
  } catch {
    if (cached !== null) {
      return { manifest: cached.manifest, source: 'cache' }
    }
    return { manifest: bundledSnapshot(), source: 'bundled' }
  }
}

function fetchAndParse(fetcher: RegistryFetcher): RegistryManifest {
  const text = fetcher.fetchCatalog()
  const manifest = parseCatalog(text)
  if (manifest.entries.length === 0) {
    throw new NetworkError('catalog fetched but contained no valid entries')
  }
  return manifest
}

function isStale(
  fetchedAtUnix: number,
  nowUnix: number,
  maxAgeSeconds: number,
): boolean {
  const age = Math.max(0, nowUnix - fetchedAtUnix)
  return age > maxAgeSeconds
}
