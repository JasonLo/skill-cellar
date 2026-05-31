import type { Conformance } from './conformance'

export class ValidationFailedError extends Error {
  readonly kind = 'validation_failed' as const
  constructor(public readonly conformance: Conformance) {
    super('skill failed conformance validation')
  }
}

export class AlreadyInstalledError extends Error {
  readonly kind = 'already_installed' as const
  constructor(public readonly name: string) {
    super(`skill '${name}' is already installed`)
  }
}

export class SkillMdMissingError extends Error {
  readonly kind = 'skill_md_missing' as const
  constructor(public readonly path: string) {
    super(`SKILL.md not found at ${path}`)
  }
}

export class UnsafePathError extends Error {
  readonly kind = 'unsafe_path' as const
  constructor(public readonly name: string) {
    super(`unsafe path component: '${name}'`)
  }
}

export class NetworkError extends Error {
  readonly kind = 'network' as const
  constructor(message: string) {
    super(message)
  }
}

export class RegistryUnavailableError extends Error {
  readonly kind = 'registry_unavailable' as const
  constructor() {
    super('registry unavailable')
  }
}
