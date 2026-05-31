import { useKeyboard } from '@opentui/react'
import { useEffect, useState } from 'react'
import {
  readSettings,
  type Settings as S,
  writeSettings,
} from '../lib/settings'

/**
 * Privacy guarantee text, sourced verbatim from intent I-4 outcome 2:
 * the contract for *what* sync includes when enabled. Displayed adjacent
 * to the toggle so the user can see exactly what they're opting into.
 */
const PRIVACY_TEXT =
  'When sync is enabled, only usage metadata is transmitted: skill names, ' +
  'invocation counts, timestamps, and app/skill versions. Transcript ' +
  'content, prompts, file contents, and filesystem paths are never sent.'

export function Settings({ onHint }: { onHint: (hint: string) => void }) {
  const [settings, setSettings] = useState<S>(() => readSettings())
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    onHint('Space toggle sync • r reset to defaults')
  }, [onHint])

  useKeyboard((e) => {
    if (e.name === 'space') {
      const next = { ...settings, syncEnabled: !settings.syncEnabled }
      writeSettings(next)
      setSettings(next)
      setSavedAt(Date.now())
    } else if (e.name === 'r') {
      const next: S = { syncEnabled: false }
      writeSettings(next)
      setSettings(next)
      setSavedAt(Date.now())
    }
  })

  return (
    <box flexDirection="column" width="100%" height="100%">
      <text>Settings</text>
      <box paddingTop={1} flexDirection="column">
        <box flexDirection="row">
          <text>Sync (cross-device usage metadata): </text>
          <text
            fg={settings.syncEnabled ? '#000000' : '#ffffff'}
            bg={settings.syncEnabled ? '#7fd17f' : '#666666'}
          >
            {settings.syncEnabled ? ' ON  ' : ' OFF '}
          </text>
          <text fg="#666666"> (press Space)</text>
        </box>
      </box>
      <box
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        border
        borderColor="#3a3a3a"
        padding={1}
        title="Privacy guarantee"
      >
        <text fg="#aaaaaa">{PRIVACY_TEXT}</text>
      </box>
      <box paddingTop={1} flexDirection="column">
        <text fg="#888888">Notes</text>
        <text fg="#888888">
          • Sync is off by default and the app remains fully offline-functional
          either way.
        </text>
        <text fg="#888888">
          • This release persists the toggle locally; the network transport for
          sync ships in a follow-up.
        </text>
        {savedAt !== null && (
          <text fg="#7fd17f">
            ✓ saved at {new Date(savedAt).toLocaleTimeString()}
          </text>
        )}
      </box>
    </box>
  )
}
