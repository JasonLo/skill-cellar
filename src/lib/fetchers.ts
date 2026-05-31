import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  installFromRegistry,
  type SkillDescriptor,
  type SkillFetcher,
} from '../core/fs-skills'
import type { RegistryEntry, RegistryFetcher } from '../core/registry'

const REGISTRY_URL_ENV = 'SKILL_CELLAR_REGISTRY_URL'

export function configuredRegistryUrl(): string | undefined {
  const v = process.env[REGISTRY_URL_ENV]
  return v && v !== '' ? v : undefined
}

/**
 * Fetch the catalog asynchronously, then expose it through the sync
 * RegistryFetcher seam. If fetching fails (or no URL configured), the
 * returned fetcher throws on use — getRegistry() then falls back to cache
 * or bundled per I-5.
 */
export async function makeRegistryFetcher(
  url: string | undefined,
): Promise<RegistryFetcher> {
  let text: string | null = null
  if (url !== undefined) {
    try {
      const res = await fetch(url)
      if (res.ok) text = await res.text()
    } catch {
      text = null
    }
  }
  return {
    fetchCatalog: (): string => {
      if (text === null) throw new Error('registry source unavailable')
      return text
    },
  }
}

/**
 * Download a registry skill's repo tarball, extract it, and run the core
 * install pipeline. Returns the new skill's descriptor. Throws on network
 * or extraction failure; ValidationFailedError on conformance failure.
 */
export async function downloadAndInstall(
  entry: RegistryEntry,
  targetRoot: string,
): Promise<SkillDescriptor> {
  const tmp = mkdtempSync(join(tmpdir(), 'skill-cellar-'))
  const tarPath = join(tmp, 'archive.tar.gz')
  const extractDir = join(tmp, 'extract')
  mkdirSync(extractDir, { recursive: true })

  const ref = entry.gitRef ?? 'HEAD'
  const url = `https://codeload.github.com/${entry.repo}/tar.gz/${ref}`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`download failed (${res.status} ${res.statusText})`)
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  writeFileSync(tarPath, bytes)

  const tar = spawnSync(
    'tar',
    ['-xzf', tarPath, '-C', extractDir, '--strip-components=1'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  if (tar.status !== 0) {
    const stderr = tar.stderr ? tar.stderr.toString() : ''
    throw new Error(`tar extract failed: ${stderr.trim()}`)
  }

  const skillDir =
    entry.subdir !== null && entry.subdir !== ''
      ? join(extractDir, entry.subdir)
      : extractDir

  const fetcher: SkillFetcher = {
    fetchSkill: () => ({
      dir: skillDir,
      intendedName: entry.name,
    }),
  }
  return installFromRegistry(fetcher, entry, targetRoot)
}
