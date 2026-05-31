import { existsSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import { readDescriptor, type SkillDescriptor } from './install'

/** A skill discovered under the Claude Code plugin tree (read-only). */
export interface PluginSkillDescriptor extends SkillDescriptor {
  /** The owning plugin's name, derived from the skill's path. */
  plugin: string
}

/**
 * Discover skills managed by the Claude Code plugin system under
 * `pluginsRoot` (`~/.claude/plugins`). Matches `*​/skills/<name>/SKILL.md`
 * at any depth, deduplicates by frontmatter name (preferring a
 * `marketplaces/` copy over a versioned `cache/` mirror), and tags each
 * with its source-plugin label. Read-only: never mutates the tree.
 */
export function discoverPlugins(pluginsRoot: string): PluginSkillDescriptor[] {
  const all: PluginSkillDescriptor[] = []
  for (const skillsDir of findSkillsDirs(pluginsRoot)) {
    const plugin = pluginLabel(skillsDir)
    let children: string[]
    try {
      children = readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    } catch {
      continue
    }
    for (const name of children) {
      const dir = join(skillsDir, name)
      if (!existsSync(join(dir, 'SKILL.md'))) continue
      all.push({ ...readDescriptor(dir, name), plugin })
    }
  }

  const byName = new Map<string, PluginSkillDescriptor>()
  for (const d of all) {
    const cur = byName.get(d.name)
    if (!cur || (isPreferred(d) && !isPreferred(cur))) byName.set(d.name, d)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Recursively collect every directory named `skills`, not descending into one. */
function findSkillsDirs(root: string): string[] {
  let entries: { isDirectory(): boolean; name: string }[]
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return []
  }
  const out: string[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const p = join(root, e.name)
    if (e.name === 'skills') out.push(p)
    else out.push(...findSkillsDirs(p))
  }
  return out
}

/** The path segment that owns a `skills/` dir, skipping version dirs. */
function pluginLabel(skillsDir: string): string {
  const parts = skillsDir.split(sep).filter(Boolean)
  const i = parts.lastIndexOf('skills')
  let cand = parts[i - 1]
  if (cand !== undefined && isVersionLike(cand) && i - 2 >= 0) {
    cand = parts[i - 2]
  }
  return cand ?? 'plugin'
}

function isVersionLike(s: string): boolean {
  return s === 'unknown' || /^\d/.test(s)
}

function isPreferred(d: PluginSkillDescriptor): boolean {
  return d.path.includes(`${sep}marketplaces${sep}`)
}
