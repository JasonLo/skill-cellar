import { describe, expect, it } from 'vitest'
import { evaluate, hasCode } from './index'

const VALID =
  '---\nname: web-fetch\ndescription: Fetch a URL and return its body.\nlicense: MIT\n---\n# Web Fetch\n'

describe('conformance', () => {
  // I-1 outcome 3: a verdict of valid / warnings / invalid is derived purely
  // from SKILL.md frontmatter rules.
  it('conformance_verdict_from_frontmatter', () => {
    const longDesc = 'x'.repeat(1025)
    const longCompat = 'c'.repeat(600)

    const cases: Array<{
      name: string
      skillMd: string
      parentDir: string
      expect: 'valid' | 'warnings' | 'invalid'
      expectCode: string | null
    }> = [
      {
        name: 'valid skill',
        skillMd: VALID,
        parentDir: 'web-fetch',
        expect: 'valid',
        expectCode: null,
      },
      {
        name: 'name does not match parent dir',
        skillMd: '---\nname: webfetch\ndescription: ok\n---\n',
        parentDir: 'web-fetch',
        expect: 'invalid',
        expectCode: 'name.dir_mismatch',
      },
      {
        name: 'missing description',
        skillMd: '---\nname: web-fetch\n---\n',
        parentDir: 'web-fetch',
        expect: 'invalid',
        expectCode: 'description.missing',
      },
      {
        name: 'description too long',
        skillMd: `---\nname: web-fetch\ndescription: ${longDesc}\n---\n`,
        parentDir: 'web-fetch',
        expect: 'invalid',
        expectCode: 'description.too_long',
      },
      {
        name: 'consecutive hyphen in name',
        skillMd: '---\nname: web--fetch\ndescription: ok\n---\n',
        parentDir: 'web--fetch',
        expect: 'invalid',
        expectCode: 'name.format',
      },
      {
        name: 'uppercase in name',
        skillMd: '---\nname: WebFetch\ndescription: ok\n---\n',
        parentDir: 'WebFetch',
        expect: 'invalid',
        expectCode: 'name.format',
      },
      {
        name: 'over-length compatibility is a warning, still installable',
        skillMd: `---\nname: web-fetch\ndescription: ok\ncompatibility: ${longCompat}\n---\n`,
        parentDir: 'web-fetch',
        expect: 'warnings',
        expectCode: 'compatibility.too_long',
      },
      {
        name: 'non-string metadata value is a warning',
        skillMd:
          '---\nname: web-fetch\ndescription: ok\nmetadata:\n  count: 3\n---\n',
        parentDir: 'web-fetch',
        expect: 'warnings',
        expectCode: 'metadata.non_string',
      },
      {
        name: 'missing frontmatter block',
        skillMd: '# Just a heading, no frontmatter\n',
        parentDir: 'web-fetch',
        expect: 'invalid',
        expectCode: 'frontmatter.missing',
      },
      {
        name: 'malformed yaml',
        skillMd: '---\nname: [unterminated\n---\n',
        parentDir: 'web-fetch',
        expect: 'invalid',
        expectCode: 'frontmatter.parse',
      },
    ]

    for (const c of cases) {
      const result = evaluate(c.skillMd, c.parentDir)
      expect(result.verdict, `case '${c.name}'`).toBe(c.expect)
      if (c.expectCode !== null) {
        expect(
          hasCode(result, c.expectCode),
          `case '${c.name}' expected code ${c.expectCode}, got ${JSON.stringify(result.findings)}`,
        ).toBe(true)
      } else {
        expect(
          result.findings,
          `case '${c.name}' expected no findings`,
        ).toEqual([])
      }
    }
  })
})
