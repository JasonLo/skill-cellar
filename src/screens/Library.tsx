import { useKeyboard } from '@opentui/react'
import { useEffect, useMemo, useState } from 'react'
import { ConformanceBadge } from '../components/ConformanceBadge'
import {
  discover,
  discoverPlugins,
  type PluginSkillDescriptor,
  type SkillDescriptor,
} from '../core/fs-skills'
import { joinInstalled, type UsageReport, usageReport } from '../core/usage'
import {
  globalSkillsRoot,
  pluginSkillsRoot,
  projectSkillsRoot,
  transcriptsRoot,
} from '../lib/paths'

type Sort = 'name' | 'count'
type Source = 'project' | 'global' | 'plugin'

interface Row {
  descriptor: SkillDescriptor
  count: number
  source: Source
  /** Owning plugin name; present only for `plugin` rows. */
  plugin?: string
}

interface Data {
  rows: Row[]
  projectCount: number
  globalCount: number
  pluginCount: number
}

function loadData(): Data {
  const project = safeDiscover(projectSkillsRoot())
  const global = safeDiscover(globalSkillsRoot())
  const plugin = safeDiscoverPlugins(pluginSkillsRoot())
  const report: UsageReport = safeUsage(transcriptsRoot())
  const installed = [
    ...project.map((d) => d.name),
    ...global.map((d) => d.name),
    ...plugin.map((d) => d.name),
  ]
  const totals = new Map(
    joinInstalled(report, installed).map((u) => [u.skill, u.total]),
  )
  const rows: Row[] = [
    ...project.map((d) => ({
      descriptor: d,
      count: totals.get(d.name) ?? 0,
      source: 'project' as const,
    })),
    ...global.map((d) => ({
      descriptor: d,
      count: totals.get(d.name) ?? 0,
      source: 'global' as const,
    })),
    ...plugin.map((d) => ({
      descriptor: d,
      count: totals.get(d.name) ?? 0,
      source: 'plugin' as const,
      plugin: d.plugin,
    })),
  ]
  return {
    rows,
    projectCount: project.length,
    globalCount: global.length,
    pluginCount: plugin.length,
  }
}

function safeDiscover(root: string): SkillDescriptor[] {
  try {
    return discover(root)
  } catch {
    return []
  }
}

function safeDiscoverPlugins(root: string): PluginSkillDescriptor[] {
  try {
    return discoverPlugins(root)
  } catch {
    return []
  }
}

function safeUsage(root: string): UsageReport {
  try {
    return usageReport(root)
  } catch {
    return { projects: [] }
  }
}

