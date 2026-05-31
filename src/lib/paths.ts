import { homedir } from 'node:os'
import { join } from 'node:path'

export function projectSkillsRoot(): string {
  return join(process.cwd(), '.claude', 'skills')
}

export function globalSkillsRoot(): string {
  return join(homedir(), '.claude', 'skills')
}

export function pluginSkillsRoot(): string {
  return join(homedir(), '.claude', 'plugins')
}

export function appDataDir(): string {
  return join(homedir(), '.config', 'skill-cellar')
}

export function transcriptsRoot(): string {
  return join(homedir(), '.claude', 'projects')
}
