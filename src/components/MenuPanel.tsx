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
// PageMenu) with Catalog + Canvas (Library) toggles appended as
// TldrawUiButton siblings, so VADE's two primary navigations read as
// first-class chrome rather than auxiliary chips floating in the
// SharePanel slot. Wired into tldrawComponents in App.tsx. Closes
// vade-core#182 (Epic #179 §c).
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
        <TldrawUiButtonLabel>
          <span
            style={{
              display: 'inline-block',
              maxWidth: 160,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              verticalAlign: 'bottom',
            }}
          >
            {activeName ?? 'Canvas'}
          </span>
          {dirty && (
            <span
              aria-label="unsaved changes"
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                marginLeft: 6,
                borderRadius: '50%',
                background: 'var(--tl-color-warning)',
                verticalAlign: 'middle',
              }}
            />
          )}
        </TldrawUiButtonLabel>
      </TldrawUiButton>
    </div>
  )
}
