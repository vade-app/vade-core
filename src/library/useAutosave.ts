import { useEffect, useRef } from 'react'
import { type Editor, getSnapshot } from 'tldraw'
import { saveCanvas } from '../lib/library'

interface ActiveCanvas {
  slug: string
  name: string
  tags?: string[]
  description?: string
}

interface AutosaveOptions {
  debounceMs?: number
  onError?: (err: unknown) => void
  onSaved?: () => void
}

// Subscribes to user-initiated document-scope changes on the tldraw
// editor and debounces a saveCanvas call for the active canvas. No-op
// when active is null. The debounce is per-instance — switching the
// active canvas drops in-flight timers (cancelled on cleanup).
//
// Persistence model: continuous autosave writes the canvas's HEAD only
// (canvases/<slug>/snapshot.tldr). Named snapshots are explicit
// (saveSnapshot route + SaveDialog).
export function useAutosave(
  editor: Editor | null,
  active: ActiveCanvas | null,
  options: AutosaveOptions = {},
): void {
  const debounceMs = options.debounceMs ?? 800
  const optsRef = useRef(options)
  optsRef.current = options

  useEffect(() => {
    if (!editor || !active) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const flush = () => {
      if (cancelled) return
      const snapshot = getSnapshot(editor.store)
      saveCanvas(
        active.name,
        snapshot,
        active.tags ?? [],
        active.description ?? '',
      )
        .then(() => optsRef.current.onSaved?.())
        .catch((err) => optsRef.current.onError?.(err))
    }

    const off = editor.store.listen(
      () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(flush, debounceMs)
      },
      { scope: 'document', source: 'user' },
    )

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      off()
    }
  }, [editor, active, debounceMs])
}
