import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { appDataDir } from './paths'

export interface Settings {
  syncEnabled: boolean
}

const DEFAULTS: Settings = { syncEnabled: false }

function settingsPath(): string {
  return join(appDataDir(), 'settings.json')
}

export function readSettings(): Settings {
  const p = settingsPath()
  if (!existsSync(p)) return { ...DEFAULTS }
  try {
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as Partial<Settings>
    return {
      syncEnabled:
        typeof raw.syncEnabled === 'boolean'
          ? raw.syncEnabled
          : DEFAULTS.syncEnabled,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSettings(s: Settings): void {
  mkdirSync(appDataDir(), { recursive: true })
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2))
}
