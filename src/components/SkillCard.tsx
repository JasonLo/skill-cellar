import type { RegistryEntry } from '../api/bindings'

interface SkillCardProps {
  entry: RegistryEntry
  /** Install this entry into the active target. Omitted (e.g. outside the
   *  desktop app) leaves the button disabled. */
  onInstall?: (entry: RegistryEntry) => void
  /** True while this card's install is in flight. */
  busy?: boolean
  /** Why the button is disabled, when it is (shown as a tooltip). */
  disabledReason?: string
}

/**
 * A shop card for a registry entry. Install pulls the skill's files from its
 * repo (GitHub), validates them, then atomically installs — the same
 * validate-then-atomic-copy engine as "Install from folder…" in the Library
 * (I-1). The conformance verdict then shows up against the skill in the Library.
 */
export function SkillCard({
  entry,
  onInstall,
  busy = false,
  disabledReason,
}: SkillCardProps) {
  const disabled = !onInstall || busy
  return (
    <article className="card">
      <div className="card-head">
        <h3 className="card-name">{entry.name}</h3>
        {entry.featured && <span className="tag tag-featured">Featured</span>}
      </div>
      <p className="card-desc">{entry.description}</p>
      <div className="card-foot">
        <span className="card-repo" title={entry.repo}>
          {entry.repo}
          {entry.subdir ? `/${entry.subdir}` : ''}
        </span>
        <button
          type="button"
          className="btn"
          disabled={disabled}
          title={!onInstall ? disabledReason : undefined}
          onClick={onInstall ? () => onInstall(entry) : undefined}
        >
          {busy ? 'Installing…' : 'Install'}
        </button>
      </div>
    </article>
  )
}
