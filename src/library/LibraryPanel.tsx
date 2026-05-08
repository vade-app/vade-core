import { useCallback, useEffect, useMemo, useState } from 'react'
import { type Editor, getSnapshot, loadSnapshot } from 'tldraw'
import {
  type CanvasMeta,
  type SnapshotMeta,
  LibraryAuthError,
  branchCanvas,
  getCanvas,
  listCanvases,
  listSnapshots,
  restoreSnapshot,
  saveCanvas,
  saveSnapshot,
  slugify,
} from '../lib/library'
import { fontSans, size } from '../shell/typography'
import { SaveDialog } from './SaveDialog'

export interface ActiveCanvas {
  slug: string
  name: string
}

interface LibraryPanelProps {
  editor: Editor
  active: ActiveCanvas | null
  onActiveChange: (next: ActiveCanvas | null) => void
  onClose?: () => void
}

type DialogMode = 'snapshot' | 'branch' | 'new' | null

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const day = 24 * 60 * 60 * 1000
    if (diff < day) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (diff < 7 * day) return d.toLocaleDateString([], { weekday: 'short' })
    return d.toLocaleDateString()
  } catch {
    return iso
  }
}

// Right-side library panel. Three sections: canvases list (click to
// load), snapshots list for the active canvas (restore + branch
// actions), action buttons (+ New, Save…, Branch). Width 260px,
// fixed positioning, z-index above the canvas. Wired into the AppShell
// in Pillar 5.
export function LibraryPanel({ editor, active, onActiveChange, onClose }: LibraryPanelProps) {
  const [canvases, setCanvases] = useState<CanvasMeta[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogMode>(null)
  const [busy, setBusy] = useState(false)

  const surface = useCallback((err: unknown): string => {
    if (err instanceof LibraryAuthError) {
      return 'Library unavailable (401). Worker needs OPERATOR_TOKENS — see docs/auth.md.'
    }
    if (err instanceof Error) return err.message
    return String(err)
  }, [])

  const refreshCanvases = useCallback(async () => {
    try {
      setCanvases(await listCanvases())
    } catch (err) {
      setError(surface(err))
    }
  }, [surface])

  const refreshSnapshots = useCallback(async () => {
    if (!active) {
      setSnapshots([])
      return
    }
    try {
      setSnapshots(await listSnapshots(active.slug))
    } catch (err) {
      setError(surface(err))
    }
  }, [active, surface])

  useEffect(() => {
    refreshCanvases()
  }, [refreshCanvases])

  useEffect(() => {
    refreshSnapshots()
  }, [refreshSnapshots])

  const sortedCanvases = useMemo(
    () => [...canvases].sort((a, b) => (a.modified < b.modified ? 1 : -1)),
    [canvases],
  )

  const onLoad = async (meta: CanvasMeta) => {
    setError(null)
    try {
      const slug = slugify(meta.name)
      const result = await getCanvas(slug)
      if (!result) {
        setError(`"${meta.name}" not found.`)
        return
      }
      loadSnapshot(editor.store, result.snapshot as Parameters<typeof loadSnapshot>[1])
      onActiveChange({ slug, name: meta.name })
    } catch (err) {
      setError(surface(err))
    }
  }

  const onSaveSnapshot = async (label: string) => {
    if (!active) return
    setBusy(true)
    try {
      // Make sure the head reflects current editor state before we
      // capture a snapshot. saveCanvas writes head; saveSnapshot then
      // copies head into history.
      const snapshot = getSnapshot(editor.store)
      await saveCanvas(active.name, snapshot, [], '')
      await saveSnapshot(active.slug, label)
      await Promise.all([refreshCanvases(), refreshSnapshots()])
      setDialog(null)
    } catch (err) {
      setError(surface(err))
    } finally {
      setBusy(false)
    }
  }

  const onBranchFromSnapshot = async (snapshotId: string | null, name: string) => {
    if (!active) return
    setBusy(true)
    try {
      const meta = await branchCanvas(active.slug, name, snapshotId ?? undefined)
      const newSlug = slugify(meta.name)
      // Load the just-branched canvas into the editor.
      const result = await getCanvas(newSlug)
      if (result) {
        loadSnapshot(editor.store, result.snapshot as Parameters<typeof loadSnapshot>[1])
        onActiveChange({ slug: newSlug, name: meta.name })
      }
      await refreshCanvases()
      setDialog(null)
    } catch (err) {
      setError(surface(err))
    } finally {
      setBusy(false)
    }
  }

  const onNewCanvas = async (name: string) => {
    setBusy(true)
    try {
      // Empty new canvas: clear shapes, save head under the new name.
      editor.selectAll()
      editor.deleteShapes(editor.getSelectedShapeIds())
      const snapshot = getSnapshot(editor.store)
      await saveCanvas(name, snapshot, [], '')
      const slug = slugify(name)
      onActiveChange({ slug, name })
      await refreshCanvases()
      setDialog(null)
    } catch (err) {
      setError(surface(err))
    } finally {
      setBusy(false)
    }
  }

  const onRestore = async (snap: SnapshotMeta) => {
    if (!active) return
    setError(null)
    try {
      const result = await restoreSnapshot(active.slug, snap.snapshot_id)
      if (!result) {
        setError(`Snapshot "${snap.snapshot_id}" not found.`)
        return
      }
      loadSnapshot(editor.store, result.snapshot as Parameters<typeof loadSnapshot>[1])
      await refreshCanvases()
    } catch (err) {
      setError(surface(err))
    }
  }

  const [pendingBranchSnap, setPendingBranchSnap] = useState<string | null>(null)

  const handleDialogSubmit = (value: string) => {
    if (dialog === 'snapshot') return onSaveSnapshot(value)
    if (dialog === 'new') return value ? onNewCanvas(value) : setDialog(null)
    if (dialog === 'branch') {
      if (!value) {
        setDialog(null)
        return
      }
      return onBranchFromSnapshot(pendingBranchSnap, value)
    }
  }

  const dialogConfig = useMemo(() => {
    switch (dialog) {
      case 'snapshot':
        return { title: 'Save snapshot', placeholder: 'Tag (optional)' }
      case 'new':
        return { title: 'New canvas', placeholder: 'Canvas name' }
      case 'branch':
        return {
          title: pendingBranchSnap ? 'Branch from snapshot' : 'Branch from head',
          placeholder: 'New canvas name',
        }
      default:
        return null
    }
  }, [dialog, pendingBranchSnap])

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        background: 'var(--tl-color-panel)',
        color: 'var(--tl-color-text)',
        borderLeft: '1px solid var(--tl-color-divider)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: fontSans,
        fontSize: size.lg,
      }}
    >
      <header
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--tl-color-divider)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: size.sm, letterSpacing: 1.2, color: 'var(--tl-color-text-3)' }}>LIBRARY</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close library panel"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--tl-color-text-3)',
              cursor: 'pointer',
              fontSize: 16 /* display */,
              lineHeight: 1,
            }}
          >
            ›
          </button>
        )}
      </header>

      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '8px 10px',
          borderBottom: '1px solid var(--tl-color-divider)',
        }}
      >
        <ActionButton onClick={() => setDialog('new')}>+ New</ActionButton>
        <ActionButton onClick={() => setDialog('snapshot')} disabled={!active}>
          Save…
        </ActionButton>
        <ActionButton
          onClick={() => {
            setPendingBranchSnap(null)
            setDialog('branch')
          }}
          disabled={!active}
        >
          Branch
        </ActionButton>
      </div>

      {error && (
        <div
          style={{
            padding: '6px 10px',
            background: 'rgba(243, 139, 168, 0.12)',
            color: '#f38ba8',
            fontSize: size.md,
            borderBottom: '1px solid rgba(243, 139, 168, 0.3)',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Section title="CANVASES">
          {sortedCanvases.length === 0 ? (
            <Empty>No canvases yet.</Empty>
          ) : (
            sortedCanvases.map((c) => {
              const slug = slugify(c.name)
              const isActive = active?.slug === slug
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => onLoad(c)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 12px',
                    background: isActive ? 'var(--tl-color-muted-1)' : 'transparent',
                    border: 'none',
                    color: isActive ? 'var(--tl-color-selected)' : 'var(--tl-color-text)',
                    cursor: 'pointer',
                    fontSize: size.md,
                  }}
                >
                  <div style={{ fontWeight: isActive ? 600 : 400 }}>{c.name}</div>
                  <div style={{ fontSize: size.sm, color: 'var(--tl-color-text-3)' }}>
                    {fmtTime(c.modified)}
                    {c.parent_slug && ` · from ${c.parent_slug}`}
                  </div>
                </button>
              )
            })
          )}
        </Section>

        {active && (
          <Section title="SNAPSHOTS">
            {snapshots.length === 0 ? (
              <Empty>No snapshots yet.</Empty>
            ) : (
              snapshots.map((s) => (
                <div
                  key={s.snapshot_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    fontSize: size.md,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.label || '(no label)'}
                    </div>
                    <div style={{ fontSize: size.xs, color: 'var(--tl-color-text-3)' }}>{fmtTime(s.created)}</div>
                  </div>
                  <IconButton
                    title="Restore this snapshot"
                    onClick={() => onRestore(s)}
                  >
                    ↺
                  </IconButton>
                  <IconButton
                    title="Branch from this snapshot"
                    onClick={() => {
                      setPendingBranchSnap(s.snapshot_id)
                      setDialog('branch')
                    }}
                  >
                    ⑂
                  </IconButton>
                </div>
              ))
            )}
          </Section>
        )}
      </div>

      {dialogConfig && (
        <SaveDialog
          open={Boolean(dialog)}
          title={dialogConfig.title}
          placeholder={dialogConfig.placeholder}
          busy={busy}
          onCancel={() => {
            setDialog(null)
            setPendingBranchSnap(null)
          }}
          onSubmit={handleDialogSubmit}
        />
      )}
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div
        style={{
          padding: '0 12px 6px',
          fontSize: size.xs,
          letterSpacing: 1.2,
          color: 'var(--tl-color-text-3)',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 12px', fontSize: size.md, color: 'var(--tl-color-text-3)' }}>{children}</div>
  )
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '5px 8px',
        borderRadius: 6,
        border: '1px solid var(--tl-color-divider)',
        background: 'var(--tl-color-panel-overlay)',
        color: disabled ? 'var(--tl-color-text-3)' : 'var(--tl-color-text)',
        fontSize: size.md,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        border: '1px solid var(--tl-color-divider)',
        background: 'transparent',
        color: 'var(--tl-color-text)',
        fontSize: size.lg,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}
