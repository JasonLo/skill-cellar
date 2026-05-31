import type { Frontmatter } from './frontmatter'
import { type Finding, errorFinding, warningFinding } from './verdict'

const NAME_MAX = 64
const DESC_MAX = 1024
const COMPAT_MAX = 500

export function checkName(fm: Frontmatter, parentDir: string): Finding[] {
  const out: Finding[] = []
  const name = fm.name
  if (name === undefined) {
    out.push(
      errorFinding(
        'name',
        'name.missing',
        'frontmatter is missing the required `name` field',
      ),
    )
    return out
  }
  if (name === '') {
    out.push(errorFinding('name', 'name.empty', '`name` must not be empty'))
    return out
  }

  if ([...name].length > NAME_MAX) {
    out.push(
      errorFinding(
        'name',
        'name.too_long',
        `\`name\` must be at most ${NAME_MAX} characters`,
      ),
    )
  }

  const validChars = /^[a-z0-9-]+$/.test(name)
  const badEdges = name.startsWith('-') || name.endsWith('-')
  const consecutive = name.includes('--')
  if (!validChars || badEdges || consecutive) {
    out.push(
      errorFinding(
        'name',
        'name.format',
        '`name` must be lowercase letters, digits, and single hyphens (no leading, trailing, or consecutive hyphens)',
      ),
    )
  }

  if (name !== parentDir) {
    out.push(
      errorFinding(
        'name',
        'name.dir_mismatch',
        `\`name\` ('${name}') must match the parent directory name ('${parentDir}')`,
      ),
    )
  }

  return out
}

export function checkDescription(fm: Frontmatter): Finding[] {
  const out: Finding[] = []
  const d = fm.description
  if (d === undefined) {
    out.push(
      errorFinding(
        'description',
        'description.missing',
        'frontmatter is missing the required `description` field',
      ),
    )
  } else if (d.trim() === '') {
    out.push(
      errorFinding(
        'description',
        'description.empty',
        '`description` must not be empty',
      ),
    )
  } else if ([...d].length > DESC_MAX) {
    out.push(
      errorFinding(
        'description',
        'description.too_long',
        `\`description\` must be at most ${DESC_MAX} characters`,
      ),
    )
  }
  return out
}

export function checkOptional(fm: Frontmatter): Finding[] {
  const out: Finding[] = []
  if (fm.compatibility !== undefined) {
    if ([...fm.compatibility].length > COMPAT_MAX) {
      out.push(
        warningFinding(
          'compatibility',
          'compatibility.too_long',
          `\`compatibility\` should be at most ${COMPAT_MAX} characters`,
        ),
      )
    }
  }
  if (fm.metadata !== undefined) {
    const allStrings = Object.values(fm.metadata).every(
      (v) => typeof v === 'string',
    )
    if (!allStrings) {
      out.push(
        warningFinding(
          'metadata',
          'metadata.non_string',
          '`metadata` values should all be strings',
        ),
      )
    }
  }
  return out
}
