import { type Tab, useApp } from '../state/AppContext'

const TABS: { id: Tab; label: string; enabled: boolean; note?: string }[] = [
  { id: 'shop', label: 'Shop', enabled: true },
  { id: 'library', label: 'Library', enabled: true },
  { id: 'usage', label: 'Usage', enabled: true },
  { id: 'craft', label: 'Craft', enabled: false, note: 'Coming in I-3' },
]

export function Tabs() {
  const { tab, setTab } = useApp()
  return (
    <div className="tabs" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
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
    </div>
  )
}
