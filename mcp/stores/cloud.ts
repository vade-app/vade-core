import type { CanvasMeta, EntityMeta, LibraryStore } from '../library.js'
import { slugify } from '../library.js'

export class CloudLibraryStore implements LibraryStore {
  private readonly apiUrl: string
  private readonly bearer: string

  constructor() {
    const apiUrl = process.env['VADE_LIBRARY_API_URL']
    const bearer = process.env['VADE_LIBRARY_BEARER']
    if (!apiUrl) throw new Error('VADE_LIBRARY_API_URL must be set when VADE_LIBRARY_DRIVER=cloud')
    if (!bearer) throw new Error('VADE_LIBRARY_BEARER must be set when VADE_LIBRARY_DRIVER=cloud')
    this.apiUrl = apiUrl.replace(/\/$/, '')
    this.bearer = bearer
  }

  private async req(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.bearer}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return res
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.req(method, path, body)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Cloud library ${method} ${path} failed: ${res.status} ${text}`)
    }
    return (await res.json()) as T
  }

  async saveCanvas(name: string, snapshot: unknown, tags: string[], description: string): Promise<CanvasMeta> {
    return this.json<CanvasMeta>('PUT', `/canvases/${slugify(name)}`, { name, snapshot, tags, description })
  }

  async loadCanvas(name: string): Promise<{ snapshot: unknown; meta: CanvasMeta } | null> {
    const res = await this.req('GET', `/canvases/${slugify(name)}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Cloud library GET canvas failed: ${res.status}`)
    return (await res.json()) as { snapshot: unknown; meta: CanvasMeta }
  }

  async listCanvases(): Promise<CanvasMeta[]> {
    return this.json<CanvasMeta[]>('GET', `/canvases`)
  }

  async saveEntity(name: string, shapes: unknown[], tags: string[], description: string): Promise<EntityMeta> {
    return this.json<EntityMeta>('PUT', `/entities/${slugify(name)}`, { name, shapes, tags, description })
  }

  async loadEntity(name: string): Promise<{ shapes: unknown[]; meta: EntityMeta } | null> {
    const res = await this.req('GET', `/entities/${slugify(name)}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Cloud library GET entity failed: ${res.status}`)
    return (await res.json()) as { shapes: unknown[]; meta: EntityMeta }
  }

  async listEntities(): Promise<EntityMeta[]> {
    return this.json<EntityMeta[]>('GET', `/entities`)
  }

  async searchLibrary(query: string): Promise<{ canvases: CanvasMeta[]; entities: EntityMeta[] }> {
    return this.json('GET', `/search?q=${encodeURIComponent(query)}`)
  }
}
