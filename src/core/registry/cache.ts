import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RegistryUnavailableError } from '../errors'
import { parseCatalog } from './parse'
import type { RegistryManifest } from './types'

const CACHE_FILE = 'registry-cache.json'

const here = dirname(fileURLToPath(import.meta.url))
let bundledText: string | undefined

function loadBundledText(): string {
  if (bundledText === undefined) {
    bundledText = readFileSync(join(here, 'default_registry.json'), 'utf-8')
  }
  return bundledText
}

export interface CachedCatalog {
  fetchedAtUnix: number
  manifest: RegistryManifest
}

interface RawCached {
  fetched_at_unix: number
  manifest: RegistryManifest | object
}

function cachePath(appDataDir: string): string {
  return join(appDataDir, CACHE_FILE)
}

export function readCache(appDataDir: string): CachedCatalog | null {
  let text: string
  try {
    text = readFileSync(cachePath(appDataDir), 'utf-8')
  } catch {
    return null
  }
  let raw: RawCached
  try {
    raw = JSON.parse(text) as RawCached
  } catch {
    return null
  }
  // Manifest in the cache is stored already-normalized.
  const m = raw.manifest as Partial<RegistryManifest>
  if (
    !m ||
    typeof m.schemaVersion !== 'number' ||
    typeof m.generatedAt !== 'string' ||
    !Array.isArray(m.entries)
  ) {
    return null
  }
  return {
    fetchedAtUnix: raw.fetched_at_unix,
    manifest: m as RegistryManifest,
  }
}

export function writeCache(
  appDataDir: string,
  manifest: RegistryManifest,
  fetchedAtUnix: number,
): void {
  mkdirSync(appDataDir, { recursive: true })
  const body: RawCached = {
    fetched_at_unix: fetchedAtUnix,
    manifest,
  }
  writeFileSync(cachePath(appDataDir), JSON.stringify(body, null, 2))
}

export function bundledSnapshot(): RegistryManifest {
  try {
    return parseCatalog(loadBundledText())
  } catch {
    throw new RegistryUnavailableError()
  }
}
