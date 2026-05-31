import type { UsageReport } from '../usage'

/**
 * Cross-device sync boundary (I-4).
 *
 * The single seam through which the app may ever transmit data off the device.
 * Two non-negotiable guarantees, enforced here so the constitution's P-7/P-8
 * promises are concrete:
 *
 * - Off by default (P-7): a default-constructed `SyncBoundary` is disabled, so
 *   `syncOnce` is a no-op until the user explicitly enables it.
 * - Metadata-only (P-8): when enabled, the payload built from a `UsageReport`
 *   carries only skill names, invocation counts, timestamps, and version tags.
 *   Transcript content, prompts, file contents, and file paths are never
 *   included.
 *
 * The transport is injected (`SyncTransport`) so tests can observe everything
 * that crosses the boundary without a real network.
 */

export interface SyncTransport {
  send(payload: SyncPayload): void
}

export interface SyncSettings {
  /** Off by default per P-7 — egress requires explicit opt-in. */
  enabled: boolean
}

export interface SyncSkillEntry {
  /** Skill identifier (frontmatter `name`). Not a file path. */
  skill: string
  /** Number of recorded invocations across all projects. */
  count: number
  /** Optional skill version tag if available. */
  skillVersion?: string
}

export interface SyncPayload {
  /** App version producing this payload. */
  appVersion: string
  /** Wall-clock when the payload was assembled (ISO 8601). */
  generatedAt: string
  /** Per-skill metadata only. Never paths, prompts, transcripts, or contents. */
  entries: SyncSkillEntry[]
}

export interface BuildPayloadInput {
  report: UsageReport
  appVersion: string
  /** Optional map of installed-skill version tags, by skill name. */
  skillVersions?: Record<string, string>
  /** Wall-clock the payload was assembled (ISO 8601). */
  generatedAt: string
}

export class SyncBoundary {
  constructor(
    private readonly settings: SyncSettings,
    private readonly transport: SyncTransport,
  ) {}

  /**
   * Build a sync payload from a usage report and ship it through the transport
   * — but only if the user has enabled sync. With sync disabled, this is a
   * no-op and the transport is never invoked.
   */
  syncOnce(input: BuildPayloadInput): SyncPayload | null {
    if (!this.settings.enabled) return null
    const payload = buildSyncPayload(input)
    this.transport.send(payload)
    return payload
  }
}

/**
 * Project a UsageReport onto the minimal metadata shape that may cross the
 * sync boundary. Aggregates per-skill counts across all projects so the
 * `project` field — which can carry a working-directory path (P-8 forbids
 * paths) — is collapsed away entirely.
 */
export function buildSyncPayload(input: BuildPayloadInput): SyncPayload {
  const totals = new Map<string, number>()
  for (const project of input.report.projects) {
    for (const sc of project.skills) {
      totals.set(sc.skill, (totals.get(sc.skill) ?? 0) + sc.count)
    }
  }
  const entries: SyncSkillEntry[] = []
  for (const [skill, count] of totals) {
    const entry: SyncSkillEntry = { skill, count }
    const version = input.skillVersions?.[skill]
    if (version !== undefined) entry.skillVersion = version
    entries.push(entry)
  }
  entries.sort((a, b) => (a.skill < b.skill ? -1 : a.skill > b.skill ? 1 : 0))
  return {
    appVersion: input.appVersion,
    generatedAt: input.generatedAt,
    entries,
  }
}
