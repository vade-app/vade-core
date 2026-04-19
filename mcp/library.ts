import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const LIBRARY_ROOT = process.env['VADE_LIBRARY_PATH'] ?? join(homedir(), '.vade', 'library')
const CANVASES_DIR = join(LIBRARY_ROOT, 'canvases')
const ENTITIES_DIR = join(LIBRARY_ROOT, 'entities')

function ensureDirs() {
  mkdirSync(CANVASES_DIR, { recursive: true })
  mkdirSync(ENTITIES_DIR, { recursive: true })
}

export interface CanvasMeta {
  name: string
  tags: string[]
  description: string
  created: string
  modified: string
}

export interface EntityMeta {
  name: string
  tags: string[]
  description: string
}

export function listCanvases(): CanvasMeta[] {
  ensureDirs()
  const entries = readdirSync(CANVASES_DIR, { withFileTypes: true })
  const results: CanvasMeta[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = join(CANVASES_DIR, entry.name, 'metadata.json')
    if (!existsSync(metaPath)) continue
    try {
      results.push(JSON.parse(readFileSync(metaPath, 'utf-8')) as CanvasMeta)
    } catch {
      // skip corrupt entries
    }
  }
  return results
}

export function saveCanvas(name: string, snapshot: unknown, tags: string[] = [], description = '') {
  ensureDirs()
  const slug = name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
  const dir = join(CANVASES_DIR, slug)
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

export function loadCanvas(name: string): { snapshot: unknown; meta: CanvasMeta } | null {
  ensureDirs()
  const slug = name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
  const dir = join(CANVASES_DIR, slug)
  const snapshotPath = join(dir, 'snapshot.tldr')
  const metaPath = join(dir, 'metadata.json')
  if (!existsSync(snapshotPath) || !existsSync(metaPath)) return null
  return {
    snapshot: JSON.parse(readFileSync(snapshotPath, 'utf-8')),
    meta: JSON.parse(readFileSync(metaPath, 'utf-8')) as CanvasMeta,
  }
}

export function listEntities(): EntityMeta[] {
  ensureDirs()
  const entries = readdirSync(ENTITIES_DIR, { withFileTypes: true })
  const results: EntityMeta[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = join(ENTITIES_DIR, entry.name, 'metadata.json')
    if (!existsSync(metaPath)) continue
    try {
      results.push(JSON.parse(readFileSync(metaPath, 'utf-8')) as EntityMeta)
    } catch {
      // skip corrupt entries
    }
  }
  return results
}

export function saveEntity(name: string, shapes: unknown[], tags: string[] = [], description = '') {
  ensureDirs()
  const slug = name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
  const dir = join(ENTITIES_DIR, slug)
  mkdirSync(dir, { recursive: true })

  const meta: EntityMeta = { name, tags, description }
  writeFileSync(join(dir, 'shapes.json'), JSON.stringify(shapes, null, 2))
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify(meta, null, 2))
  return meta
}

export function loadEntity(name: string): { shapes: unknown[]; meta: EntityMeta } | null {
  ensureDirs()
  const slug = name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
  const dir = join(ENTITIES_DIR, slug)
  const shapesPath = join(dir, 'shapes.json')
  const metaPath = join(dir, 'metadata.json')
  if (!existsSync(shapesPath) || !existsSync(metaPath)) return null
  return {
    shapes: JSON.parse(readFileSync(shapesPath, 'utf-8')) as unknown[],
    meta: JSON.parse(readFileSync(metaPath, 'utf-8')) as EntityMeta,
  }
}

export function searchLibrary(query: string): { canvases: CanvasMeta[]; entities: EntityMeta[] } {
  const q = query.toLowerCase()
  const canvases = listCanvases().filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.tags.some(t => t.toLowerCase().includes(q)) ||
    c.description.toLowerCase().includes(q)
  )
  const entities = listEntities().filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.tags.some(t => t.toLowerCase().includes(q)) ||
    e.description.toLowerCase().includes(q)
  )
  return { canvases, entities }
}
