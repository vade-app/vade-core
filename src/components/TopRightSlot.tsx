import { CatalogChip } from '../shell/CatalogChip'
import { LibraryChip } from '../shell/LibraryChip'

// Single component for tldraw's SharePanel slot. Composes the
// Catalog + Library toggles so they render inside tldraw's chrome
// and don't collide with its toolbars or style panel. Slot choice
// is the open question tracked at #182.
export function TopRightSlot() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <CatalogChip />
      <LibraryChip />
    </div>
  )
}
