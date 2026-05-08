import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync, copyFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { CanvasMeta, EntityMeta, LibraryStore, SnapshotMeta } from '../library.js'
import { slugify } from '../library.js'

function generateSnapshotId(label: string | undefined): string {
  const iso = new Date().toISOString().replace(/[:.]/g, '-')
  if (!label) return iso
  const slug = slugify(label)
  return slug ? `${iso}-${slug}` : iso
}

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

  async deleteCanvas(name: string): Promise<boolean> {
    const dir = join(this.canvasesDir, slugify(name))
    if (!existsSync(dir)) return false
    rmSync(dir, { recursive: true, force: true })
    return true
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

  async deleteEntity(name: string): Promise<boolean> {
    const dir = join(this.entitiesDir, slugify(name))
    if (!existsSync(dir)) return false
    rmSync(dir, { recursive: true, force: true })
    return true
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

  async saveSnapshot(canvasName: string, label?: string): Promise<SnapshotMeta> {
    const slug = slugify(canvasName)
    const dir = join(this.canvasesDir, slug)
    const head = join(dir, 'snapshot.tldr')
    if (!existsSync(head)) {
      throw new Error(`Canvas "${canvasName}" has no head snapshot`)
    }
    const historyDir = join(dir, 'history')
    mkdirSync(historyDir, { recursive: true })
    const snapshotId = generateSnapshotId(label || undefined)
    copyFileSync(head, join(historyDir, `${snapshotId}.tldr`))
    const created = new Date().toISOString()

    const indexPath = join(dir, 'history.json')
    const index: SnapshotMeta[] = (() => {
      try {
        return JSON.parse(readFileSync(indexPath, 'utf-8')) as SnapshotMeta[]
      } catch {
        return []
      }
    })()
    const meta: SnapshotMeta = {
      snapshot_id: snapshotId,
      canvas_slug: slug,
      label: label ?? '',
      created,
    }
    index.push(meta)
    writeFileSync(indexPath, JSON.stringify(index, null, 2))
    return meta
  }

  async listSnapshots(canvasName: string): Promise<SnapshotMeta[]> {
    const slug = slugify(canvasName)
    const indexPath = join(this.canvasesDir, slug, 'history.json')
    if (!existsSync(indexPath)) return []
    try {
      const all = JSON.parse(readFileSync(indexPath, 'utf-8')) as SnapshotMeta[]
      return all.sort((a, b) => (a.created < b.created ? 1 : -1))
    } catch {
      return []
    }
  }

  async restoreSnapshot(
    canvasName: string,
    snapshotId: string,
  ): Promise<{ snapshot: unknown; meta: CanvasMeta } | null> {
    const slug = slugify(canvasName)
    const dir = join(this.canvasesDir, slug)
    const snapPath = join(dir, 'history', `${snapshotId}.tldr`)
    if (!existsSync(snapPath)) return null
    const head = join(dir, 'snapshot.tldr')
    copyFileSync(snapPath, head)

    const metaPath = join(dir, 'metadata.json')
    if (!existsSync(metaPath)) return null
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as CanvasMeta
    meta.modified = new Date().toISOString()
    writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    const snapshot = JSON.parse(readFileSync(head, 'utf-8'))
    return { snapshot, meta }
  }

  async branchCanvas(
    parentName: string,
    newName: string,
    fromSnapshot?: string,
  ): Promise<CanvasMeta> {
    const parentSlug = slugify(parentName)
    const newSlug = slugify(newName)
    if (!newSlug) throw new Error(`name produced empty slug`)
    const parentDir = join(this.canvasesDir, parentSlug)
    const newDir = join(this.canvasesDir, newSlug)
    if (existsSync(newDir)) throw new Error(`Canvas "${newName}" already exists`)

    const sourcePath = fromSnapshot
      ? join(parentDir, 'history', `${fromSnapshot}.tldr`)
      : join(parentDir, 'snapshot.tldr')
    if (!existsSync(sourcePath)) {
      throw new Error(fromSnapshot ? 'from_snapshot not found on parent' : 'parent has no head snapshot')
    }

    mkdirSync(newDir, { recursive: true })
    copyFileSync(sourcePath, join(newDir, 'snapshot.tldr'))
    const now = new Date().toISOString()
    const meta: CanvasMeta = {
      name: newName,
      tags: [],
      description: '',
      created: now,
      modified: now,
      parent_slug: parentSlug,
      ...(fromSnapshot ? { parent_snapshot: fromSnapshot } : {}),
    }
    writeFileSync(join(newDir, 'metadata.json'), JSON.stringify(meta, null, 2))
    return meta
  }
}
