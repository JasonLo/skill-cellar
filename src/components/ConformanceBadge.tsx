import type { Conformance, Verdict } from '../api/bindings'

const PRESENTATION: Record<
  Verdict,
  { icon: string; label: string; cls: string }
> = {
  valid: { icon: '✓', label: 'Valid', cls: 'badge badge-valid' },
  warnings: { icon: '!', label: 'Warnings', cls: 'badge badge-warnings' },
  invalid: { icon: '✕', label: 'Invalid', cls: 'badge badge-invalid' },
}

/**
 * Renders a conformance verdict. Never color-only — always icon + text — for
 * accessibility. Findings are surfaced in the title (hover) tooltip.
 */
export function ConformanceBadge({
  conformance,
}: {
  conformance: Conformance
}) {
  const p = PRESENTATION[conformance.verdict]
  const count = conformance.findings.length
  const tooltip =
    count === 0
      ? 'No conformance issues'
      : conformance.findings
          .map((f) => `${f.severity}: ${f.message}`)
          .join('\n')

  return (
    <span className={p.cls} title={tooltip}>
      <span aria-hidden="true">{p.icon}</span>
      <span>
        {p.label}
        {conformance.verdict !== 'valid' && count > 0 ? ` (${count})` : ''}
      </span>
    </span>
  )
}
