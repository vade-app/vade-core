import { useShell } from './ShellContext'
import { fontMono, size } from './typography'

// Toggle chip for the catalog sidebar/fullpage. Renders inside
// tldraw's SharePanel slot via TopRightSlot. Style is the inline
// Catppuccin-pill placeholder pending the theme-tokens pass at
// #180.
export function CatalogChip() {
  const { catalog, setCatalog } = useShell()
  const open = catalog !== 'closed'

  return (
    <button
      type="button"
      onClick={() => setCatalog(open ? 'closed' : 'sidebar')}
      title={open ? 'Close catalog' : 'Open catalog (drag shapes onto canvas)'}
      style={{
        pointerEvents: 'all',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
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
      <span style={{ color: 'var(--tl-color-text-3)' }}>▤</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Catalog
      </span>
    </button>
  )
}
