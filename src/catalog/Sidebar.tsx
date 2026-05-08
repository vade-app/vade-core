import { useCallback, useEffect, useMemo, useState } from 'react'
import { type EntityMeta, LibraryAuthError, listEntities, slugify } from '../lib/library'
import { metas as shapeMetas } from '../shapes/registry'
import { fontSans, size } from '../shell/typography'
import { ShapeCard } from './ShapeCard'

interface SidebarProps {
  onClose?: () => void
  onExpand?: () => void
}

// 220px left sidebar. Two sections — built-in SHAPES from the registry,
// and saved ENTITIES fetched from /library/entities. Search box at the
// top filters both kinds; tag chips on entity rows are clickable to
// pin a tag filter. Wired into the AppShell in Pillar 5; usable as a
// standalone panel for now.
export function Sidebar({ onClose, onExpand }: SidebarProps) {
  const [entities, setEntities] = useState<EntityMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const surface = useCallback((err: unknown): string => {
    if (err instanceof LibraryAuthError) {
      return 'Library unavailable (401). Worker needs OPERATOR_TOKENS — see docs/auth.md.'
    }
    if (err instanceof Error) return err.message
    return String(err)
  }, [])

  useEffect(() => {
    listEntities().then(setEntities).catch((err) => setError(surface(err)))
  }, [surface])

  const shapeMetaList = useMemo(
    () => Object.values(shapeMetas).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )

  const filteredShapes = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q && !activeTag) return shapeMetaList
    return shapeMetaList.filter((s) => {
      if (activeTag) return false // shapes have no tags surface today
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false) ||
        (s.category?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [query, activeTag, shapeMetaList])

  const filteredEntities = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entities.filter((e) => {
      if (activeTag && !e.tags.includes(activeTag)) return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [query, activeTag, entities])

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const e of entities) for (const t of e.tags) s.add(t)
    return [...s].sort()
  }, [entities])

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: '#1e1e2e',
        color: '#cdd6f4',
        borderRight: '1px solid rgba(69, 71, 90, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: fontSans,
        fontSize: size.lg,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 12px',
          borderBottom: '1px solid rgba(69, 71, 90, 0.6)',
        }}
      >
        <div style={{ flex: 1, fontSize: size.sm, letterSpacing: 1.2, color: '#7f849c' }}>
          CATALOG
        </div>
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            title="Expand to full page"
            style={iconButtonStyle}
          >
            ⤢
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close catalog"
            style={iconButtonStyle}
          >
            ‹
          </button>
        )}
      </header>

      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(69, 71, 90, 0.4)' }}>
        <input
          type="text"
          placeholder="Search shapes + entities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '5px 8px',
            background: '#181825',
            border: '1px solid rgba(69, 71, 90, 0.6)',
            color: '#cdd6f4',
            borderRadius: 6,
            fontSize: size.md,
            boxSizing: 'border-box',
          }}
        />
        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                style={{
                  fontSize: size.xs,
                  padding: '1px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(137, 180, 250, 0.4)',
                  background:
                    activeTag === t ? 'rgba(137, 180, 250, 0.3)' : 'transparent',
                  color: '#89b4fa',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '6px 10px',
            background: 'rgba(243, 139, 168, 0.12)',
            color: '#f38ba8',
            fontSize: size.md,
            borderBottom: '1px solid rgba(243, 139, 168, 0.3)',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Section title="SHAPES">
          {filteredShapes.length === 0 ? (
            <Empty>No matches.</Empty>
          ) : (
            <List>
              {filteredShapes.map((s) => (
                <ShapeCard
                  key={s.id}
                  kind="shape"
                  id={s.id}
                  name={s.name}
                  description={s.description}
                  category={s.category}
                  defaultProps={s.defaultProps}
                />
              ))}
            </List>
          )}
        </Section>

        <Section title="ENTITIES">
          {filteredEntities.length === 0 ? (
            <Empty>No saved entities.</Empty>
          ) : (
            <List>
              {filteredEntities.map((e) => (
                <ShapeCard
                  key={e.name}
                  kind="entity"
                  id={slugify(e.name)}
                  name={e.name}
                  description={e.description}
                  tags={e.tags}
                />
              ))}
            </List>
          )}
        </Section>
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div
        style={{
          padding: '0 12px 6px',
          fontSize: size.xs,
          letterSpacing: 1.2,
          color: '#6c7086',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px' }}>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 12px', fontSize: size.md, color: '#6c7086' }}>{children}</div>
  )
}

const iconButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: '#7f849c',
  cursor: 'pointer',
  fontSize: size.lg,
  lineHeight: 1,
  padding: 2,
} as const
