import type { RegistryEntry } from '../api/bindings'

/**
 * A shop card for a registry entry. Live install pulls the skill from its repo,
 * validates it, then atomically installs — that GitHub-fetch path is the
 * follow-on to I-1 (the install/validate/atomic-copy engine is already done and
 * tested in the core). Until then the button is disabled with a note, and the
 * conformance verdict shows up in the Library once a skill is installed.
 */
export function SkillCard({ entry }: { entry: RegistryEntry }) {
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
          disabled
          title="Live install (GitHub fetch) lands in the next milestone. To install now, use “Install from folder…” in the Library — same validate + atomic-copy engine."
        >
          Install
        </button>
      </div>
    </article>
  )
}
