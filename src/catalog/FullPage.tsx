import { useCallback, useEffect, useMemo, useState } from 'react'
import { type EntityMeta, LibraryAuthError, listEntities, slugify } from '../lib/library'
import { metas as shapeMetas } from '../shapes/registry'
import { ShapeCard } from './ShapeCard'

interface FullPageProps {
  onClose: () => void
}

// Full-screen overlay catalogue. Grid layout, grouped by `meta.category`
// for shapes and by tag for entities. Wired into the AppShell as the
// level-2 view in Pillar 5.
export function FullPage({ onClose }: FullPageProps) {
  const [entities, setEntities] = useState<EntityMeta[]>([])
  const [error, setError] = useState<string | null>(null)

  const surface = useCallback((err: unknown): string => {
    if (err instanceof LibraryAuthError) {
      return 'Library unavailable (401). Worker needs OPERATOR_TOKENS.'
    }
    if (err instanceof Error) return err.message
    return String(err)
  }, [])

  useEffect(() => {
    listEntities().then(setEntities).catch((err) => setError(surface(err)))
  }, [surface])

  const shapesByCategory = useMemo(() => {
    const buckets = new Map<string, typeof shapeMetas[string][]>()
    for (const s of Object.values(shapeMetas)) {
      const key = s.category ?? 'other'
      const list = buckets.get(key) ?? []
      list.push(s)
      buckets.set(key, list)
    }
    return [...buckets.entries()]
      .map(([k, list]) => [k, list.sort((a, b) => a.name.localeCompare(b.name))] as const)
      .sort(([a], [b]) => a.localeCompare(b))
  }, [])

  const entitiesByTag = useMemo(() => {
    const buckets = new Map<string, EntityMeta[]>()
    for (const e of entities) {
      const keys = e.tags.length > 0 ? e.tags : ['untagged']
      for (const k of keys) {
        const list = buckets.get(k) ?? []
        list.push(e)
        buckets.set(k, list)
      }
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [entities])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        background: 'rgba(17, 17, 27, 0.95)',
        color: '#cdd6f4',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid rgba(69, 71, 90, 0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>Shape Catalog</div>
        <div style={{ fontSize: 12, color: '#7f849c' }}>
          {Object.values(shapeMetas).length} shapes · {entities.length} entities · drag onto canvas
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close catalog"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#cdd6f4',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </header>

      {error && (
        <div
          style={{
            padding: '8px 18px',
            background: 'rgba(243, 139, 168, 0.12)',
            color: '#f38ba8',
            fontSize: 12,
            borderBottom: '1px solid rgba(243, 139, 168, 0.3)',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        <Section title="SHAPES">
          {shapesByCategory.map(([category, list]) => (
            <CategoryBlock key={category} title={category}>
              {list.map((s) => (
                <ShapeCard
                  key={s.id}
                  kind="shape"
                  id={s.id}
                  name={s.name}
                  description={s.description}
                  category={s.category}
                  defaultProps={s.defaultProps}
                  layout="tile"
                />
              ))}
            </CategoryBlock>
          ))}
        </Section>

        {entities.length > 0 && (
          <Section title="ENTITIES">
            {entitiesByTag.map(([tag, list]) => (
              <CategoryBlock key={tag} title={tag}>
                {list.map((e) => (
                  <ShapeCard
                    key={e.name}
                    kind="entity"
                    id={slugify(e.name)}
                    name={e.name}
                    description={e.description}
                    tags={e.tags}
                    layout="tile"
                  />
                ))}
              </CategoryBlock>
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 1.2,
          color: '#7f849c',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function CategoryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#cdd6f4',
          margin: '0 0 8px',
          textTransform: 'capitalize',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        {children}
      </div>
    </div>
  )
}
