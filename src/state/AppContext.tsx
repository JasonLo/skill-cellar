import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { TargetKind } from '../api/bindings'
import { api, inTauri } from '../api/client'

export type Tab = 'shop' | 'library' | 'usage' | 'craft'

/** The skill Craft should load for editing, or `null` for a new skill. */
export interface EditingSkill {
  target: TargetKind
  dirName: string
}

interface AppContextValue {
  activeTarget: TargetKind
  setActiveTarget: (t: TargetKind) => void
  tab: Tab
  setTab: (t: Tab) => void
  editing: EditingSkill | null
  setEditing: (e: EditingSkill | null) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  // Default to the user's global skills directory.
  const [activeTarget, setActiveTargetState] = useState<TargetKind>({
    kind: 'global',
  })
  const [tab, setTab] = useState<Tab>('shop')
  const [editing, setEditing] = useState<EditingSkill | null>(null)

  const setActiveTarget = useCallback((t: TargetKind) => {
    setActiveTargetState(t)
    // Best-effort: tell the backend, but never block the UI on it.
    if (inTauri()) void api.setActiveTarget(t).catch(() => {})
  }, [])

  const value = useMemo(
    () => ({ activeTarget, setActiveTarget, tab, setTab, editing, setEditing }),
    [activeTarget, setActiveTarget, tab, editing],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within an AppProvider')
  return ctx
}
