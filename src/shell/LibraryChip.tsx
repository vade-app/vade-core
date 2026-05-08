import { useShell } from './ShellContext'
import { fontMono, size } from './typography'

// Toggle chip for the library panel. Carries active canvas name +
// dirty dot for at-a-glance status. Renders inside tldraw's
// SharePanel slot via TopRightSlot. Style is the inline placeholder
// pending the theme-tokens pass at #180.
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
        borderRadius: 'var(--tl-radius-4)',
        border: '1px solid var(--tl-color-divider)',
        background: open ? 'var(--tl-color-muted-1)' : 'var(--tl-color-panel-overlay)',
        color: 'var(--tl-color-text)',
        fontFamily: fontMono,
        fontSize: size.sm,
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span style={{ color: 'var(--tl-color-text-3)' }}>≡</span>
      <span style={{ color: 'var(--tl-color-text-3)' }}>Canvas:</span>
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
            background: 'var(--tl-color-warning)',
            flexShrink: 0,
          }}
        />
      )}
    </button>
  )
}
