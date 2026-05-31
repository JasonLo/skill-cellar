import {
  FrontmatterMissingError,
  FrontmatterParseError,
  parseFrontmatter,
} from './frontmatter'
import { checkDescription, checkName, checkOptional } from './rules'
import {
  type Conformance,
  conformanceFromFindings,
  errorFinding,
} from './verdict'

export type { Frontmatter } from './frontmatter'
export { parseFrontmatter, splitFrontmatter } from './frontmatter'
export type { Conformance, Finding, Severity, Verdict } from './verdict'
export {
  conformanceFromFindings,
  errorFinding,
  hasCode,
  isInstallable,
  warningFinding,
} from './verdict'

export function evaluate(skillMd: string, parentDirName: string): Conformance {
  let fm
  try {
    fm = parseFrontmatter(skillMd)
  } catch (e) {
    if (e instanceof FrontmatterMissingError) {
      return conformanceFromFindings([
        errorFinding(
          'frontmatter',
          'frontmatter.missing',
          'SKILL.md has no YAML frontmatter block',
        ),
      ])
    }
    if (e instanceof FrontmatterParseError) {
      return conformanceFromFindings([
        errorFinding(
          'frontmatter',
          'frontmatter.parse',
          `could not parse SKILL.md frontmatter: ${e.message}`,
        ),
      ])
    }
    throw e
  }

  const findings = [
    ...checkName(fm, parentDirName),
    ...checkDescription(fm),
    ...checkOptional(fm),
  ]
  return conformanceFromFindings(findings)
}
