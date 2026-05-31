import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { RegistryEntry } from '../registry/types'

export interface Materialized {
  /** Local directory containing the skill's files (must contain SKILL.md). */
  dir: string
  /** The directory name this skill should occupy under `.claude/skills/`. */
  intendedName: string
  /**
   * Optional cleanup hook for sources that materialized into a temp dir.
   * Callers MAY call this once the install commit has succeeded.
   */
  cleanup?: () => void
}

export interface SkillSource {
  materialize(): Materialized
}

export class LocalDir implements SkillSource {
  constructor(
    private readonly dir: string,
    private readonly explicitName?: string,
  ) {}

  static withName(dir: string, intendedName: string): LocalDir {
    return new LocalDir(dir, intendedName)
  }

  materialize(): Materialized {
    return {
      dir: this.dir,
      intendedName: this.explicitName ?? basename(this.dir),
    }
  }
}

/** Fetches a registry entry's skill files (the shop's GitHub-fetch seam). */
export interface SkillFetcher {
  fetchSkill(entry: RegistryEntry): Materialized
}

export class RemoteSkill implements SkillSource {
  constructor(
    private readonly fetcher: SkillFetcher,
    private readonly entry: RegistryEntry,
  ) {}

  materialize(): Materialized {
    return this.fetcher.fetchSkill(this.entry)
  }
}

export function readSkillMd(dir: string): string | undefined {
  try {
    return readFileSync(join(dir, 'SKILL.md'), 'utf-8')
  } catch {
    return undefined
  }
}
