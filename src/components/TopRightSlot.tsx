import { DftButton } from './DftButton'
import { LineageButton } from './LineageButton'
import { PortraitButton } from './PortraitButton'

// Single component for tldraw's SharePanel slot. Composes the
// generator chips. The canvas-library affordance moved to the
// AppShell's right-edge LIBRARY pill in Pillar 5; CanvasSwitcher
// modal retired.
export function TopRightSlot() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <DftButton />
      <LineageButton />
      <PortraitButton />
    </div>
  )
}
