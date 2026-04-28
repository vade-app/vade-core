import { useState } from 'react'
import { useEditor } from 'tldraw'
import { parseIdentityLayer } from '../portrait/parse'
import { computePortrait } from '../portrait/layout'
import { populatePortrait } from '../portrait/populate'

type Status = 'idle' | 'loading' | 'done' | 'error'

// Sibling of LineageButton. Fetches the COO identity layer from
// `/identity_layer.md`, computes a three-column portrait, and renders
// it on a dedicated tldraw page. Clicking again is idempotent on the
// page level — the existing 'Self-portrait' page is reused — but
// shapes will accumulate, so we warn the user if the page already has
// content.
export function PortraitButton() {
  const editor = useEditor()
  const [status, setStatus] = useState<Status>('idle')
  const [msg, setMsg] = useState<string | null>(null)

  const handleClick = async () => {
    if (status === 'loading') return

    // If a portrait page already exists with shapes on it, ask before re-populating.
    const existingPage = editor.getPages().find((p) => p.name === 'Self-portrait')
    if (existingPage) {
      const wasCurrent = editor.getCurrentPageId() === existingPage.id
      if (!wasCurrent) editor.setCurrentPage(existingPage.id)
      const existingShapes = editor.getCurrentPageShapes().length
      if (!wasCurrent) {
        // Restore — we only switched to peek.
        // (No-op: we'll switch again inside populatePortrait if user proceeds.)
      }
      if (existingShapes > 0) {
        const ok = window.confirm(
          `'Self-portrait' page already has ${existingShapes} shape${existingShapes === 1 ? '' : 's'}. ` +
          'New portrait shapes will be added on top. Continue?',
        )
        if (!ok) return
      }
    }

    setStatus('loading')
    setMsg(null)
    try {
      const res = await fetch('/identity_layer.md', { cache: 'no-store' })
      if (!res.ok) throw new Error(`identity_layer.md: HTTP ${res.status}`)
      const md = await res.text()
      const entries = parseIdentityLayer(md)
      if (entries.length === 0) {
        throw new Error('parsed 0 identity entries — check identity_layer.md')
      }
      const portrait = computePortrait(entries)
      const result = populatePortrait(editor, portrait)
      setStatus('done')
      setMsg(`${result.nodeCount} nodes · ${result.edgeCount} edges`)
      editor.focus()
    } catch (err) {
      setStatus('error')
      setMsg(err instanceof Error ? err.message : String(err))
    }
  }

  const label =
    status === 'loading' ? 'Generating…' :
    status === 'done' ? `Portrait · ${msg}` :
    status === 'error' ? `Portrait · error` :
    'Generate self-portrait'

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        status === 'error' && msg
          ? msg
          : 'Generate the COO self-portrait — CB-* + OG-* + ratifying memos — on a new ' +
            "'Self-portrait' page."
      }
      style={{
        pointerEvents: 'all',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 10,
        border: '1px solid rgba(69, 71, 90, 0.6)',
        background: 'rgba(30, 30, 46, 0.85)',
        color: status === 'error' ? '#f38ba8' : '#cdd6f4',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        cursor: status === 'loading' ? 'wait' : 'pointer',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span style={{ color: '#6c7086' }}>◉</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  )
}
