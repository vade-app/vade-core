import { createContext, useContext } from 'react'

export type CatalogState = 'closed' | 'sidebar' | 'fullpage'
export type LibraryState = 'closed' | 'open'

export interface ShellState {
  catalog: CatalogState
  library: LibraryState
  setCatalog: (next: CatalogState) => void
  setLibrary: (next: LibraryState) => void
  activeName: string | null
  dirty: boolean
}

// Provided by AppShell, consumed by MenuPanel (rendered inside
// tldraw's top-left MenuPanel slot). Lets the catalog/library
// toggles read shell state without standalone fixed-positioned
// pills that would collide with tldraw's chrome.
export const ShellContext = createContext<ShellState | null>(null)

export function useShell(): ShellState {
  const s = useContext(ShellContext)
  if (!s) throw new Error('useShell must be used inside ShellContext.Provider')
  return s
}
