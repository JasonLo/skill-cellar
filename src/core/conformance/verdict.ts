export type Verdict = 'valid' | 'warnings' | 'invalid'

export type Severity = 'error' | 'warning'

export interface Finding {
  field: string
  severity: Severity
  code: string
  message: string
}

export function errorFinding(
  field: string,
  code: string,
  message: string,
): Finding {
  return { field, severity: 'error', code, message }
}

export function warningFinding(
  field: string,
  code: string,
  message: string,
): Finding {
  return { field, severity: 'warning', code, message }
}

export interface Conformance {
  verdict: Verdict
  findings: Finding[]
}

export function conformanceFromFindings(findings: Finding[]): Conformance {
  if (findings.some((f) => f.severity === 'error')) {
    return { verdict: 'invalid', findings }
  }
  if (findings.length === 0) {
    return { verdict: 'valid', findings }
  }
  return { verdict: 'warnings', findings }
}

export function isInstallable(c: Conformance): boolean {
  return c.verdict !== 'invalid'
}

export function hasCode(c: Conformance, code: string): boolean {
  return c.findings.some((f) => f.code === code)
}
