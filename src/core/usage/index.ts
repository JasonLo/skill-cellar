import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface SkillCount {
  skill: string
  count: number
}

export interface ProjectUsage {
  project: string
  total: number
  skills: SkillCount[]
}

export interface UsageReport {
  projects: ProjectUsage[]
}

export interface InstalledUsage {
  skill: string
  total: number
}

function walkJsonl(root: string): string[] {
  const out: string[] = []
  function visit(dir: string): void {
    let entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        visit(p)
      } else if (e.isFile() && p.endsWith('.jsonl')) {
        out.push(p)
      }
    }
  }
  visit(root)
  return out
}

export function usageReport(projectsRoot: string): UsageReport {
  const byProject = new Map<string, Map<string, number>>()
  if (existsSync(projectsRoot)) {
    let isDir = false
    try {
      isDir = statSync(projectsRoot).isDirectory()
    } catch {}
    if (isDir) {
      for (const path of walkJsonl(projectsRoot)) {
        let contents: string
        try {
          contents = readFileSync(path, 'utf-8')
        } catch {
          continue
        }
        for (const line of contents.split('\n')) {
          const parsed = skillInvocations(line)
          if (parsed === null) continue
          const [cwd, skills] = parsed
          let counts = byProject.get(cwd)
          if (counts === undefined) {
            counts = new Map()
            byProject.set(cwd, counts)
          }
          for (const skill of skills) {
            counts.set(skill, (counts.get(skill) ?? 0) + 1)
          }
        }
      }
    }
  }

  const projects: ProjectUsage[] = []
  for (const [project, counts] of byProject) {
    let total = 0
    const skills: SkillCount[] = []
    for (const [skill, count] of counts) {
      total += count
      skills.push({ skill, count })
    }
    skills.sort(
      (a, b) => b.count - a.count || (a.skill < b.skill ? -1 : a.skill > b.skill ? 1 : 0),
    )
    projects.push({ project, total, skills })
  }
  projects.sort(
    (a, b) =>
      b.total - a.total ||
      (a.project < b.project ? -1 : a.project > b.project ? 1 : 0),
  )
  return { projects }
}

export function joinInstalled(
  report: UsageReport,
  installedNames: string[],
): InstalledUsage[] {
  const totals = new Map<string, number>()
  for (const project of report.projects) {
    for (const sc of project.skills) {
      totals.set(sc.skill, (totals.get(sc.skill) ?? 0) + sc.count)
    }
  }
  const out: InstalledUsage[] = installedNames.map((skill) => ({
    skill,
    total: totals.get(skill) ?? 0,
  }))
  out.sort(
    (a, b) =>
      a.total - b.total ||
      (a.skill < b.skill ? -1 : a.skill > b.skill ? 1 : 0),
  )
  return out
}

function skillInvocations(line: string): [string, string[]] | null {
  let v: unknown
  try {
    v = JSON.parse(line)
  } catch {
    return null
  }
  if (v === null || typeof v !== 'object') return null
  const obj = v as Record<string, unknown>
  if (obj.type !== 'assistant') return null
  if (typeof obj.cwd !== 'string') return null
  const cwd = obj.cwd
  const message = obj.message
  if (
    message === null ||
    typeof message !== 'object' ||
    !Array.isArray((message as Record<string, unknown>).content)
  )
    return null
  const content = (message as Record<string, unknown>).content as unknown[]
  const skills: string[] = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const b = block as Record<string, unknown>
    if (b.type !== 'tool_use') continue
    if (b.name !== 'Skill') continue
    const input = b.input
    if (input === null || typeof input !== 'object') continue
    const skill = (input as Record<string, unknown>).skill
    if (typeof skill === 'string') skills.push(skill)
  }
  if (skills.length === 0) return null
  return [cwd, skills]
}
