import { CanvasSwitcher } from './CanvasSwitcher'
import { LineageButton } from './LineageButton'

// Single component for tldraw's SharePanel slot. The slot only accepts
// one component, so this composes the existing canvas chip with the
// lineage-generator chip side-by-side.
export function TopRightSlot() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <LineageButton />
      <CanvasSwitcher />
    </div>
  )
}
