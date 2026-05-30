// Assemble / parse the SKILL.md text that Craft edits. The structured form owns
// a handful of frontmatter fields plus a free-text body; this module is the one
// place that turns those into a SKILL.md string and back. A real YAML
// serializer (the `yaml` dep) is used rather than hand-rolled string building so
// values needing quoting/escaping survive a round-trip. Validation is NOT done
// here — that is the backend's single source of truth (`check_conformance`).

import { parse, stringify } from 'yaml'

export interface SkillFields {
  name: string
  description: string
  license: string
  compatibility: string
}

export const EMPTY_FIELDS: SkillFields = {
  name: '',
  description: '',
  license: '',
  compatibility: '',
}

// Canonical frontmatter order so the generated SKILL.md is stable.
const FIELD_ORDER: (keyof SkillFields)[] = [
  'name',
  'description',
  'license',
  'compatibility',
]

/** Serialize fields into a YAML frontmatter block, then append the body. */
export function assembleSkillMd(fields: SkillFields, body: string): string {
  const frontmatter: Record<string, string> = {}
  for (const key of FIELD_ORDER) {
    const value = fields[key]
    // Omit empty fields so we never emit `name: ''` — let the validator report
    // a *missing* required field rather than an empty one.
    if (value.trim() !== '') frontmatter[key] = value
  }
  const yamlText =
    Object.keys(frontmatter).length > 0 ? stringify(frontmatter) : ''
  return `---\n${yamlText}---\n\n${body}`
}

// Leading optional BOM/whitespace, an opening `---` line, the (lazy) block, then
// a closing `---` line. Mirrors the backend's tolerant frontmatter split.
const FRONTMATTER_RE = /^\uFEFF?\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/**
 * Split a SKILL.md into structured fields + body for the edit-existing case.
 * Tolerant: malformed or absent frontmatter yields empty fields and treats the
 * whole text as body, so a hand-edited file never throws on load.
 */
export function parseSkillMd(text: string): {
  fields: SkillFields
  body: string
} {
  const match = FRONTMATTER_RE.exec(text)
  if (!match) return { fields: { ...EMPTY_FIELDS }, body: text }

  let parsed: unknown
  try {
    parsed = parse(match[1])
  } catch {
    return { fields: { ...EMPTY_FIELDS }, body: text }
  }

  const fm =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')

  return {
    fields: {
      name: str(fm.name),
      description: str(fm.description),
      license: str(fm.license),
      compatibility: str(fm.compatibility),
    },
    body: text.slice(match[0].length),
  }
}
