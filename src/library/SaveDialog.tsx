import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fontSans, size } from '../shell/typography'

interface SaveDialogProps {
  open: boolean
  title?: string
  placeholder?: string
  busy?: boolean
  onCancel: () => void
  onSubmit: (label: string) => void
}

// Modal dialog for collecting an optional label (snapshot tag, branch
// name, etc.). Portals to document.body so it escapes any tldraw
// stacking context. Enter submits, ESC cancels.
export function SaveDialog({
  open,
  title = 'Save snapshot',
  placeholder = 'Tag (optional)',
  busy = false,
  onCancel,
  onSubmit,
}: SaveDialogProps) {
  const [label, setLabel] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setLabel('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  if (!open) return null

  const submit = () => {
    if (busy) return
    onSubmit(label.trim())
  }

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          minWidth: 320,
          padding: 16,
          background: 'var(--tl-color-low)',
          color: 'var(--tl-color-text)',
          borderRadius: 12,
          border: '1px solid var(--tl-color-divider)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
          fontFamily: fontSans,
        }}
      >
        <div style={{ fontSize: size.xl, fontWeight: 600, marginBottom: 12 }}>{title}</div>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={label}
          disabled={busy}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
          style={{
            width: '100%',
            padding: '6px 8px',
            background: 'var(--tl-color-background)',
            border: '1px solid var(--tl-color-divider)',
            color: 'var(--tl-color-text)',
            borderRadius: 6,
            fontSize: size.lg,
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--tl-color-divider)',
              background: 'transparent',
              color: 'var(--tl-color-text)',
              fontSize: size.md,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--tl-color-selected)',
              background: 'var(--tl-color-muted-1)',
              color: 'var(--tl-color-text)',
              fontSize: size.md,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
