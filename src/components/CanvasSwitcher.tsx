import { useEffect, useMemo, useState } from 'react'
import { type Editor, useEditor } from 'tldraw'
import {
  type CanvasMeta,
  LibraryAuthError,
  deleteCanvas,
  getCanvas,
  listCanvases,
  saveCanvas,
  slugify,
} from '../lib/library'

const ACTIVE_CANVAS_KEY = 'vade-active-canvas'

type ActiveCanvas = { slug: string; name: string } | null

function readActive(): ActiveCanvas {
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

function writeActive(active: ActiveCanvas): void {
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

function fmtModified(iso: string): string {
  try {
    const d = new Date(iso)
    const now = Date.now()
    const diff = now - d.getTime()
    const day = 24 * 60 * 60 * 1000
    if (diff < day) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (diff < 7 * day) return d.toLocaleDateString([], { weekday: 'short' })
    return d.toLocaleDateString()
  } catch {
    return iso
  }
}

// Entry point wired into <Tldraw components={{ SharePanel: CanvasSwitcher }} />.
// Rendering inside tldraw's own chrome (top-right SharePanel slot) means the
// chip can't collide with the Main Menu dropdown, style panel, or any other
// tldraw popover — tldraw owns the layout.
export function CanvasSwitcher() {
  const editor = useEditor()
  return <CanvasSwitcherInner editor={editor} />
}

function CanvasSwitcherInner({ editor }: { editor: Editor }) {
  const [active, setActive] = useState<ActiveCanvas>(() => readActive())
  const [dirty, setDirty] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    writeActive(active)
  }, [active])

  // Dirty tracking: flip on any user-initiated document-scope change.
  useEffect(() => {
    const off = editor.store.listen(
      () => {
        setDirty(true)
      },
      { scope: 'document', source: 'user' },
    )
    return off
  }, [editor])

  const handleError = (err: unknown): string => {
    // A 401 from /library/* does NOT mean the operator token is bad —
    // it means the Worker hasn't been granted library auth for this
    // token (OPERATOR_TOKENS secret unset or missing this token). The
    // MCP auth path is independent and still works. Do not clear the
    // token; surface the configuration issue instead.
    if (err instanceof LibraryAuthError) {
      return 'Library unavailable (401). Worker needs OPERATOR_TOKENS — see docs/auth.md.'
    }
    if (err instanceof Error) return err.message
    return String(err)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          // Inline flow inside tldraw's SharePanel slot. No `position: fixed`;
          // tldraw's layout owns the position, so the chip cannot overlap
          // tldraw's Main Menu popover / style panel / anything else.
          pointerEvents: 'all',
          maxWidth: 280,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 10,
          border: '1px solid rgba(69, 71, 90, 0.6)',
          background: 'rgba(30, 30, 46, 0.85)',
          color: '#cdd6f4',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
        title="Open canvas library"
      >
        <span style={{ color: '#6c7086' }}>Canvas:</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 200,
          }}
        >
          {active?.name ?? 'untitled'}
        </span>
        {dirty && (
          <span
            aria-label="unsaved changes"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#f9e2af',
              flexShrink: 0,
            }}
          />
        )}
      </button>

      {open && (
        <SwitcherModal
          editor={editor}
          active={active}
          dirty={dirty}
          onClose={() => setOpen(false)}
          onActivate={(next, newDirty) => {
            setActive(next)
            setDirty(newDirty)
          }}
          handleError={handleError}
        />
      )}
    </>
  )
}

