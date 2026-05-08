// SPA-side client for the Worker's /library/canvases/* endpoints.
// Mirrors the MCP side (mcp/library.ts, mcp/stores/cloud.ts) so that
// saves from the SPA and saves from MCP round-trip through the same
// canonical R2 + D1 store.

export interface CanvasMeta {
  name: string
  tags: string[]
  description: string
  created: string
  modified: string
  parent_slug?: string
  parent_snapshot?: string
}

export interface SnapshotMeta {
  snapshot_id: string
  canvas_slug: string
  label: string
  created: string
}

export class LibraryAuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'LibraryAuthError'
  }
}

export class LibraryError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'LibraryError'
  }
}

const TOKEN_STORAGE_KEY = 'vade-auth-token'

function readToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(TOKEN_STORAGE_KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

function baseUrl(): string {
  // Dev convenience: point the SPA on :5173 at a remote or local wrangler.
  // In prod the SPA is same-origin with the Worker, so an empty base is
  // correct (fetch('/library/canvases') resolves against the page origin).
  const override = import.meta.env.VITE_LIBRARY_URL as string | undefined
  if (override && override.trim()) return override.replace(/\/+$/, '')
  return ''
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const token = readToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers })
  if (res.status === 401) {
    throw new LibraryAuthError()
  }
  return res
}

// Identical shape to mcp/library.ts:27-29 — do not diverge.
export function slugify(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
}

export async function listCanvases(): Promise<CanvasMeta[]> {
  const res = await request('/library/canvases')
  if (!res.ok) throw new LibraryError(await res.text(), res.status)
  return (await res.json()) as CanvasMeta[]
}

export async function getCanvas(
  slug: string,
): Promise<{ snapshot: unknown; meta: CanvasMeta } | null> {
  const res = await request(`/library/canvases/${encodeURIComponent(slug)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new LibraryError(await res.text(), res.status)
  return (await res.json()) as { snapshot: unknown; meta: CanvasMeta }
}

export async function saveCanvas(
  name: string,
  snapshot: unknown,
  tags: string[] = [],
  description = '',
): Promise<CanvasMeta> {
  const slug = slugify(name)
  const res = await request(`/library/canvases/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: JSON.stringify({ name, snapshot, tags, description }),
  })
  if (!res.ok) throw new LibraryError(await res.text(), res.status)
  return (await res.json()) as CanvasMeta
}

export async function deleteCanvas(slug: string): Promise<boolean> {
  const res = await request(`/library/canvases/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  })
  if (res.status === 404) return false
  if (!res.ok) throw new LibraryError(await res.text(), res.status)
  return true
}

export async function listSnapshots(slug: string): Promise<SnapshotMeta[]> {
  const res = await request(`/library/canvases/${encodeURIComponent(slug)}/snapshots`)
  if (res.status === 404) return []
  if (!res.ok) throw new LibraryError(await res.text(), res.status)
  return (await res.json()) as SnapshotMeta[]
}

export async function saveSnapshot(slug: string, label = ''): Promise<SnapshotMeta> {
  const res = await request(`/library/canvases/${encodeURIComponent(slug)}/snapshots`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  })
  if (!res.ok) throw new LibraryError(await res.text(), res.status)
  return (await res.json()) as SnapshotMeta
}

export async function deleteSnapshot(slug: string, snapshotId: string): Promise<boolean> {
  const res = await request(
    `/library/canvases/${encodeURIComponent(slug)}/snapshots/${encodeURIComponent(snapshotId)}`,
    { method: 'DELETE' },
  )
  if (res.status === 404) return false
  if (!res.ok) throw new LibraryError(await res.text(), res.status)
  return true
}

export async function restoreSnapshot(
  slug: string,
  snapshotId: string,
): Promise<{ snapshot: unknown; meta: CanvasMeta } | null> {
  const res = await request(`/library/canvases/${encodeURIComponent(slug)}/restore`, {
    method: 'POST',
    body: JSON.stringify({ snapshot_id: snapshotId }),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new LibraryError(await res.text(), res.status)
  return (await res.json()) as { snapshot: unknown; meta: CanvasMeta }
}

export async function branchCanvas(
  parentSlug: string,
  newName: string,
  fromSnapshot?: string,
): Promise<CanvasMeta> {
  const res = await request(`/library/canvases/${encodeURIComponent(parentSlug)}/branch`, {
    method: 'POST',
    body: JSON.stringify({
      name: newName,
      ...(fromSnapshot ? { from_snapshot: fromSnapshot } : {}),
    }),
  })
  if (!res.ok) throw new LibraryError(await res.text(), res.status)
  return (await res.json()) as CanvasMeta
}
