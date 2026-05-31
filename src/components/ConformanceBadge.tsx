import type { Verdict } from '../core/conformance'

const STYLES: Record<Verdict, { label: string; fg: string; bg: string }> = {
  valid: { label: ' VALID ', fg: '#000000', bg: '#7fd17f' },
  warnings: { label: ' WARN  ', fg: '#000000', bg: '#f5c46b' },
  invalid: { label: ' INVAL ', fg: '#ffffff', bg: '#d96a6a' },
}

export function ConformanceBadge({ verdict }: { verdict: Verdict }) {
  const s = STYLES[verdict]
  return (
    <text fg={s.fg} bg={s.bg}>
      {s.label}
    </text>
  )
}
