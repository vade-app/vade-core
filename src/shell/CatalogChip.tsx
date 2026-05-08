import { useShell } from './ShellContext'

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
      <span style={{ color: '#6c7086' }}>▤</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Catalog
      </span>
    </button>
  )
}
