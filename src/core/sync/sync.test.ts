import { describe, expect, it, vi } from 'vitest'
import type { UsageReport } from '../usage'
import {
  type SyncPayload,
  type SyncTransport,
  SyncBoundary,
  buildSyncPayload,
} from './index'

function sampleReport(): UsageReport {
  return {
    projects: [
      {
        project: '/home/dev/repo/alpha',
        total: 3,
        skills: [
          { skill: 'graphify', count: 2 },
          { skill: 'ls-check', count: 1 },
        ],
      },
      {
        project: '/home/dev/repo/beta',
        total: 1,
        skills: [{ skill: 'graphify', count: 1 }],
      },
    ],
  }
}

describe('sync boundary (I-4)', () => {
  // I-4 outcome 1: when sync is disabled, no data leaves the device.
  it('no_transmission_until_sync_enabled', () => {
    const transport: SyncTransport = { send: vi.fn() }
    const boundary = new SyncBoundary({ enabled: false }, transport)

    const result = boundary.syncOnce({
      report: sampleReport(),
      appVersion: '0.1.0',
      generatedAt: '2026-05-30T00:00:00Z',
    })
    expect(result).toBeNull()
    expect(transport.send).not.toHaveBeenCalled()
  })

  // I-4 outcome 2: when sync is enabled, the payload includes ONLY usage
  // metadata — skill names, invocation counts, timestamps, app+skill versions.
  // It MUST exclude transcript content, prompts, file contents, and file paths.
  it('sync_payload_metadata_only', () => {
    let captured: SyncPayload | null = null
    const transport: SyncTransport = {
      send: (p) => {
        captured = p
      },
    }
    const boundary = new SyncBoundary({ enabled: true }, transport)

    const payload = boundary.syncOnce({
      report: sampleReport(),
      appVersion: '0.1.0',
      skillVersions: { graphify: '1.2.0', 'ls-check': '0.9.0' },
      generatedAt: '2026-05-30T00:00:00Z',
    })
    expect(payload).not.toBeNull()
    expect(captured).not.toBeNull()
    if (captured === null) throw new Error('unreachable')

    // Allowlist: ONLY these top-level keys may appear in a sync payload.
    expect(Object.keys(captured).sort()).toEqual(
      ['appVersion', 'entries', 'generatedAt'].sort(),
    )
    expect(captured.appVersion).toBe('0.1.0')
    expect(captured.generatedAt).toBe('2026-05-30T00:00:00Z')

    // Per-entry allowlist: only metadata fields.
    const allowed = new Set(['skill', 'count', 'skillVersion'])
    for (const entry of captured.entries) {
      for (const key of Object.keys(entry)) {
        expect(
          allowed.has(key),
          `entry must not carry forbidden field '${key}'`,
        ).toBe(true)
      }
    }

    // Aggregation: counts summed across projects.
    expect(captured.entries).toEqual([
      { skill: 'graphify', count: 3, skillVersion: '1.2.0' },
      { skill: 'ls-check', count: 1, skillVersion: '0.9.0' },
    ])

    // Forbidden-content audit: serialize the whole payload and verify nothing
    // resembling transcript content, prompts, file contents, or filesystem
    // paths slipped through. A file path is the most common accidental leak;
    // make it impossible for one to ride along.
    const serialized = JSON.stringify(captured)
    expect(serialized).not.toContain('/home/dev/repo/alpha')
    expect(serialized).not.toContain('/home/dev/repo/beta')
    expect(serialized).not.toMatch(/\/[a-z]+(?:\/[a-z]+)+/i)
  })

  it('buildSyncPayload is deterministic and project-key-free', () => {
    const a = buildSyncPayload({
      report: sampleReport(),
      appVersion: '0.1.0',
      generatedAt: '2026-05-30T00:00:00Z',
    })
    const b = buildSyncPayload({
      report: sampleReport(),
      appVersion: '0.1.0',
      generatedAt: '2026-05-30T00:00:00Z',
    })
    expect(a).toEqual(b)
    // No `project` field anywhere.
    expect(JSON.stringify(a)).not.toContain('project')
  })
})
