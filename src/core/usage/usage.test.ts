import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { joinInstalled, usageReport } from './index'

function skillLine(cwd: string, skill: string): string {
  return JSON.stringify({
    type: 'assistant',
    cwd,
    message: {
      role: 'assistant',
      content: [
        { type: 'tool_use', name: 'Skill', input: { skill } },
      ],
    },
  })
}

function writeTranscript(
  projectsRoot: string,
  folder: string,
  session: string,
  lines: string[],
): void {
  const dir = join(projectsRoot, folder)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${session}.jsonl`), lines.join('\n'))
}

describe('usage', () => {
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

  // I-2 outcome: per-skill invocation counts grouped by project.
  it('usage_counts_skill_invocations_by_project', () => {
    const projectsRoot = newTmp('sc-usage-')
    const projectA = '/home/dev/repo/alpha'

    writeTranscript(projectsRoot, '-home-dev-repo-alpha', 'session-1', [
      skillLine(projectA, 'graphify'),
      skillLine(projectA, 'ls-check'),
      // Noise: non-Skill tool_use.
      JSON.stringify({
        type: 'assistant',
        cwd: projectA,
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
          ],
        },
      }),
      // Noise: plain text assistant turn.
      JSON.stringify({
        type: 'assistant',
        cwd: projectA,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'hello' }],
        },
      }),
      // Noise: user line mentioning a skill.
      JSON.stringify({
        type: 'user',
        cwd: projectA,
        message: { role: 'user', content: 'run graphify' },
      }),
      // Noise: malformed JSON.
      '{ this is not valid json',
    ])
    writeTranscript(projectsRoot, '-home-dev-repo-alpha', 'session-2', [
      skillLine(projectA, 'graphify'),
    ])

    const projectB = '/home/dev/repo/beta'
    writeTranscript(
      projectsRoot,
      '-home-dev-repo-beta/nested-uuid',
      'session-3',
      [skillLine(projectB, 'graphify')],
    )

    const report = usageReport(projectsRoot)
    expect(report.projects.length).toBe(2)

    const alpha = report.projects[0]
    expect(alpha.project).toBe(projectA)
    expect(alpha.total).toBe(3)
    expect(alpha.skills[0]).toEqual({ skill: 'graphify', count: 2 })
    expect(alpha.skills[1]).toEqual({ skill: 'ls-check', count: 1 })

    const beta = report.projects[1]
    expect(beta.project).toBe(projectB)
    expect(beta.total).toBe(1)
    expect(beta.skills).toEqual([{ skill: 'graphify', count: 1 }])
  })

  it('usage_report empty when no transcripts', () => {
    const root = newTmp('sc-usage-')
    const missing = join(root, 'does-not-exist')
    const report = usageReport(missing)
    expect(report.projects).toEqual([])
  })

  it('join_installed surfaces unused', () => {
    const projectsRoot = newTmp('sc-usage-')
    writeTranscript(projectsRoot, '-home-dev-repo-alpha', 's', [
      skillLine('/home/dev/repo/alpha', 'graphify'),
    ])
    const report = usageReport(projectsRoot)
    const joined = joinInstalled(report, ['graphify', 'dormant'])
    expect(joined[0]).toEqual({ skill: 'dormant', total: 0 })
    expect(joined[1]).toEqual({ skill: 'graphify', total: 1 })
  })
})
