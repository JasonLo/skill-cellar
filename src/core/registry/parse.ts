import { NetworkError } from '../errors'
import type { RegistryEntry, RegistryManifest } from './types'

interface RawEnvelope {
  schema_version: unknown
  generated_at: unknown
  entries: unknown
}

export function parseCatalog(json: string): RegistryManifest {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch (e) {
    throw new NetworkError(
      `malformed catalog document: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
  if (raw === null || typeof raw !== 'object') {
    throw new NetworkError('malformed catalog document: not an object')
  }
  const env = raw as RawEnvelope
  if (typeof env.schema_version !== 'number')
    throw new NetworkError('malformed catalog document: schema_version')
  if (typeof env.generated_at !== 'string')
    throw new NetworkError('malformed catalog document: generated_at')
  if (!Array.isArray(env.entries))
    throw new NetworkError('malformed catalog document: entries')

  const entries: RegistryEntry[] = []
  for (const item of env.entries) {
    const valid = validEntry(item)
    if (valid !== null) entries.push(valid)
  }
  return {
    schemaVersion: env.schema_version,
    generatedAt: env.generated_at,
    entries,
  }
}

function validEntry(value: unknown): RegistryEntry | null {
  if (value === null || typeof value !== 'object') return null
  const v = value as Record<string, unknown>

  if (typeof v.name !== 'string') return null
  if (typeof v.description !== 'string') return null
  if (typeof v.repo !== 'string') return null
  if (typeof v.featured !== 'boolean') return null

  const name = v.name
  const description = v.description
  if (name.trim() === '' || description.trim() === '') return null

  const repo = v.repo.trim()
  const parts = repo.split('/')
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') return null

  const subdir =
    v.subdir === undefined || v.subdir === null
      ? null
      : typeof v.subdir === 'string'
        ? v.subdir
        : null
  const gitRef =
    v.git_ref === undefined || v.git_ref === null
      ? null
      : typeof v.git_ref === 'string'
        ? v.git_ref
        : null

  return {
    name,
    description,
    repo,
    subdir,
    gitRef,
    featured: v.featured,
  }
}
