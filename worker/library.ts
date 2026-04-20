import type { Env } from './index.js'

type CanvasMeta = {
  name: string
  tags: string[]
  description: string
  created: string
  modified: string
}

type EntityMeta = {
  name: string
  tags: string[]
  description: string
}

type CanvasRow = {
  slug: string
  name: string
  tags: string
  description: string
  created: string
  modified: string
}

type EntityRow = {
  slug: string
  name: string
  tags: string
  description: string
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const text = (body: string, status: number): Response =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })

function canvasMetaFromRow(row: CanvasRow): CanvasMeta {
  return {
    name: row.name,
    tags: JSON.parse(row.tags) as string[],
    description: row.description,
    created: row.created,
    modified: row.modified,
  }
}

function entityMetaFromRow(row: EntityRow): EntityMeta {
  return {
    name: row.name,
    tags: JSON.parse(row.tags) as string[],
    description: row.description,
  }
}

function canvasKey(slug: string): string {
  return `canvases/${slug}/snapshot.tldr`
}

function entityKey(slug: string): string {
  return `entities/${slug}/shapes.json`
}

export async function handleLibrary(req: Request, env: Env, url: URL): Promise<Response> {
  const auth = req.headers.get('Authorization') ?? ''
  const expected = `Bearer ${env.LIBRARY_BEARER}`
  if (!env.LIBRARY_BEARER || auth !== expected) {
    return text('Unauthorized', 401)
  }

  const parts = url.pathname.split('/').filter(Boolean)
  // [ 'library', <resource>, <slug?> ]
  const resource = parts[1]
  const slug = parts[2]

  try {
    if (resource === 'canvases') {
      if (!slug) {
        if (req.method === 'GET') return listCanvases(env)
        return text('Method not allowed', 405)
      }
      if (req.method === 'GET') return getCanvas(env, slug)
      if (req.method === 'PUT') return putCanvas(env, slug, await req.json())
      return text('Method not allowed', 405)
    }

    if (resource === 'entities') {
      if (!slug) {
        if (req.method === 'GET') return listEntities(env)
        return text('Method not allowed', 405)
      }
      if (req.method === 'GET') return getEntity(env, slug)
      if (req.method === 'PUT') return putEntity(env, slug, await req.json())
      return text('Method not allowed', 405)
    }

    if (resource === 'search' && req.method === 'GET') {
      return search(env, url.searchParams.get('q') ?? '')
    }

    return text('Not found', 404)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return text(`Library error: ${msg}`, 500)
  }
}

async function listCanvases(env: Env): Promise<Response> {
  const { results } = await env.LIBRARY_D1
    .prepare('SELECT slug, name, tags, description, created, modified FROM canvases ORDER BY modified DESC')
    .all<CanvasRow>()
  return json(results.map(canvasMetaFromRow))
}

async function getCanvas(env: Env, slug: string): Promise<Response> {
  const row = await env.LIBRARY_D1
    .prepare('SELECT slug, name, tags, description, created, modified FROM canvases WHERE slug = ?')
    .bind(slug)
    .first<CanvasRow>()
  if (!row) return text('Not found', 404)
  const obj = await env.LIBRARY_R2.get(canvasKey(slug))
  if (!obj) return text('Not found', 404)
  const snapshot = JSON.parse(await obj.text())
  return json({ snapshot, meta: canvasMetaFromRow(row) })
}

async function putCanvas(env: Env, slug: string, body: unknown): Promise<Response> {
  const b = body as { name?: unknown; snapshot?: unknown; tags?: unknown; description?: unknown }
  if (typeof b.name !== 'string') return text('name required', 400)
  if (b.snapshot === undefined) return text('snapshot required', 400)
  const tags = Array.isArray(b.tags) ? (b.tags as string[]) : []
  const description = typeof b.description === 'string' ? b.description : ''
  const now = new Date().toISOString()

  const existing = await env.LIBRARY_D1
    .prepare('SELECT created FROM canvases WHERE slug = ?')
    .bind(slug)
    .first<{ created: string }>()
  const created = existing?.created ?? now

  await env.LIBRARY_R2.put(canvasKey(slug), JSON.stringify(b.snapshot))
  await env.LIBRARY_D1
    .prepare(
      `INSERT INTO canvases (slug, name, tags, description, created, modified)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         name = excluded.name,
         tags = excluded.tags,
         description = excluded.description,
         modified = excluded.modified`,
    )
    .bind(slug, b.name, JSON.stringify(tags), description, created, now)
    .run()

  return json({ name: b.name, tags, description, created, modified: now } satisfies CanvasMeta)
}

async function listEntities(env: Env): Promise<Response> {
  const { results } = await env.LIBRARY_D1
    .prepare('SELECT slug, name, tags, description FROM entities ORDER BY name')
    .all<EntityRow>()
  return json(results.map(entityMetaFromRow))
}

async function getEntity(env: Env, slug: string): Promise<Response> {
  const row = await env.LIBRARY_D1
    .prepare('SELECT slug, name, tags, description FROM entities WHERE slug = ?')
    .bind(slug)
    .first<EntityRow>()
  if (!row) return text('Not found', 404)
  const obj = await env.LIBRARY_R2.get(entityKey(slug))
  if (!obj) return text('Not found', 404)
  const shapes = JSON.parse(await obj.text()) as unknown[]
  return json({ shapes, meta: entityMetaFromRow(row) })
}

async function putEntity(env: Env, slug: string, body: unknown): Promise<Response> {
  const b = body as { name?: unknown; shapes?: unknown; tags?: unknown; description?: unknown }
  if (typeof b.name !== 'string') return text('name required', 400)
  if (!Array.isArray(b.shapes)) return text('shapes must be array', 400)
  const tags = Array.isArray(b.tags) ? (b.tags as string[]) : []
  const description = typeof b.description === 'string' ? b.description : ''

  await env.LIBRARY_R2.put(entityKey(slug), JSON.stringify(b.shapes))
  await env.LIBRARY_D1
    .prepare(
      `INSERT INTO entities (slug, name, tags, description)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         name = excluded.name,
         tags = excluded.tags,
         description = excluded.description`,
    )
    .bind(slug, b.name, JSON.stringify(tags), description)
    .run()

  return json({ name: b.name, tags, description } satisfies EntityMeta)
}

async function search(env: Env, query: string): Promise<Response> {
  // D1 doesn't have a great fuzzy search primitive; fall back to
  // LIKE on name/description/tags (tags are JSON-encoded, so
  // substring hits the raw JSON which is fine for single-user scale).
  const q = `%${query.toLowerCase()}%`
  const canvasQ = env.LIBRARY_D1
    .prepare(
      `SELECT slug, name, tags, description, created, modified FROM canvases
       WHERE lower(name) LIKE ? OR lower(description) LIKE ? OR lower(tags) LIKE ?
       ORDER BY modified DESC`,
    )
    .bind(q, q, q)
    .all<CanvasRow>()
  const entityQ = env.LIBRARY_D1
    .prepare(
      `SELECT slug, name, tags, description FROM entities
       WHERE lower(name) LIKE ? OR lower(description) LIKE ? OR lower(tags) LIKE ?
       ORDER BY name`,
    )
    .bind(q, q, q)
    .all<EntityRow>()
  const [c, e] = await Promise.all([canvasQ, entityQ])
  return json({
    canvases: c.results.map(canvasMetaFromRow),
    entities: e.results.map(entityMetaFromRow),
  })
}
