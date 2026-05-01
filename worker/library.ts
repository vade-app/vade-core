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

function assetKey(hash: string): string {
  return `assets/${hash}`
}

const ASSET_HASH_RE = /^[0-9a-f]{64}$/

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Per-isolate cache of the parsed OPERATOR_TOKENS JSON. Keyed off the raw
// env value so a secret rotation (which spawns a new isolate with a fresh
// env) naturally invalidates without explicit reset. The parse cost is
// invisible at single-operator scale today; the cache becomes load-bearing
// if/when OPERATOR_TOKENS migrates to Secrets Store, where each access
// flips from sync `env.X` to async `await env.X.get()`.
let operatorTokensCache: {
  raw: string
  tokens: readonly string[]
} | null = null

function getOperatorTokens(env: Env): readonly string[] {
  const raw = env.OPERATOR_TOKENS
  if (!raw) return []
  if (operatorTokensCache?.raw === raw) return operatorTokensCache.tokens
  try {
    const parsed = JSON.parse(raw) as { operator?: unknown; agents?: unknown }
    const operator = Array.isArray(parsed.operator) ? parsed.operator : []
    const agents = Array.isArray(parsed.agents) ? parsed.agents : []
    const tokens = [...operator, ...agents].filter(
      (t): t is string => typeof t === 'string',
    )
    operatorTokensCache = { raw, tokens }
    return tokens
  } catch (err) {
    console.warn('OPERATOR_TOKENS is not valid JSON; ignoring', err)
    operatorTokensCache = { raw, tokens: [] }
    return []
  }
}

// Accept LIBRARY_BEARER (service-to-service secret shared with Fly) OR any
// token listed in OPERATOR_TOKENS.{operator,agents}[] (same JSON shape as
// Fly's VADE_AUTH_TOKENS). The second path lets the SPA reach /library/*
// directly with the operator's localStorage bearer. This deliberately
// widens the leaked-client-token blast radius from "MCP surface only" to
// "MCP + library"; trade-off documented in docs/auth.md.
function isAuthorized(req: Request, env: Env): boolean {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  if (!token) return false

  if (env.LIBRARY_BEARER && token === env.LIBRARY_BEARER) return true

  for (const t of getOperatorTokens(env)) {
    if (t === token) return true
  }

  return false
}

function entityKey(slug: string): string {
  return `entities/${slug}/shapes.json`
}

export async function handleLibrary(req: Request, env: Env, url: URL): Promise<Response> {
  if (!isAuthorized(req, env)) {
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
      if (req.method === 'DELETE') return deleteCanvas(env, slug)
      return text('Method not allowed', 405)
    }

    if (resource === 'entities') {
      if (!slug) {
        if (req.method === 'GET') return listEntities(env)
        return text('Method not allowed', 405)
      }
      if (req.method === 'GET') return getEntity(env, slug)
      if (req.method === 'PUT') return putEntity(env, slug, await req.json())
      if (req.method === 'DELETE') return deleteEntity(env, slug)
      return text('Method not allowed', 405)
    }

    if (resource === 'assets') {
      if (!slug) {
        if (req.method === 'POST') return putAsset(req, env)
        return text('Method not allowed', 405)
      }
      if (req.method === 'GET') return getAsset(env, slug)
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
  const { results } = await env.vade_library
    .prepare('SELECT slug, name, tags, description, created, modified FROM canvases ORDER BY modified DESC')
    .all<CanvasRow>()
  return json(results.map(canvasMetaFromRow))
}

async function getCanvas(env: Env, slug: string): Promise<Response> {
  const row = await env.vade_library
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

  const existing = await env.vade_library
    .prepare('SELECT created FROM canvases WHERE slug = ?')
    .bind(slug)
    .first<{ created: string }>()
  const created = existing?.created ?? now

  await env.LIBRARY_R2.put(canvasKey(slug), JSON.stringify(b.snapshot))
  await env.vade_library
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

async function deleteCanvas(env: Env, slug: string): Promise<Response> {
  const existing = await env.vade_library
    .prepare('SELECT slug FROM canvases WHERE slug = ?')
    .bind(slug)
    .first<{ slug: string }>()
  if (!existing) return text('Not found', 404)

  await env.LIBRARY_R2.delete(canvasKey(slug))
  await env.vade_library.prepare('DELETE FROM canvases WHERE slug = ?').bind(slug).run()
  return new Response(null, { status: 204 })
}

// Content-addressed binary assets (uploaded images, etc.) referenced from
// canvas snapshots. Hash is the SHA-256 of the bytes, computed server-side
// so a misbehaving client can't poison the store under a wrong key. The
// content-type is preserved on the R2 object's httpMetadata so GETs serve
// the correct MIME without a separate D1 row. See src/assets/vade-asset-store.ts
// for the matching client side.
async function putAsset(req: Request, env: Env): Promise<Response> {
  const contentType = req.headers.get('Content-Type') ?? 'application/octet-stream'
  const bytes = await req.arrayBuffer()
  if (bytes.byteLength === 0) return text('empty body', 400)
  const hash = await sha256Hex(bytes)
  const key = assetKey(hash)
  const existing = await env.LIBRARY_R2.head(key)
  if (!existing) {
    await env.LIBRARY_R2.put(key, bytes, {
      httpMetadata: { contentType },
    })
  }
  return json({ hash })
}

async function getAsset(env: Env, hash: string): Promise<Response> {
  if (!ASSET_HASH_RE.test(hash)) return text('Not found', 404)
  const obj = await env.LIBRARY_R2.get(assetKey(hash))
  if (!obj) return text('Not found', 404)
  const headers = new Headers()
  headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'application/octet-stream')
  // Content-addressed: bytes are immutable for a given hash, so cache
  // aggressively. Browsers and CF's edge cache will both honor this.
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(obj.body, { headers })
}

async function listEntities(env: Env): Promise<Response> {
  const { results } = await env.vade_library
    .prepare('SELECT slug, name, tags, description FROM entities ORDER BY name')
    .all<EntityRow>()
  return json(results.map(entityMetaFromRow))
}

async function getEntity(env: Env, slug: string): Promise<Response> {
  const row = await env.vade_library
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
  await env.vade_library
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

async function deleteEntity(env: Env, slug: string): Promise<Response> {
  const existing = await env.vade_library
    .prepare('SELECT slug FROM entities WHERE slug = ?')
    .bind(slug)
    .first<{ slug: string }>()
  if (!existing) return text('Not found', 404)

  await env.LIBRARY_R2.delete(entityKey(slug))
  await env.vade_library.prepare('DELETE FROM entities WHERE slug = ?').bind(slug).run()
  return new Response(null, { status: 204 })
}

async function search(env: Env, query: string): Promise<Response> {
  // D1 doesn't have a great fuzzy search primitive; fall back to
  // LIKE on name/description/tags (tags are JSON-encoded, so
  // substring hits the raw JSON which is fine for single-user scale).
  const q = `%${query.toLowerCase()}%`
  const canvasQ = env.vade_library
    .prepare(
      `SELECT slug, name, tags, description, created, modified FROM canvases
       WHERE lower(name) LIKE ? OR lower(description) LIKE ? OR lower(tags) LIKE ?
       ORDER BY modified DESC`,
    )
    .bind(q, q, q)
    .all<CanvasRow>()
  const entityQ = env.vade_library
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
