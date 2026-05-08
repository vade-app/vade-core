import { useCallback, useEffect, useMemo, useState } from 'react'
import { Tldraw, type Editor, type TLAssetStore, type TLUiComponents } from 'tldraw'
import 'tldraw/tldraw.css'
import { customShapeUtils, version as registryVersion } from '../shapes'
import { Sidebar } from '../catalog/Sidebar'
import { FullPage } from '../catalog/FullPage'
import { CanvasDropTarget } from '../catalog/CanvasDropTarget'
import { LibraryPanel } from '../library/LibraryPanel'
import { useAutosave } from '../library/useAutosave'
import { SelectedShapePanel } from '../shape-panel/SelectedShapePanel'
import { useActiveCanvas } from './useActiveCanvas'
import { ShellContext, type CatalogState, type LibraryState, type ShellState } from './ShellContext'

interface AppShellProps {
  assetStore: TLAssetStore
  licenseKey?: string
  components?: TLUiComponents
  onMount: (editor: Editor) => void
}

// Top-level shell composing the canvas, the catalog (left sidebar +
// fullpage overlay), the library panel (right sidebar with snapshot
// history), the selected-shape param panel, and the catalog/library
// toggle chips that live inside tldraw's SharePanel slot
// (TopRightSlot).
//
// Owns:
// - Catalog state (closed | sidebar | fullpage)
// - Library state (closed | open)
// - Editor handle (set in Tldraw onMount, then forwarded to caller)
// - Active canvas + dirty (via useActiveCanvas hook)
// - Per-canvas persistenceKey (vade-canvas-${slug ?? 'main'})
//
// Catalog/Library chips read this state via ShellContext rather
// than rendering as standalone fixed-positioned pills, so they
// integrate cleanly with tldraw's chrome.
//
// Capture-phase ESC handler steps panels down by depth:
//   fullpage → sidebar → closed; library → closed.
// Falls through to tldraw's own ESC (selection clear) when no
// panel is open.
export function AppShell({ assetStore, licenseKey, components, onMount }: AppShellProps) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [catalog, setCatalog] = useState<CatalogState>('closed')
  const [library, setLibrary] = useState<LibraryState>('closed')

  const { active, setActive, dirty, resetDirty } = useActiveCanvas(editor)

  // Continuous autosave to the head of the active canvas. No-op
  // when active is null — we don't autosave untitled work.
  useAutosave(editor, active, {
    debounceMs: 800,
    onSaved: resetDirty,
  })

  // Capture-phase ESC: close highest-depth panel; fall through to
  // tldraw at level 0. Window-level so focused inputs in panels
  // (e.g. the search box) don't intercept first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (catalog === 'fullpage') {
        e.preventDefault()
        e.stopPropagation()
        setCatalog('sidebar')
        return
      }
      if (catalog === 'sidebar') {
        e.preventDefault()
        e.stopPropagation()
        setCatalog('closed')
        return
      }
      if (library === 'open') {
        e.preventDefault()
        e.stopPropagation()
        setLibrary('closed')
        return
      }
      // No panel open — let tldraw handle ESC (selection clear, etc).
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [catalog, library])

  const handleMount = useCallback(
    (ed: Editor) => {
      setEditor(ed)
      onMount(ed)
    },
    [onMount],
  )

  // Single persistenceKey across canvases. Per-canvas persistenceKey
  // looked attractive (isolated camera/zoom per canvas) but conflicts
  // with R2-backed canvas switching: loadStoreSnapshot applies the
  // R2 snapshot to the in-memory tldraw, then setActive flips
  // persistenceKey, then Tldraw remounts and hydrates from the new
  // (empty) IndexedDB key, blanking the just-loaded canvas. Stick
  // with one bucket; loadStoreSnapshot is the single source of truth
  // on canvas switch.
  const persistenceKey = 'vade-main'

  const shellState = useMemo<ShellState>(
    () => ({
      catalog,
      library,
      setCatalog,
      setLibrary,
      activeName: active?.name ?? null,
      dirty,
    }),
    [catalog, library, active, dirty],
  )

  return (
    <ShellContext.Provider value={shellState}>
      <div style={{ position: 'fixed', inset: 0 }}>
        <CanvasDropTarget editor={editor}>
          <Tldraw
            key={registryVersion}
            persistenceKey={persistenceKey}
            shapeUtils={customShapeUtils}
            assets={assetStore}
            {...(components ? { components } : {})}
            {...(licenseKey ? { licenseKey } : {})}
            onMount={handleMount}
          />
        </CanvasDropTarget>

        {catalog === 'sidebar' && (
          <Sidebar
            onClose={() => setCatalog('closed')}
            onExpand={() => setCatalog('fullpage')}
          />
        )}

        {catalog === 'fullpage' && <FullPage onClose={() => setCatalog('sidebar')} />}

        {library === 'open' && editor && (
          <LibraryPanel
            editor={editor}
            active={active}
            onActiveChange={(next) => setActive(next)}
            onClose={() => setLibrary('closed')}
          />
        )}

        <SelectedShapePanel editor={editor} />
      </div>
    </ShellContext.Provider>
  )
}
