import {
  chmodSync,
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
import { AlreadyInstalledError, ValidationFailedError } from '../errors'
import { install, LocalDir } from './index'

function makeSkill(root: string, dirName: string, skillMd: string): string {
  const dir = join(root, dirName)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), skillMd)
  const subdir = join(dir, 'references')
  mkdirSync(subdir, { recursive: true })
  writeFileSync(join(subdir, 'notes.md'), 'notes')
  return dir
}

function validSkillMd(name: string): string {
  return `---\nname: ${name}\ndescription: A valid skill for testing.\n---\n# ${name}\n`
}

describe('install (atomic)', () => {
  const created: string[] = []
  beforeEach(() => {
    created.length = 0
  })
  afterEach(() => {
    for (const p of created) {
      try {
        // Re-grant write perms in case a test left a read-only dir behind.
        chmodSync(p, 0o755)
      } catch {}
      rmSync(p, { recursive: true, force: true })
    }
  })
  function newTmp(prefix: string): string {
    const p = mkdtempSync(join(tmpdir(), prefix))
    created.push(p)
    return p
  }

  // I-1 outcome 1: validate-then-atomic-copy.
  it('install_atomic_validates_then_copies', () => {
    // (a) Happy path
    {
      const srcRoot = newTmp('sc-src-')
      const target = newTmp('sc-tgt-')
      const skillsRoot = join(target, '.claude', 'skills')
      const src = makeSkill(srcRoot, 'web-fetch', validSkillMd('web-fetch'))
      const desc = install(new LocalDir(src), skillsRoot)
      expect(desc.conformance.verdict).toBe('valid')
      expect(existsSync(join(skillsRoot, 'web-fetch', 'SKILL.md'))).toBe(true)
      expect(
        existsSync(join(skillsRoot, 'web-fetch', 'references', 'notes.md')),
      ).toBe(true)
    }

    // (b) Validation fails → no partial directory
    {
      const srcRoot = newTmp('sc-src-')
      const target = newTmp('sc-tgt-')
      const skillsRoot = join(target, '.claude', 'skills')
      const src = makeSkill(srcRoot, 'src', validSkillMd('web-fetch'))
      let err: unknown
      try {
        install(LocalDir.withName(src, 'wrong-name'), skillsRoot)
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(ValidationFailedError)
      if (err instanceof ValidationFailedError) {
        expect(err.conformance.verdict).toBe('invalid')
      }
      expect(existsSync(join(skillsRoot, 'wrong-name'))).toBe(false)
      if (existsSync(skillsRoot)) {
        expect(readdirSync(skillsRoot)).toHaveLength(0)
      }
    }

    // (c) Copy stage fails on read-only skills root → no partial dir
    {
      const srcRoot = newTmp('sc-src-')
      const target = newTmp('sc-tgt-')
      const skillsRoot = join(target, '.claude', 'skills')
      mkdirSync(skillsRoot, { recursive: true })
      const src = makeSkill(srcRoot, 'web-fetch', validSkillMd('web-fetch'))
      chmodSync(skillsRoot, 0o555)
      let result: unknown
      try {
        result = install(new LocalDir(src), skillsRoot)
      } catch (e) {
        result = e
      }
      chmodSync(skillsRoot, 0o755)
      if (result instanceof Error) {
        expect(existsSync(join(skillsRoot, 'web-fetch'))).toBe(false)
      }
    }
  })

  it('install rejects already-installed', () => {
    const srcRoot = newTmp('sc-src-')
    const target = newTmp('sc-tgt-')
    const skillsRoot = join(target, '.claude', 'skills')
    const src = makeSkill(srcRoot, 'web-fetch', validSkillMd('web-fetch'))
    install(new LocalDir(src), skillsRoot)
    let err: unknown
    try {
      install(new LocalDir(src), skillsRoot)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AlreadyInstalledError)
  })
})
