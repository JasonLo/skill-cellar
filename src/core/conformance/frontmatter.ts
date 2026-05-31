import YAML from 'yaml'

export interface Frontmatter {
  name?: string
  description?: string
  license?: string
  compatibility?: string
  metadata?: Record<string, unknown>
  allowedTools?: unknown
}

export class FrontmatterMissingError extends Error {
  readonly kind = 'missing' as const
  constructor() {
    super('frontmatter missing')
  }
}

export class FrontmatterParseError extends Error {
  readonly kind = 'parse' as const
  constructor(message: string) {
    super(message)
  }
}

export type FrontmatterError = FrontmatterMissingError | FrontmatterParseError

export function splitFrontmatter(skillMd: string): string {
  const stripped = skillMd.startsWith('﻿') ? skillMd.slice(1) : skillMd
  const trimmedStart = stripped.replace(/^[\n\r]+/, '')

  if (!trimmedStart.startsWith('---')) {
    throw new FrontmatterMissingError()
  }
  const afterOpen = trimmedStart.slice(3)
  let body: string
  if (afterOpen.startsWith('\n')) {
    body = afterOpen.slice(1)
  } else if (afterOpen.startsWith('\r\n')) {
    body = afterOpen.slice(2)
  } else {
    throw new FrontmatterMissingError()
  }

  // Find a closing line that is exactly `---` (after stripping trailing CR).
  let pos = 0
  while (pos < body.length) {
    const nl = body.indexOf('\n', pos)
    const lineEnd = nl === -1 ? body.length : nl
    const rawLine = body.slice(pos, lineEnd)
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (line === '---') {
      return body.slice(0, pos)
    }
    if (nl === -1) break
    pos = nl + 1
  }
  throw new FrontmatterMissingError()
}

export function parseFrontmatter(skillMd: string): Frontmatter {
  const yamlText = splitFrontmatter(skillMd)
  if (yamlText.trim() === '') {
    return {}
  }
  let raw: unknown
  try {
    raw = YAML.parse(yamlText)
  } catch (e) {
    throw new FrontmatterParseError(e instanceof Error ? e.message : String(e))
  }
  if (raw === null || raw === undefined) {
    return {}
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new FrontmatterParseError('frontmatter is not a mapping')
  }
  const obj = raw as Record<string, unknown>
  const fm: Frontmatter = {}
  if (typeof obj.name === 'string') fm.name = obj.name
  if (typeof obj.description === 'string') fm.description = obj.description
  if (typeof obj.license === 'string') fm.license = obj.license
  if (typeof obj.compatibility === 'string')
    fm.compatibility = obj.compatibility
  if (
    obj.metadata !== undefined &&
    obj.metadata !== null &&
    typeof obj.metadata === 'object' &&
    !Array.isArray(obj.metadata)
  ) {
    fm.metadata = obj.metadata as Record<string, unknown>
  }
  if (obj['allowed-tools'] !== undefined) {
    fm.allowedTools = obj['allowed-tools']
  }
  return fm
}
