import { useShell } from './ShellContext'

// Toggle chip for the library panel. Carries active canvas name +
// dirty dot for at-a-glance status. Matches the DftButton/Lineage/
// Portrait chip style so it integrates into tldraw's SharePanel.
export function LibraryChip() {
  const { library, setLibrary, activeName, dirty } = useShell()
  const open = library === 'open'

  return (
    <button
      type="button"
      onClick={() => setLibrary(open ? 'closed' : 'open')}
      title={open ? 'Close library' : 'Open library (canvases + snapshots)'}
      style={{
        pointerEvents: 'all',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        maxWidth: 240,
        borderRadius: 10,
        border: '1px solid rgba(69, 71, 90, 0.6)',
        background: open ? 'rgba(137, 180, 250, 0.18)' : 'rgba(30, 30, 46, 0.85)',
        color: '#cdd6f4',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span style={{ color: '#6c7086' }}>≡</span>
      <span style={{ color: '#6c7086' }}>Canvas:</span>
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 140,
        }}
      >
        {activeName ?? 'untitled'}
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
  )
}
