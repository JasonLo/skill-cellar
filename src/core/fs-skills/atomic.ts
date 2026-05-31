import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { AlreadyInstalledError } from '../errors'

export function atomicInstallDir(srcDir: string, finalDir: string): void {
  if (existsSync(finalDir)) {
    throw new AlreadyInstalledError(basename(finalDir))
  }
  const parent = dirname(finalDir)
  if (parent === '' || parent === finalDir) {
    throw new Error('install destination has no parent directory')
  }
  mkdirSync(parent, { recursive: true })

  // Stage inside the destination's parent so the rename is same-filesystem
  // and therefore atomic. If anything below throws, we clean up.
  const staging = mkdtempSync(join(parent, '.sc-staging-'))
  try {
    cpSync(srcDir, staging, { recursive: true })
    renameSync(staging, finalDir)
  } catch (e) {
    rmSync(staging, { recursive: true, force: true })
    throw e
  }
}

export function atomicWriteFile(
  dir: string,
  fileName: string,
  contents: string,
): void {
  mkdirSync(dir, { recursive: true })
  const tmp = join(
    dir,
    `.sc-tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  try {
    writeFileSync(tmp, contents)
    renameSync(tmp, join(dir, fileName))
  } catch (e) {
    try {
      rmSync(tmp, { force: true })
    } catch {}
    throw e
  }
}
