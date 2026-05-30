// Type bindings mirroring the Rust IPC DTOs in `skill-cellar-core`.
//
// BOOTSTRAP: this file is hand-written so the frontend type-checks before the
// Tauri shell can be built. On the first `bun run tauri dev`/`build`,
// tauri-specta regenerates it from the actual `#[tauri::command]` signatures
// (the single source of truth) and overwrites this content. Keep it in sync by
// regenerating rather than editing by hand once the shell builds.

export type Verdict = 'valid' | 'warnings' | 'invalid'
export type Severity = 'error' | 'warning'

export interface Finding {
  field: string
  severity: Severity
  code: string
  message: string
}

export interface Conformance {
  verdict: Verdict
  findings: Finding[]
}

export interface SkillDescriptor {
  name: string
  dir_name: string
  path: string
  description: string | null
  conformance: Conformance
}

export interface RegistryEntry {
  name: string
  description: string
  repo: string
  subdir: string | null
  git_ref: string | null
  featured: boolean
}

export interface RegistryManifest {
  schema_version: number
  generated_at: string
  entries: RegistryEntry[]
}

export type RegistrySource = 'network' | 'cache' | 'bundled'

export interface RegistryResult {
  manifest: RegistryManifest
  source: RegistrySource
}

// `TargetKind` uses serde `tag = "kind", content = "path"`.
export type TargetKind =
  | { kind: 'project'; path: string }
  | { kind: 'global' }

export interface CommandError {
  kind: string
  message: string
  conformance: Conformance | null
}

// --- Usage analytics (I-2) ---

export interface SkillCount {
  skill: string
  count: number
}

export interface ProjectUsage {
  project: string
  total: number
  skills: SkillCount[]
}

export interface ProjectUsageReport {
  projects: ProjectUsage[]
}

// An installed skill alongside its total invocations; `total === 0` means
// installed but never used.
export interface InstalledUsage {
  skill: string
  total: number
}

export interface UsageView {
  projects: ProjectUsage[]
  installed: InstalledUsage[]
}
