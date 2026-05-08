import { CatalogChip } from '../shell/CatalogChip'
import { LibraryChip } from '../shell/LibraryChip'
import { DftButton } from './DftButton'
import { LineageButton } from './LineageButton'
import { PortraitButton } from './PortraitButton'

// Single component for tldraw's SharePanel slot. Composes the new
// shell affordances (Catalog + Library toggles) with the existing
// generator chips (DFT / Lineage / Portrait) so they all render
// inside tldraw's chrome and don't collide with its toolbars or
// style panel.
//
// Catalog/Library chips read state from ShellContext (provided by
// AppShell). The generator chips remain in place pending a future
// refactor that may fold them into the catalogue as built-in
// entries.
export function TopRightSlot() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <CatalogChip />
      <DftButton />
      <LineageButton />
      <PortraitButton />
      <LibraryChip />
    </div>
  )
}
