import { useCallback, useEffect, useState } from 'react'
import { type Editor } from 'tldraw'

const ACTIVE_CANVAS_KEY = 'vade-active-canvas'

export interface ActiveCanvas {
  slug: string
  name: string
}

interface UseActiveCanvasResult {
  active: ActiveCanvas | null
  setActive: (next: ActiveCanvas | null) => void
  dirty: boolean
  resetDirty: () => void
}

function readActive(): ActiveCanvas | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ACTIVE_CANVAS_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { slug?: unknown; name?: unknown }
    if (typeof v.slug === 'string' && typeof v.name === 'string') {
      return { slug: v.slug, name: v.name }
    }
  } catch {
    // ignore
  }
  return null
}

function writeActive(active: ActiveCanvas | null): void {
  if (typeof window === 'undefined') return
  try {
    if (active) {
      window.localStorage.setItem(ACTIVE_CANVAS_KEY, JSON.stringify(active))
    } else {
      window.localStorage.removeItem(ACTIVE_CANVAS_KEY)
    }
  } catch {
    // ignore
  }
}

// Owns the active-canvas pointer (localStorage persisted) and
// the dirty flag (flipped on user-initiated document-scope store
// changes). Lifted out of the legacy CanvasSwitcher modal so that
// LibraryPanel + useAutosave + the chip status indicator can all
// share the same source of truth in Pillar 5.
//
// `dirty` resets when:
//   - active changes (switching to a different canvas)
//   - resetDirty() is called explicitly (after a successful save)
export function useActiveCanvas(editor: Editor | null): UseActiveCanvasResult {
  const [active, setActiveState] = useState<ActiveCanvas | null>(() => readActive())
  const [dirty, setDirty] = useState(false)

  const setActive = useCallback((next: ActiveCanvas | null) => {
    setActiveState(next)
    writeActive(next)
    setDirty(false)
  }, [])

  const resetDirty = useCallback(() => setDirty(false), [])

  useEffect(() => {
    if (!editor) return
    const off = editor.store.listen(
      () => setDirty(true),
      { scope: 'document', source: 'user' },
    )
    return off
  }, [editor])

  return { active, setActive, dirty, resetDirty }
}
