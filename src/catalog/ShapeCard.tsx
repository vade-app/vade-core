import type { CSSProperties } from 'react'
import { fontSans, size } from '../shell/typography'

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
    border: '1px solid var(--tl-color-divider)',
    background: 'var(--tl-color-panel-overlay)',
    color: 'var(--tl-color-text)',
    cursor: 'grab',
    fontFamily: fontSans,
    fontSize: layout === 'tile' ? size.lg : size.md,
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
        <div style={{ fontSize: size.xs, color: 'var(--tl-color-text-3)' }}>{category}</div>
      )}
      {tags && tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {tags.slice(0, 4).map((t) => (
            <span
              key={t}
              style={{
                fontSize: size.xs,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'var(--tl-color-muted-1)',
                color: 'var(--tl-color-selected)',
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
