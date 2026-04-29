import { useState } from 'react'
import { useEditor } from 'tldraw'
import type { MemoEntry } from '../lineage/layout'
import { memosToSpectrum } from '../dft/signal'
import { populateDft } from '../dft/populate'

type Status = 'idle' | 'loading' | 'done' | 'error'

export function DftButton() {
  const editor = useEditor()
  const [status, setStatus] = useState<Status>('idle')
  const [msg, setMsg] = useState<string | null>(null)

  const handleClick = async () => {
    if (status === 'loading') return

    const existing = editor.getCurrentPageShapes().length
    if (existing > 0) {
      const ok = window.confirm(
        `The current canvas has ${existing} shape${existing === 1 ? '' : 's'}. ` +
        'DFT shapes will be added on top. Continue? ' +
        '(Cancel and use the Canvas chip → New first to start fresh.)',
      )
      if (!ok) return
    }

    setStatus('loading')
    setMsg(null)
    try {
      const res = await fetch('/memo_index.json', { cache: 'no-store' })
      if (!res.ok) throw new Error(`memo_index.json: HTTP ${res.status}`)
      const memos = (await res.json()) as MemoEntry[]
      const ss = memosToSpectrum(memos)
      const result = populateDft(editor, ss)
      setStatus('done')
      setMsg(`${result.inputBars}d · ${result.spectrumBars} bins`)
      editor.focus()
    } catch (err) {
      setStatus('error')
      setMsg(err instanceof Error ? err.message : String(err))
    }
  }

  const label =
    status === 'loading' ? 'Generating…' :
    status === 'done' ? `DFT · ${msg}` :
    status === 'error' ? `DFT · error` :
    'Generate DFT'

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        status === 'error' && msg
          ? msg
          : 'Generate the DFT of the COO memo publication cadence on the current canvas. ' +
            'If you have unsaved work, save it via the Canvas chip first.'
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
      <span style={{ color: '#6c7086' }}>∿</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  )
}
