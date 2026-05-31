export interface RegistryEntry {
  name: string
  description: string
  /** `owner/name` of the hosting repo. */
  repo: string
  /** Path to the skill directory within the repo, if not the repo root. */
  subdir: string | null
  /** Tag/branch/sha; the repo's default branch when null. */
  gitRef: string | null
  featured: boolean
}

export interface RegistryManifest {
  schemaVersion: number
  generatedAt: string
  entries: RegistryEntry[]
}

export type RegistrySource = 'network' | 'cache' | 'bundled'

export interface RegistryResult {
  manifest: RegistryManifest
  source: RegistrySource
}
