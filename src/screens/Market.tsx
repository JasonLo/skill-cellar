import { useKeyboard } from '@opentui/react'
import { useEffect, useState } from 'react'
import {
  getRegistry,
  type RegistryEntry,
  type RegistryResult,
} from '../core/registry'
import {
  configuredRegistryUrl,
  downloadAndInstall,
  makeRegistryFetcher,
} from '../lib/fetchers'
import { appDataDir, globalSkillsRoot, projectSkillsRoot } from '../lib/paths'

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: RegistryResult }
  | { kind: 'error'; message: string }

type InstallStatus =
  | { kind: 'idle' }
  | { kind: 'installing'; name: string }
  | { kind: 'done'; name: string }
  | { kind: 'failed'; name: string; message: string }

export function Market({ onHint }: { onHint: (hint: string) => void }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [selected, setSelected] = useState(0)
  const [target, setTarget] = useState<'project' | 'global'>('project')
  const [install, setInstall] = useState<InstallStatus>({ kind: 'idle' })

  useEffect(() => {
    let cancelled = false
    setStatus({ kind: 'loading' })
    void (async () => {
      try {
        const fetcher = await makeRegistryFetcher(configuredRegistryUrl())
        const result = getRegistry(fetcher, appDataDir())
        if (!cancelled) setStatus({ kind: 'ready', result })
      } catch (e) {
        if (!cancelled) {
          setStatus({
            kind: 'error',
            message: e instanceof Error ? e.message : String(e),
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const entries: RegistryEntry[] =
    status.kind === 'ready' ? status.result.manifest.entries : []

  useEffect(() => {
    if (install.kind === 'installing') {
      onHint(`installing ${install.name}…`)
    } else if (install.kind === 'done') {
      onHint(`installed: ${install.name} (switch to Library to confirm)`)
    } else if (install.kind === 'failed') {
      onHint(`install failed: ${install.message}`)
    } else {
      onHint('↑/↓ select • Enter install • g toggle project/global • r refresh')
    }
  }, [install, onHint])

  useKeyboard((e) => {
    if (status.kind !== 'ready' || entries.length === 0) return
    if (install.kind === 'installing') return
    if (e.name === 'up' || e.name === 'k') {
      setSelected((i) => Math.max(0, i - 1))
    } else if (e.name === 'down' || e.name === 'j') {
      setSelected((i) => Math.min(entries.length - 1, i + 1))
    } else if (e.name === 'g') {
      setTarget((t) => (t === 'project' ? 'global' : 'project'))
    } else if (e.name === 'return') {
      const entry = entries[selected]
      if (!entry) return
      const root =
        target === 'project' ? projectSkillsRoot() : globalSkillsRoot()
      setInstall({ kind: 'installing', name: entry.name })
      void (async () => {
        try {
          await downloadAndInstall(entry, root)
          setInstall({ kind: 'done', name: entry.name })
        } catch (err) {
          setInstall({
            kind: 'failed',
            name: entry.name,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      })()
    }
  })

  if (status.kind === 'loading' || status.kind === 'idle') {
    return (
      <box>
        <text fg="#888888">Loading registry…</text>
      </box>
    )
  }
  if (status.kind === 'error') {
    return (
      <box>
        <text fg="#d96a6a">Registry error: {status.message}</text>
      </box>
    )
  }

  const source = status.result.source
  const sourceLabel =
    source === 'network'
      ? 'live'
      : source === 'cache'
        ? 'offline (cached)'
        : 'offline (bundled)'
  const sourceColor = source === 'network' ? '#7fd17f' : '#f5c46b'

  const selectedEntry = entries[selected]

  return (
    <box flexDirection="column" width="100%" height="100%">
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text>
          Market — {entries.length} skill{entries.length === 1 ? '' : 's'}
        </text>
        <text fg={sourceColor}>{sourceLabel}</text>
      </box>
      <box flexDirection="row" flexGrow={1}>
        <box
          flexDirection="column"
          width="50%"
          border
          borderColor="#3a3a3a"
          padding={1}
          title="Catalog"
        >
          {entries.map((entry, idx) => (
            <box key={entry.name} flexDirection="row">
              <text fg={idx === selected ? '#ffcc66' : '#cccccc'}>
                {idx === selected ? '▶ ' : '  '}
                {entry.featured ? '★ ' : '  '}
                {entry.name}
              </text>
            </box>
          ))}
        </box>
        <box
          flexDirection="column"
          width="50%"
          border
          borderColor="#3a3a3a"
          padding={1}
          title="Details"
        >
          {selectedEntry ? (
            <Detail entry={selectedEntry} target={target} />
          ) : (
            <text fg="#888888">No entry selected.</text>
          )}
        </box>
      </box>
    </box>
  )
}

function Detail({
  entry,
  target,
}: {
  entry: RegistryEntry
  target: 'project' | 'global'
}) {
  return (
    <box flexDirection="column">
      <text>
        <strong>{entry.name}</strong>
      </text>
      <text fg="#aaaaaa">{entry.description}</text>
      <box paddingTop={1} flexDirection="column">
        <text fg="#888888">repo: {entry.repo}</text>
        {entry.subdir ? <text fg="#888888">subdir: {entry.subdir}</text> : null}
        <text fg="#888888">ref: {entry.gitRef ?? 'default branch'}</text>
        <text fg="#888888">featured: {entry.featured ? 'yes' : 'no'}</text>
      </box>
      <box paddingTop={1}>
        <text>
          install target:{' '}
          <em fg="#ffcc66">{target === 'project' ? 'project' : 'global'}</em>
          {'  '}
          <span fg="#666666">(press g to toggle)</span>
        </text>
      </box>
    </box>
  )
}
