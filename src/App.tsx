import { useKeyboard } from '@opentui/react'
import { useState } from 'react'
import { Library } from './screens/Library'
import { Market } from './screens/Market'
import { Settings } from './screens/Settings'

type Tab = 'market' | 'library' | 'settings'

const TABS: { id: Tab; label: string; key: string }[] = [
  { id: 'market', label: 'Market', key: '1' },
  { id: 'library', label: 'Library', key: '2' },
  { id: 'settings', label: 'Settings', key: '3' },
]

export function App() {
  const [tab, setTab] = useState<Tab>('market')
  const [hint, setHint] = useState('')

  useKeyboard((e) => {
    if (e.name === '1') setTab('market')
    else if (e.name === '2') setTab('library')
    else if (e.name === '3') setTab('settings')
    else if (e.name === 'tab') {
      const i = TABS.findIndex((t) => t.id === tab)
      const next = e.shift
        ? TABS[(i - 1 + TABS.length) % TABS.length]
        : TABS[(i + 1) % TABS.length]
      setTab(next.id)
    } else if (e.name === 'q' && !e.ctrl && !e.meta) {
      process.exit(0)
    }
  })

  return (
    <box flexDirection="column" width="100%" height="100%">
      <TabBar active={tab} />
      <box flexGrow={1} padding={1}>
        {tab === 'market' && <Market onHint={setHint} />}
        {tab === 'library' && <Library onHint={setHint} />}
        {tab === 'settings' && <Settings onHint={setHint} />}
      </box>
      <Footer hint={hint} />
    </box>
  )
}

function TabBar({ active }: { active: Tab }) {
  return (
    <box
      flexDirection="row"
      paddingLeft={1}
      paddingRight={1}
      backgroundColor="#1a1a1a"
    >
      <text fg="#7fd17f">🍷 skill-cellar</text>
      <text fg="#666666"> │ </text>
      {TABS.map((t, i) => {
        const isActive = t.id === active
        return (
          <text
            key={t.id}
            fg={isActive ? '#1a1a1a' : '#cccccc'}
            bg={isActive ? '#ffcc66' : '#1a1a1a'}
          >
            {i === 0 ? '' : ' '} [{t.key}] {t.label}{' '}
          </text>
        )
      })}
    </box>
  )
}

function Footer({ hint }: { hint: string }) {
  const fallback = 'Tab/Shift-Tab switch • 1/2/3 jump • q quit'
  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      backgroundColor="#1a1a1a"
      flexDirection="row"
    >
      <text fg="#888888">{hint || fallback}</text>
    </box>
  )
}
