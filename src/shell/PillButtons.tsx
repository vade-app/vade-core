import type { CSSProperties } from 'react'

interface PillButtonsProps {
  catalogVisible: boolean
  libraryVisible: boolean
  activeName?: string
  dirty?: boolean
  onOpenCatalog: () => void
  onOpenLibrary: () => void
}

// Edge pills shown when their respective panels are closed. Click
// either to open. The library pill carries a small status hint
// (active canvas name, dirty dot) so users have a glanceable signal
// without the panel open. Pure presentational; AppShell owns state.
export function PillButtons({
  catalogVisible,
  libraryVisible,
  activeName,
  dirty,
  onOpenCatalog,
  onOpenLibrary,
}: PillButtonsProps) {
  return (
    <>
      {catalogVisible && (
        <button
          type="button"
          onClick={onOpenCatalog}
          style={{
            ...edgeButtonStyle,
            left: 12,
          }}
          title="Open catalog (drag shapes onto canvas)"
        >
          CATALOG
        </button>
      )}
      {libraryVisible && (
        <button
          type="button"
          onClick={onOpenLibrary}
          style={{
            ...edgeButtonStyle,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          title="Open library (canvases + snapshots)"
        >
          <span>LIBRARY</span>
          {activeName && (
            <span
              style={{
                fontSize: 10,
                color: '#7f849c',
                fontWeight: 400,
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              · {activeName}
            </span>
          )}
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
      )}
    </>
  )
}

const edgeButtonStyle: CSSProperties = {
  position: 'fixed',
  top: 12,
  zIndex: 1300,
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid rgba(69, 71, 90, 0.6)',
  background: 'rgba(30, 30, 46, 0.85)',
  color: '#cdd6f4',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1.2,
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
}
