import { useApp } from '../state/AppContext'

/**
 * Title bar with the active install target picker: the user's global skills
 * directory, or a specific project directory. (A native folder picker for the
 * project path is a follow-on; for now the project path is shown when set.)
 */
export function TitleBar() {
  const { activeTarget, setActiveTarget } = useApp()
  const isGlobal = activeTarget.kind === 'global'

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <span className="titlebar-logo" aria-hidden="true">
          🍷
        </span>
        <span className="titlebar-title">Skill Cellar</span>
      </div>

      <div className="target-picker" role="group" aria-label="Install target">
        <button
          className={`target-option ${isGlobal ? 'target-active' : ''}`}
          aria-pressed={isGlobal}
          onClick={() => setActiveTarget({ kind: 'global' })}
        >
          Global
        </button>
        <button
          className={`target-option ${!isGlobal ? 'target-active' : ''}`}
          aria-pressed={!isGlobal}
          onClick={() =>
            setActiveTarget({ kind: 'project', path: activeTarget.kind === 'project' ? activeTarget.path : '.' })
          }
        >
          Project
        </button>
        {activeTarget.kind === 'project' && (
          <span className="target-path" title={activeTarget.path}>
            {activeTarget.path}
          </span>
        )}
      </div>
    </header>
  )
}
