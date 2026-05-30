// Thin typed wrapper around Tauri's `invoke`. All IPC calls go through here so
// the command-name and argument-casing contract lives in one place. Tauri v2
// maps camelCase JS keys to the snake_case Rust parameters automatically.

import { invoke } from '@tauri-apps/api/core'
import type {
  Conformance,
  RegistryResult,
  SkillDescriptor,
  TargetKind,
  UsageView,
} from './bindings'

export const api = {
  getRegistry: () => invoke<RegistryResult>('get_registry'),

  listSkills: (target: TargetKind) =>
    invoke<SkillDescriptor[]>('list_skills', { target }),

  checkConformance: (skillMd: string, parentDirName: string) =>
    invoke<Conformance>('check_conformance', { skillMd, parentDirName }),

  installLocalSkill: (sourceDir: string, target: TargetKind) =>
    invoke<SkillDescriptor>('install_local_skill', { sourceDir, target }),

  setActiveTarget: (target: TargetKind) =>
    invoke<void>('set_active_target', { target }),

  getActiveTarget: () => invoke<TargetKind | null>('get_active_target'),

  getUsage: () => invoke<UsageView>('get_usage'),
}

/** True when running inside the Tauri webview (vs a plain browser dev server). */
export function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
