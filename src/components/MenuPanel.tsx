import type { FC, ReactNode } from 'react'
import {
  DefaultMenuPanel,
  TldrawUiButton as _TldrawUiButton,
  TldrawUiButtonLabel as _TldrawUiButtonLabel,
} from 'tldraw'
import { useShell } from '../shell/ShellContext'

const TldrawUiButton = _TldrawUiButton as unknown as FC<{
  type: 'normal' | 'primary' | 'danger' | 'low' | 'icon' | 'menu' | 'help' | 'tool'
  isActive?: boolean
  onClick?: () => void
  title?: string
  children?: ReactNode
}>
const TldrawUiButtonLabel = _TldrawUiButtonLabel as unknown as FC<{ children?: ReactNode }>

// Custom MenuPanel: tldraw's default top-left menu group (MainMenu +
// PageMenu) with Catalog + Canvas toggles as discrete chrome buttons,
// followed by a non-button readout of the active canvas name + dirty
// indicator. A 1px divider separates the DefaultMenuPanel from the
// VADE toggles so the three regions read as distinct.
//
// The Canvas toggle's label is fixed ('Canvas') — the active canvas
// name is a separate readout, not the button label. (Earlier shape
// rendered the active name as the button text, which read as the
// button being renamed; the readout makes the name a state display
// adjacent to a stable control.)
//
// DefaultMenuPanel resolves its inner MainMenu through the components
// context, so our custom MainMenu (which adds the Sign-out item per
// #186) still renders here.
export function MenuPanel() {
  const { catalog, setCatalog, library, setLibrary, activeName, dirty } = useShell()
  const catalogOpen = catalog !== 'closed'
  const libraryOpen = library === 'open'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'all' }}>
      <DefaultMenuPanel />
      <Divider />
      <TldrawUiButton
        type="menu"
        isActive={catalogOpen}
        onClick={() => setCatalog(catalogOpen ? 'closed' : 'sidebar')}
        title={catalogOpen ? 'Close catalog' : 'Open catalog (drag shapes onto canvas)'}
      >
        <TldrawUiButtonLabel>Catalog</TldrawUiButtonLabel>
      </TldrawUiButton>
      <TldrawUiButton
        type="menu"
        isActive={libraryOpen}
        onClick={() => setLibrary(libraryOpen ? 'closed' : 'open')}
        title={libraryOpen ? 'Close library' : 'Open library (canvases + snapshots)'}
      >
        <TldrawUiButtonLabel>Canvas</TldrawUiButtonLabel>
      </TldrawUiButton>
      {activeName && (
        <>
          <Divider />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 8px',
              color: 'var(--tl-color-text-3)',
              fontSize: 12,
              maxWidth: 200,
            }}
            title={dirty ? `${activeName} (unsaved changes)` : activeName}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activeName}
            </span>
            {dirty && (
              <span
                aria-label="unsaved changes"
                style={{
                  flexShrink: 0,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--tl-color-warning)',
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        height: 18,
        margin: '0 4px',
        background: 'var(--tl-color-divider)',
        flexShrink: 0,
      }}
    />
  )
}
