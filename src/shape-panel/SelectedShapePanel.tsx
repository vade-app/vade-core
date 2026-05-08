import { useEffect, useState } from 'react'
import { type Editor, useValue } from 'tldraw'
import { metas as shapeMetas } from '../shapes/registry'
import { fontSans, size } from '../shell/typography'
import { ParamForm } from './ParamForm'

interface SelectedShapePanelProps {
  editor: Editor | null
}

// Floating top-right panel. Renders a ParamForm for the single
// selected shape when (and only when) that shape's type has a meta
// with a paramSchema in the registry. Edits dispatch
// editor.updateShape, which triggers the document/user store
// listener used by autosave + dirty-tracking elsewhere — so the
// param panel stays in sync with the rest of the library/save state
// without explicit wiring.
//
// Caller passes the editor explicitly (rather than via tldraw's
// useEditor hook) so the panel can be rendered as a sibling of
// <Tldraw> from the AppShell rather than nested inside it.
export function SelectedShapePanel({ editor }: SelectedShapePanelProps) {
  if (!editor) return null
  return <SelectedShapePanelInner editor={editor} />
}

function SelectedShapePanelInner({ editor }: { editor: Editor }) {
  const selectedIds = useValue('selected ids', () => editor.getSelectedShapeIds(), [editor])
  const [, forceTick] = useState(0)

  // Re-render when the selected shape's props change so the form
  // reflects updates from MCP, undo/redo, etc.
  useEffect(() => {
    if (selectedIds.length !== 1) return
    const off = editor.store.listen(() => forceTick((t) => t + 1), {
      scope: 'document',
    })
    return off
  }, [editor, selectedIds])

  if (selectedIds.length !== 1) return null
  const id = selectedIds[0]
  if (!id) return null

  const shape = editor.getShape(id) as
    | {
        id: string
        type: string
        props: Record<string, unknown>
      }
    | undefined
  if (!shape) return null

  const meta = shapeMetas[shape.type]
  if (!meta) return null

  return (
    <aside
      style={{
        position: 'absolute',
        top: 60,
        right: 12,
        width: 240,
        zIndex: 1500,
        background: 'var(--tl-color-panel)',
        color: 'var(--tl-color-text)',
        border: '1px solid var(--tl-color-divider)',
        borderRadius: 10,
        padding: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        fontFamily: fontSans,
      }}
    >
      <header style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: size.sm,
            letterSpacing: 1.2,
            color: 'var(--tl-color-text-3)',
            textTransform: 'uppercase',
          }}
        >
          {meta.name}
        </div>
        {meta.description && (
          <div style={{ fontSize: size.sm, color: 'var(--tl-color-text-3)', marginTop: 2 }}>
            {meta.description}
          </div>
        )}
      </header>
      <ParamForm
        schema={meta.paramSchema}
        value={shape.props}
        onChange={(next) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editor.updateShape({ id: shape.id, type: shape.type, props: next } as any)
        }}
      />
    </aside>
  )
}
