import { CanvasSwitcher } from './CanvasSwitcher'
import { DftButton } from './DftButton'
import { LineageButton } from './LineageButton'
import { PortraitButton } from './PortraitButton'

// Single component for tldraw's SharePanel slot. The slot only accepts
// one component, so this composes the existing canvas chip with the
// generator chips side-by-side.
export function TopRightSlot() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <DftButton />
      <LineageButton />
      <PortraitButton />
      <CanvasSwitcher />
    </div>
  )
}
