import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ValidationFailedError } from '../errors'
import type { RegistryEntry } from '../registry/types'
import type { Materialized, SkillFetcher } from './source'
import { installFromRegistry } from './index'

class FakeFetcher implements SkillFetcher {
  fetches = 0
  constructor(
    private readonly skillMd: string,
    private readonly withSubfile: boolean,
    private readonly tempRoot: string,
  ) {}
  fetchSkill(entry: RegistryEntry): Materialized {
    this.fetches += 1
    const tmp = mkdtempSync(join(this.tempRoot, 'sc-fetch-'))
    writeFileSync(join(tmp, 'SKILL.md'), this.skillMd)
    if (this.withSubfile) {
      mkdirSync(join(tmp, 'references'), { recursive: true })
      writeFileSync(join(tmp, 'references', 'notes.md'), 'notes')
    }
    return {
      dir: tmp,
      intendedName: entry.name,
      cleanup: () => rmSync(tmp, { recursive: true, force: true }),
    }
  }
}

function entry(name: string): RegistryEntry {
  return {
    name,
    description: 'A registry-advertised skill.',
    repo: 'agentskills/examples',
    subdir: `skills/${name}`,
    gitRef: null,
    featured: true,
  }
}

function validSkillMd(name: string): string {
  return `---\nname: ${name}\ndescription: A valid skill for testing.\n---\n# ${name}\n`
}

describe('install_from_registry', () => {
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

  // I-1 outcome 2: shop install uses the same engine as local-folder install.
  it('install_from_registry_fetches_validates_installs', () => {
    // (a) Happy path
    {
      const target = newTmp('sc-tgt-')
      const skillsRoot = join(target, '.claude', 'skills')
      const tempRoot = newTmp('sc-tmp-')
      const fetcher = new FakeFetcher(validSkillMd('web-fetch'), true, tempRoot)
      const desc = installFromRegistry(fetcher, entry('web-fetch'), skillsRoot)
      expect(fetcher.fetches).toBe(1)
      expect(desc.conformance.verdict).toBe('valid')
      expect(desc.name).toBe('web-fetch')
      expect(existsSync(join(skillsRoot, 'web-fetch', 'SKILL.md'))).toBe(true)
      expect(
        existsSync(join(skillsRoot, 'web-fetch', 'references', 'notes.md')),
      ).toBe(true)
    }

    // (b) Same gate as install: name mismatch → ValidationFailed, no copy.
    {
      const target = newTmp('sc-tgt-')
      const skillsRoot = join(target, '.claude', 'skills')
      const tempRoot = newTmp('sc-tmp-')
      const fetcher = new FakeFetcher(
        validSkillMd('not-web-fetch'),
        false,
        tempRoot,
      )
      let err: unknown
      try {
        installFromRegistry(fetcher, entry('web-fetch'), skillsRoot)
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(ValidationFailedError)
      if (err instanceof ValidationFailedError) {
        expect(err.conformance.verdict).toBe('invalid')
      }
      expect(existsSync(join(skillsRoot, 'web-fetch'))).toBe(false)
      if (existsSync(skillsRoot)) {
        expect(readdirSync(skillsRoot)).toHaveLength(0)
      }
    }
  })
})
