import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Conformance, evaluate, isInstallable } from '../conformance'
import {
  AlreadyInstalledError,
  SkillMdMissingError,
  UnsafePathError,
  ValidationFailedError,
} from '../errors'
import type { RegistryEntry } from '../registry/types'
import { atomicInstallDir, atomicWriteFile } from './atomic'
import {
  type Materialized,
  RemoteSkill,
  readSkillMd,
  type SkillFetcher,
  type SkillSource,
} from './source'

export interface SkillDescriptor {
  name: string
  dirName: string
  path: string
  description?: string
  conformance: Conformance
}

function ensureSkillDirName(name: string): void {
  if (name === '' || name === '.' || name === '..') {
    throw new UnsafePathError(name)
  }
  if (name.includes('/') || name.includes('\\')) {
    throw new UnsafePathError(name)
  }
}

function readDescriptor(skillDir: string, dirName: string): SkillDescriptor {
  const skillMd = readSkillMd(skillDir)
  const conformance =
    skillMd !== undefined
      ? evaluate(skillMd, dirName)
      : {
          verdict: 'invalid' as const,
          findings: [
            {
              field: 'frontmatter',
              severity: 'error' as const,
              code: 'skill_md.missing',
              message: 'directory has no SKILL.md',
            },
          ],
        }
  const fmName = skillMd ? (extractField(skillMd, 'name') ?? dirName) : dirName
  const description = skillMd ? extractField(skillMd, 'description') : undefined
  return {
    name: fmName,
    dirName,
    path: skillDir,
    description: description ?? undefined,
    conformance,
  }
}

function extractField(text: string, field: string): string | undefined {
  let inner = text
  if (inner.startsWith('﻿')) inner = inner.slice(1)
  inner = inner.replace(/^[\n\r]+/, '')
  if (!inner.startsWith('---')) return undefined
  inner = inner.slice(3)
  const end = inner.indexOf('\n---')
  if (end === -1) return undefined
  const block = inner.slice(0, end)
  for (const line of block.split('\n')) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith(`${field}:`)) {
      let v = trimmed.slice(field.length + 1).trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      if (v !== '') return v
    }
  }
  return undefined
}

export function discover(skillsRoot: string): SkillDescriptor[] {
  let entries: string[]
  try {
    entries = readdirSync(skillsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return []
    throw e
  }
  entries.sort()
  return entries.map((name) => readDescriptor(join(skillsRoot, name), name))
}

export function install(
  source: SkillSource,
  targetSkillsRoot: string,
): SkillDescriptor {
  const materialized: Materialized = source.materialize()
  try {
    const skillMdPath = join(materialized.dir, 'SKILL.md')
    let skillMd: string
    try {
      skillMd = readFileSync(skillMdPath, 'utf-8')
    } catch {
      throw new SkillMdMissingError(skillMdPath)
    }

    const conformance = evaluate(skillMd, materialized.intendedName)
    if (!isInstallable(conformance)) {
      throw new ValidationFailedError(conformance)
    }

    ensureSkillDirName(materialized.intendedName)
    const finalDir = join(targetSkillsRoot, materialized.intendedName)
    atomicInstallDir(materialized.dir, finalDir)
    return readDescriptor(finalDir, materialized.intendedName)
  } finally {
    materialized.cleanup?.()
  }
}

export function installFromRegistry(
  fetcher: SkillFetcher,
  entry: RegistryEntry,
  targetSkillsRoot: string,
): SkillDescriptor {
  return install(new RemoteSkill(fetcher, entry), targetSkillsRoot)
}

export function readSkillMdAt(
  targetSkillsRoot: string,
  dirName: string,
): string {
  ensureSkillDirName(dirName)
  const path = join(targetSkillsRoot, dirName, 'SKILL.md')
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    throw new SkillMdMissingError(path)
  }
}

export function publishSkill(
  targetSkillsRoot: string,
  name: string,
  skillMd: string,
): SkillDescriptor {
  const conformance = evaluate(skillMd, name)
  if (!isInstallable(conformance)) {
    throw new ValidationFailedError(conformance)
  }
  ensureSkillDirName(name)
  const finalDir = join(targetSkillsRoot, name)
  atomicWriteFile(finalDir, 'SKILL.md', skillMd)
  return readDescriptor(finalDir, name)
}

export { AlreadyInstalledError }
