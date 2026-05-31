import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { discoverPlugins } from './index'

function writeSkill(
  skillDir: string,
  name: string,
  description?: string,
): void {
  mkdirSync(skillDir, { recursive: true })
  const desc = description ?? 'A valid skill for testing.'
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${desc}\n---\n# ${name}\n`,
  )
}

describe('discoverPlugins (I-6)', () => {
  let root = ''
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sc-plugins-'))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  // I-6 outcome 1
  it('discovers nested plugin skills', () => {
    // Three real-world layout shapes at different depths:
    writeSkill(
      join(root, 'cache', 'mp', 'superpowers', '5.1.0', 'skills', 'brainstorm'),
      'brainstorm',
    )
    writeSkill(
      join(
        root,
        'marketplaces',
        'mp',
        'plugins',
        'hookify',
        'skills',
        'writing-rules',
      ),
      'writing-rules',
    )
    writeSkill(
      join(
        root,
        'marketplaces',
        'mp',
        'external_plugins',
        'discord',
        'skills',
        'access',
      ),
      'access',
    )
    // A stray non-skill directory must be ignored.
    mkdirSync(join(root, 'marketplaces', 'mp', 'README'), { recursive: true })

    const found = discoverPlugins(root)
    const names = found.map((d) => d.name).sort()
    expect(names).toEqual(['access', 'brainstorm', 'writing-rules'])
  })

  // I-6 outcome 2
  it('dedupes by name with source-plugin label', () => {
    // Same skill name mirrored in cache/ (versioned) and marketplaces/.
    writeSkill(
      join(
        root,
        'cache',
        'cpo',
        'superpowers',
        '5.1.0',
        'skills',
        'brainstorm',
      ),
      'brainstorm',
    )
    writeSkill(
      join(
        root,
        'marketplaces',
        'cpo',
        'plugins',
        'superpowers',
        'skills',
        'brainstorm',
      ),
      'brainstorm',
    )

    const found = discoverPlugins(root)
    expect(found).toHaveLength(1)
    expect(found[0]?.name).toBe('brainstorm')
    // Label resolves to the owning plugin, never the version dir.
    expect(found[0]?.plugin).toBe('superpowers')
  })

  it('derives the plugin label from a cache-only versioned path', () => {
    writeSkill(
      join(
        root,
        'cache',
        'cpo',
        'superpowers',
        '5.1.0',
        'skills',
        'brainstorm',
      ),
      'brainstorm',
    )
    const found = discoverPlugins(root)
    expect(found[0]?.plugin).toBe('superpowers')
  })

  // I-6 outcome 3
  it('plugin descriptor carries conformance verdict', () => {
    writeSkill(
      join(root, 'marketplaces', 'mp', 'plugins', 'p', 'skills', 'good-skill'),
      'good-skill',
    )
    // name/dir mismatch → invalid under the same agentskills.io rules.
    writeSkill(
      join(root, 'marketplaces', 'mp', 'plugins', 'p', 'skills', 'bad-dir'),
      'different-name',
    )

    const found = discoverPlugins(root)
    const good = found.find((d) => d.dirName === 'good-skill')
    const bad = found.find((d) => d.dirName === 'bad-dir')
    expect(good?.conformance.verdict).toBe('valid')
    expect(bad?.conformance.verdict).toBe('invalid')
  })

  it('returns empty when the plugins root does not exist', () => {
    expect(discoverPlugins(join(root, 'nope'))).toEqual([])
  })
})
