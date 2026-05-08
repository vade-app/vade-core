import { useEffect, useRef, type ReactNode } from 'react'
import { type Editor } from 'tldraw'
import { getEntity } from '../lib/library'
import { ENTITY_MIME, SHAPE_MIME, type EntityPayload, type ShapePayload } from './ShapeCard'

interface CanvasDropTargetProps {
  editor: Editor | null
  onDropError?: (err: unknown) => void
  children: ReactNode
}

// Wraps <Tldraw>. tldraw v4.5.x's registerExternalContentHandler union
// is closed (only embed/excalidraw/files/text/tldraw/url), so we
// intercept dragenter/dragover/drop in capture phase on the wrapper
// div. This runs before tldraw's own dragover, lets us call
// preventDefault() on the unknown MIME (without which the browser
// refuses the drop), and dispatches createShape / createShapes at
// the drop point.
export function CanvasDropTarget({ editor, onDropError, children }: CanvasDropTargetProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const isCatalogDrop = (dt: DataTransfer | null): boolean => {
      if (!dt) return false
      return dt.types.includes(SHAPE_MIME) || dt.types.includes(ENTITY_MIME)
    }

    const onDragOver = (e: DragEvent) => {
      if (!isCatalogDrop(e.dataTransfer)) return
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }

    const onDragEnter = (e: DragEvent) => {
      if (!isCatalogDrop(e.dataTransfer)) return
      e.preventDefault()
      e.stopPropagation()
    }

    const onDrop = (e: DragEvent) => {
      if (!editor) return
      if (!isCatalogDrop(e.dataTransfer)) return
      e.preventDefault()
      e.stopPropagation()

      const dt = e.dataTransfer!
      const point = editor.screenToPage({ x: e.clientX, y: e.clientY })

      try {
        editor.markHistoryStoppingPoint('catalog-insert')
      } catch {
        // older tldraw versions don't have markHistoryStoppingPoint;
        // okay to ignore — drops still create shapes.
      }

      const shapeRaw = dt.getData(SHAPE_MIME)
      if (shapeRaw) {
        try {
          const payload = JSON.parse(shapeRaw) as ShapePayload
          // tldraw's TLShape union only covers built-in types. Custom
          // shape types (vade-code, vade-data) are registered at
          // runtime and validated by the editor, but TS can't see
          // them. Cast to satisfy strict typing.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editor.createShape({
            type: payload.id,
            x: point.x,
            y: point.y,
            props: payload.defaultProps,
          } as any)
        } catch (err) {
          onDropError?.(err)
        }
        return
      }

      const entityRaw = dt.getData(ENTITY_MIME)
      if (entityRaw) {
        try {
          const payload = JSON.parse(entityRaw) as EntityPayload
          getEntity(payload.slug)
            .then((result) => {
              if (!result) {
                onDropError?.(new Error(`Entity "${payload.slug}" not found.`))
                return
              }
              const created = result.shapes.map((raw) => {
                const s = raw as {
                  type?: string
                  x?: number
                  y?: number
                  props?: Record<string, unknown>
                }
                return {
                  type: s.type ?? '',
                  x: (s.x ?? 0) + point.x,
                  y: (s.y ?? 0) + point.y,
                  props: s.props ?? {},
                }
              })
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              editor.createShapes(created as any)
            })
            .catch((err) => onDropError?.(err))
        } catch (err) {
          onDropError?.(err)
        }
      }
    }

    node.addEventListener('dragenter', onDragEnter, { capture: true })
    node.addEventListener('dragover', onDragOver, { capture: true })
    node.addEventListener('drop', onDrop, { capture: true })
    return () => {
      node.removeEventListener('dragenter', onDragEnter, { capture: true })
      node.removeEventListener('dragover', onDragOver, { capture: true })
      node.removeEventListener('drop', onDrop, { capture: true })
    }
  }, [editor, onDropError])

  return (
    <div ref={ref} style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  )
}
