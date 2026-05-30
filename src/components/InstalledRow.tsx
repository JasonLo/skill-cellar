import type { SkillDescriptor } from '../api/bindings'
import { ConformanceBadge } from './ConformanceBadge'

export function InstalledRow({
  skill,
  onEdit,
}: {
  skill: SkillDescriptor
  onEdit?: () => void
}) {
  return (
    <li className="row">
      <div className="row-main">
        <span className="row-name">{skill.name}</span>
        {skill.name !== skill.dir_name && (
          <span className="row-dir" title="on-disk directory">
            /{skill.dir_name}
          </span>
        )}
        {skill.description && (
          <span className="row-desc">{skill.description}</span>
        )}
      </div>
      <ConformanceBadge conformance={skill.conformance} />
      {onEdit && (
        <button type="button" className="btn-ghost" onClick={onEdit}>
          Edit in Craft
        </button>
      )}
    </li>
  )
}
