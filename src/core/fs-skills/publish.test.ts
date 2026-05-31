import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ValidationFailedError } from '../errors'
import { publishSkill, readSkillMdAt } from './install'

const VALID =
  '---\nname: web-fetch\ndescription: A valid skill for testing.\n---\n# web-fetch\n'

describe('Craft publish gate (I-3)', () => {
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

  // I-3 outcome: invalid frontmatter blocks publish AND surfaces the failing
  // rule so the UI can render it inline.
  it('blocks publish on invalid frontmatter', () => {
    const root = newTmp('sc-pub-')
    // `name` mismatches the (intended) directory → Invalid.
    const bad = '---\nname: not-web-fetch\ndescription: ok\n---\n'
    let caught: unknown
    try {
      publishSkill(root, 'web-fetch', bad)
    } catch (e) {
      caught = e
    }
    expect(
      caught,
      'publish must throw ValidationFailedError on invalid frontmatter',
    ).toBeInstanceOf(ValidationFailedError)
    if (caught instanceof ValidationFailedError) {
      expect(caught.conformance.verdict).toBe('invalid')
      // The failing rule MUST be surfaced (so the UI can display it inline).
      expect(caught.conformance.findings.length).toBeGreaterThan(0)
      expect(caught.conformance.findings[0].message.length).toBeGreaterThan(0)
      expect(caught.conformance.findings[0].code).toBe('name.dir_mismatch')
    }
    // Nothing written: the publish gate prevents any FS side effect.
    expect(existsSync(join(root, 'web-fetch'))).toBe(false)
  })

  it('publishes a valid skill and round-trips its bytes', () => {
    const root = newTmp('sc-pub-')
    const desc = publishSkill(root, 'web-fetch', VALID)
    expect(desc.conformance.verdict).toBe('valid')
    expect(readSkillMdAt(root, 'web-fetch')).toBe(VALID)
  })

  it('preserves sibling resource files on re-publish', () => {
    const root = newTmp('sc-pub-')
    const dir = join(root, 'web-fetch')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'reference.md'), 'keep me')
    const updated = '---\nname: web-fetch\ndescription: Updated.\n---\n# v2\n'
    publishSkill(root, 'web-fetch', updated)
    expect(readSkillMdAt(root, 'web-fetch')).toBe(updated)
    expect(readFileSync(join(dir, 'reference.md'), 'utf-8')).toBe('keep me')
  })
})