export function Library({ onHint }: { onHint: (hint: string) => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [selected, setSelected] = useState(0)
  const [sort, setSort] = useState<Sort>('name')

  useEffect(() => {
    setData(loadData())
  }, [])

  useEffect(() => {
    onHint('↑/↓ select • s cycle sort • r reload')
  }, [onHint])

  const sortedRows = useMemo(() => {
    if (data === null) return []
    return sortRows(data.rows, sort)
  }, [data, sort])

  useKeyboard((e) => {
    if (e.name === 'up' || e.name === 'k') {
      setSelected((i) => Math.max(0, i - 1))
    } else if (e.name === 'down' || e.name === 'j') {
      setSelected((i) => Math.min(Math.max(0, sortedRows.length - 1), i + 1))
    } else if (e.name === 's') {
      setSort((s) => (s === 'name' ? 'count' : 'name'))
    } else if (e.name === 'r') {
      setData(loadData())
      setSelected(0)
    }
  })

  if (data === null) {
    return (
      <box>
        <text fg="#888888">Reading installed skills…</text>
      </box>
    )
  }

  if (sortedRows.length === 0) {
    return (
      <box flexDirection="column">
        <text>Library — empty</text>
        <text fg="#888888">
          No skills in project ({projectSkillsRoot()}), global (
          {globalSkillsRoot()}), or plugins ({pluginSkillsRoot()}).
        </text>
        <text fg="#888888">Visit the Market tab to install one.</text>
      </box>
    )
  }

  const selectedRow = sortedRows[selected] ?? sortedRows[0]
  const projectRows = sortedRows.filter((r) => r.source === 'project')
  const globalRows = sortedRows.filter((r) => r.source === 'global')
  const pluginRows = sortedRows.filter((r) => r.source === 'plugin')
  let runningIdx = 0

  return (
    <box flexDirection="column" width="100%" height="100%">
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text>
          Library — {data.projectCount} project, {data.globalCount} global,{' '}
          {data.pluginCount} plugin
        </text>
        <text fg="#888888">sort: {sort}</text>
      </box>
      <box flexDirection="row" flexGrow={1}>
        <box
          flexDirection="column"
          width="55%"
          border
          borderColor="#3a3a3a"
          padding={1}
          title="Installed"
        >
          {projectRows.length > 0 && <text fg="#ffcc66">── Project ──</text>}
          {projectRows.map((row) => {
            const i = runningIdx++
            return (
              <SkillLine
                key={`p-${row.descriptor.path}`}
                row={row}
                active={i === selected}
              />
            )
          })}
          {globalRows.length > 0 && <text fg="#ffcc66">── Global ──</text>}
          {globalRows.map((row) => {
            const i = runningIdx++
            return (
              <SkillLine
                key={`g-${row.descriptor.path}`}
                row={row}
                active={i === selected}
              />
            )
          })}
          {pluginRows.length > 0 && (
            <text fg="#ffcc66">── Plugin (read-only) ──</text>
          )}
          {pluginRows.map((row) => {
            const i = runningIdx++
            return (
              <SkillLine
                key={`pl-${row.descriptor.path}`}
                row={row}
                active={i === selected}
              />
            )
          })}
        </box>
        <box
          flexDirection="column"
          width="45%"
          border
          borderColor="#3a3a3a"
          padding={1}
          title="Details"
        >
          {selectedRow ? <RowDetail row={selectedRow} /> : null}
        </box>
      </box>
    </box>
  )
}

function SkillLine({ row, active }: { row: Row; active: boolean }) {
  const usage = row.count > 0 ? `${row.count}×` : '—'
  return (
    <box flexDirection="row">
      <text fg={active ? '#ffcc66' : '#cccccc'}>
        {active ? '▶ ' : '  '}
        {row.descriptor.name}
      </text>
      <text fg="#666666"> </text>
      <ConformanceBadge verdict={row.descriptor.conformance.verdict} />
      <text fg="#888888"> {usage}</text>
    </box>
  )
}

function RowDetail({ row }: { row: Row }) {
  const d = row.descriptor
  return (
    <box flexDirection="column">
      <text>
        <strong>{d.name}</strong>
      </text>
      <text fg="#aaaaaa">{d.description ?? '(no description)'}</text>
      <box paddingTop={1} flexDirection="column">
        <text fg="#888888">source: {row.source}</text>
        {row.plugin !== undefined && (
          <text fg="#888888">plugin: {row.plugin}</text>
        )}
        <text fg="#888888">path: {d.path}</text>
        <text fg="#888888">invocations: {row.count}</text>
        <box flexDirection="row">
          <text fg="#888888">conformance: </text>
          <ConformanceBadge verdict={d.conformance.verdict} />
        </box>
      </box>
      {d.conformance.findings.length > 0 && (
        <box paddingTop={1} flexDirection="column">
          <text fg="#aaaaaa">findings:</text>
          {d.conformance.findings.slice(0, 6).map((f) => (
            <text
              key={f.code}
              fg={f.severity === 'error' ? '#d96a6a' : '#f5c46b'}
            >
              • [{f.field}] {f.message}
            </text>
          ))}
        </box>
      )}
    </box>
  )
}

function sortRows(rows: Row[], sort: Sort): Row[] {
  const groups: Record<Source, Row[]> = {
    project: [],
    global: [],
    plugin: [],
  }
  for (const r of rows) groups[r.source].push(r)
  const cmp =
    sort === 'name'
      ? (a: Row, b: Row): number =>
          a.descriptor.name.localeCompare(b.descriptor.name)
      : (a: Row, b: Row): number =>
          b.count - a.count ||
          a.descriptor.name.localeCompare(b.descriptor.name)
  groups.project.sort(cmp)
  groups.global.sort(cmp)
  groups.plugin.sort(cmp)
  return [...groups.project, ...groups.global, ...groups.plugin]
}