function SwitcherModal({
  editor,
  active,
  dirty,
  onClose,
  onActivate,
  handleError,
}: {
  editor: Editor
  active: ActiveCanvas
  dirty: boolean
  onClose: () => void
  onActivate: (next: ActiveCanvas, dirty: boolean) => void
  handleError: (err: unknown) => string
}) {
  const [canvases, setCanvases] = useState<CanvasMeta[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useMemo(
    () => async () => {
      setLoading(true)
      setErr(null)
      try {
        const list = await listCanvases()
        setCanvases(list)
      } catch (e) {
        setErr(handleError(e))
      } finally {
        setLoading(false)
      }
    },
    [handleError],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runGuarded = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr(handleError(e))
    } finally {
      setBusy(false)
    }
  }

  const confirmDiscard = (): boolean => {
    if (!dirty) return true
    return window.confirm('Unsaved changes will be lost. Continue?')
  }

  const handleNew = () => {
    if (!confirmDiscard()) return
    const shapeIds = editor.getCurrentPageShapes().map((s) => s.id)
    if (shapeIds.length > 0) editor.deleteShapes(shapeIds)
    editor.selectNone()
    editor.clearHistory()
    onActivate(null, false)
    onClose()
  }

  const handleLoad = (meta: CanvasMeta) =>
    runGuarded(async () => {
      if (!confirmDiscard()) return
      const slug = slugify(meta.name)
      const res = await getCanvas(slug)
      if (!res) {
        setErr(`Canvas "${meta.name}" was not found on the server.`)
        await refresh()
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.store.loadStoreSnapshot(res.snapshot as any)
      onActivate({ slug, name: res.meta.name }, false)
      onClose()
    })

  const doSave = (name: string) =>
    runGuarded(async () => {
      const snapshot = editor.store.getStoreSnapshot()
      const meta = await saveCanvas(name, snapshot)
      onActivate({ slug: slugify(meta.name), name: meta.name }, false)
      await refresh()
    })

  const handleSave = () => {
    if (active) {
      void doSave(active.name)
    } else {
      handleSaveAs()
    }
  }

  const handleSaveAs = () => {
    const name = window.prompt('Save canvas as:', active?.name ?? '')
    if (!name || !name.trim()) return
    const trimmed = name.trim()
    const slug = slugify(trimmed)
    const clash = canvases?.some((c) => slugify(c.name) === slug && c.name !== active?.name)
    if (clash && !window.confirm(`"${trimmed}" already exists. Overwrite?`)) return
    void doSave(trimmed)
  }

  const handleRename = (meta: CanvasMeta) =>
    runGuarded(async () => {
      const next = window.prompt('Rename to:', meta.name)
      if (!next || !next.trim()) return
      const trimmed = next.trim()
      if (trimmed === meta.name) return
      const oldSlug = slugify(meta.name)
      const newSlug = slugify(trimmed)
      if (oldSlug === newSlug) {
        // Same slug, different display name — just update the row.
        const res = await getCanvas(oldSlug)
        if (!res) throw new Error(`Canvas "${meta.name}" no longer exists.`)
        await saveCanvas(trimmed, res.snapshot, meta.tags, meta.description)
        await refresh()
        if (active?.slug === oldSlug) onActivate({ slug: newSlug, name: trimmed }, dirty)
        return
      }
      const clash = canvases?.some((c) => slugify(c.name) === newSlug)
      if (clash && !window.confirm(`"${trimmed}" already exists. Overwrite?`)) return
      const res = await getCanvas(oldSlug)
      if (!res) throw new Error(`Canvas "${meta.name}" no longer exists.`)
      await saveCanvas(trimmed, res.snapshot, meta.tags, meta.description)
      await deleteCanvas(oldSlug)
      await refresh()
      if (active?.slug === oldSlug) onActivate({ slug: newSlug, name: trimmed }, dirty)
    })

  const handleDuplicate = (meta: CanvasMeta) =>
    runGuarded(async () => {
      const next = window.prompt('Duplicate as:', `${meta.name} copy`)
      if (!next || !next.trim()) return
      const trimmed = next.trim()
      const newSlug = slugify(trimmed)
      const clash = canvases?.some((c) => slugify(c.name) === newSlug)
      if (clash && !window.confirm(`"${trimmed}" already exists. Overwrite?`)) return
      const res = await getCanvas(slugify(meta.name))
      if (!res) throw new Error(`Canvas "${meta.name}" no longer exists.`)
      await saveCanvas(trimmed, res.snapshot, meta.tags, meta.description)
      await refresh()
    })

  const handleDelete = (meta: CanvasMeta) =>
    runGuarded(async () => {
      if (!window.confirm(`Delete "${meta.name}"? This cannot be undone.`)) return
      const slug = slugify(meta.name)
      await deleteCanvas(slug)
      if (active?.slug === slug) onActivate(null, dirty)
      await refresh()
    })

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17, 17, 27, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 64,
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: 'calc(100vh - 128px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#1e1e2e',
          color: '#cdd6f4',
          borderRadius: 12,
          border: '1px solid #313244',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #313244',
            background: '#181825',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Canvas library</div>
            <div style={{ fontSize: 11, color: '#6c7086' }}>
              {active ? `Current: ${active.name}${dirty ? ' · unsaved' : ''}` : 'Untitled · unsaved'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <ToolbarButton onClick={handleNew} disabled={busy}>
              New
            </ToolbarButton>
            <ToolbarButton onClick={handleSave} disabled={busy} primary>
              Save
            </ToolbarButton>
            <ToolbarButton onClick={handleSaveAs} disabled={busy}>
              Save as…
            </ToolbarButton>
            <ToolbarButton onClick={onClose} disabled={busy}>
              Close
            </ToolbarButton>
          </div>
        </header>

        {err && (
          <div
            role="alert"
            style={{
              padding: '8px 16px',
              background: '#3e2530',
              color: '#f38ba8',
              fontSize: 12,
              borderBottom: '1px solid #313244',
            }}
          >
            {err}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading && !canvases && (
            <div style={{ padding: 16, color: '#6c7086', fontSize: 12 }}>Loading…</div>
          )}
          {canvases && canvases.length === 0 && (
            <div style={{ padding: 16, color: '#6c7086', fontSize: 12 }}>
              No saved canvases yet. Use Save as… to create one.
            </div>
          )}
          {canvases && canvases.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {canvases.map((c) => {
                const slug = slugify(c.name)
                const isActive = active?.slug === slug
                return (
                  <li
                    key={slug}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderBottom: '1px solid #313244',
                      background: isActive ? '#181825' : 'transparent',
                      cursor: busy ? 'wait' : 'pointer',
                    }}
                    onClick={() => !busy && handleLoad(c)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isActive && <span style={{ color: '#89b4fa' }}>•</span>}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6c7086', marginTop: 2 }}>
                        {fmtModified(c.modified)}
                        {c.description && ` · ${c.description}`}
                      </div>
                    </div>
                    <RowButton
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleRename(c)
                      }}
                      disabled={busy}
                    >
                      Rename
                    </RowButton>
                    <RowButton
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDuplicate(c)
                      }}
                      disabled={busy}
                    >
                      Duplicate
                    </RowButton>
                    <RowButton
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(c)
                      }}
                      disabled={busy}
                      danger
                    >
                      Delete
                    </RowButton>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  disabled,
  primary,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        border: 'none',
        background: primary ? '#89b4fa' : '#313244',
        color: primary ? '#11111b' : '#cdd6f4',
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: primary ? 600 : 400,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

function RowButton({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 8px',
        borderRadius: 6,
        border: '1px solid #313244',
        background: 'transparent',
        color: danger ? '#f38ba8' : '#a6adc8',
        fontFamily: 'inherit',
        fontSize: 11,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}
