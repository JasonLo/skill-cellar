import { useApp, type Tab } from '../state/AppContext'

const TABS: { id: Tab; label: string; enabled: boolean; note?: string }[] = [
  { id: 'shop', label: 'Shop', enabled: true },
  { id: 'library', label: 'Library', enabled: true },
  { id: 'usage', label: 'Usage', enabled: false, note: 'Coming in I-2' },
  { id: 'craft', label: 'Craft', enabled: false, note: 'Coming in I-3' },
]

export function Tabs() {
  const { tab, setTab } = useApp()
  return (
    <nav className="tabs" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          className={`tab ${tab === t.id ? 'tab-active' : ''}`}
          disabled={!t.enabled}
          title={t.note}
          onClick={() => t.enabled && setTab(t.id)}
        >
          {t.label}
          {!t.enabled && <span className="tab-soon">soon</span>}
        </button>
      ))}
    </nav>
  )
}
