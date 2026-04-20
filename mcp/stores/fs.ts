import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { CanvasMeta, EntityMeta, LibraryStore } from '../library.js'
import { slugify } from '../library.js'

export class FsLibraryStore implements LibraryStore {
  private readonly root: string
  private readonly canvasesDir: string
  private readonly entitiesDir: string

  constructor(root?: string) {
    this.root = root ?? process.env['VADE_LIBRARY_PATH'] ?? join(homedir(), '.vade', 'library')
    this.canvasesDir = join(this.root, 'canvases')
    this.entitiesDir = join(this.root, 'entities')
  }

  private ensureDirs() {
    mkdirSync(this.canvasesDir, { recursive: true })
    mkdirSync(this.entitiesDir, { recursive: true })
  }

  async listCanvases(): Promise<CanvasMeta[]> {
    this.ensureDirs()
    const entries = readdirSync(this.canvasesDir, { withFileTypes: true })
    const results: CanvasMeta[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const metaPath = join(this.canvasesDir, entry.name, 'metadata.json')
      if (!existsSync(metaPath)) continue
      try {
        results.push(JSON.parse(readFileSync(metaPath, 'utf-8')) as CanvasMeta)
      } catch {
        // skip corrupt entries
      }
    }
    return results
  }

  async saveCanvas(name: string, snapshot: unknown, tags: string[], description: string): Promise<CanvasMeta> {
    this.ensureDirs()
    const dir = join(this.canvasesDir, slugify(name))
    mkdirSync(dir, { recursive: true })

    const now = new Date().toISOString()
    const existingMeta = (() => {
      try {
        return JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf-8')) as CanvasMeta
      } catch {
        return null
      }
    })()

    const meta: CanvasMeta = {
      name,
      tags,
      description,
      created: existingMeta?.created ?? now,
      modified: now,
    }

    writeFileSync(join(dir, 'snapshot.tldr'), JSON.stringify(snapshot))
    writeFileSync(join(dir, 'metadata.json'), JSON.stringify(meta, null, 2))
    return meta
  }

  async loadCanvas(name: string): Promise<{ snapshot: unknown; meta: CanvasMeta } | null> {
    this.ensureDirs()
    const dir = join(this.canvasesDir, slugify(name))
    const snapshotPath = join(dir, 'snapshot.tldr')
    const metaPath = join(dir, 'metadata.json')
    if (!existsSync(snapshotPath) || !existsSync(metaPath)) return null
    return {
      snapshot: JSON.parse(readFileSync(snapshotPath, 'utf-8')),
      meta: JSON.parse(readFileSync(metaPath, 'utf-8')) as CanvasMeta,
    }
  }

  async listEntities(): Promise<EntityMeta[]> {
    this.ensureDirs()
    const entries = readdirSync(this.entitiesDir, { withFileTypes: true })
    const results: EntityMeta[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const metaPath = join(this.entitiesDir, entry.name, 'metadata.json')
      if (!existsSync(metaPath)) continue
      try {
        results.push(JSON.parse(readFileSync(metaPath, 'utf-8')) as EntityMeta)
      } catch {
        // skip corrupt entries
      }
    }
    return results
  }

  async saveEntity(name: string, shapes: unknown[], tags: string[], description: string): Promise<EntityMeta> {
    this.ensureDirs()
    const dir = join(this.entitiesDir, slugify(name))
    mkdirSync(dir, { recursive: true })

    const meta: EntityMeta = { name, tags, description }
    writeFileSync(join(dir, 'shapes.json'), JSON.stringify(shapes, null, 2))
    writeFileSync(join(dir, 'metadata.json'), JSON.stringify(meta, null, 2))
    return meta
  }

  async loadEntity(name: string): Promise<{ shapes: unknown[]; meta: EntityMeta } | null> {
    this.ensureDirs()
    const dir = join(this.entitiesDir, slugify(name))
    const shapesPath = join(dir, 'shapes.json')
    const metaPath = join(dir, 'metadata.json')
    if (!existsSync(shapesPath) || !existsSync(metaPath)) return null
    return {
      shapes: JSON.parse(readFileSync(shapesPath, 'utf-8')) as unknown[],
      meta: JSON.parse(readFileSync(metaPath, 'utf-8')) as EntityMeta,
    }
  }

  async searchLibrary(query: string): Promise<{ canvases: CanvasMeta[]; entities: EntityMeta[] }> {
    const q = query.toLowerCase()
    const [allC, allE] = await Promise.all([this.listCanvases(), this.listEntities()])
    const canvases = allC.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q)) ||
      c.description.toLowerCase().includes(q),
    )
    const entities = allE.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.tags.some(t => t.toLowerCase().includes(q)) ||
      e.description.toLowerCase().includes(q),
    )
    return { canvases, entities }
  }
}
