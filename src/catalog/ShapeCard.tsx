import type { CSSProperties } from 'react'

export const SHAPE_MIME = 'application/x-vade-canvas-shape'
export const ENTITY_MIME = 'application/x-vade-canvas-entity'

export type ShapePayload = {
  kind: 'shape'
  id: string
  defaultProps: Record<string, unknown>
}

export type EntityPayload = {
  kind: 'entity'
  slug: string
}

export type CardKind = 'shape' | 'entity'

interface ShapeCardProps {
  kind: CardKind
  id: string
  name: string
  description?: string
  category?: string
  tags?: string[]
  defaultProps?: Record<string, unknown>
  layout?: 'row' | 'tile'
}

// Draggable catalogue tile. Sets a custom MIME on dragstart so the
// CanvasDropTarget wrapper around <Tldraw> can hit-test and create the
// shape or entity at the drop point. Used by both Sidebar (compact row
// layout) and FullPage (square tile layout).
export function ShapeCard({
  kind,
  id,
  name,
  description,
  category,
  tags,
  defaultProps,
  layout = 'row',
}: ShapeCardProps) {
  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (kind === 'shape') {
      const payload: ShapePayload = {
        kind: 'shape',
        id,
        defaultProps: defaultProps ?? {},
      }
      e.dataTransfer.setData(SHAPE_MIME, JSON.stringify(payload))
    } else {
      const payload: EntityPayload = { kind: 'entity', slug: id }
      e.dataTransfer.setData(ENTITY_MIME, JSON.stringify(payload))
    }
    e.dataTransfer.effectAllowed = 'copy'
  }

  const baseStyle: CSSProperties = {
    padding: layout === 'tile' ? 14 : 8,
    borderRadius: 8,
    border: '1px solid rgba(69, 71, 90, 0.6)',
    background: 'rgba(30, 30, 46, 0.85)',
    color: '#cdd6f4',
    cursor: 'grab',
    fontFamily: 'system-ui, sans-serif',
    fontSize: layout === 'tile' ? 13 : 12,
    userSelect: 'none',
  }

  const tileStyle: CSSProperties = {
    ...baseStyle,
    minHeight: 80,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  }

  const rowStyle: CSSProperties = {
    ...baseStyle,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      title={description}
      style={layout === 'tile' ? tileStyle : rowStyle}
    >
      <div style={{ fontWeight: 600 }}>{name}</div>
      {category && (
        <div style={{ fontSize: 10, color: '#7f849c' }}>{category}</div>
      )}
      {tags && tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {tags.slice(0, 4).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(137, 180, 250, 0.15)',
                color: '#89b4fa',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
