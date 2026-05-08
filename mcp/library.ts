export interface CanvasMeta {
  name: string
  tags: string[]
  description: string
  created: string
  modified: string
  parent_slug?: string
  parent_snapshot?: string
}

export interface EntityMeta {
  name: string
  tags: string[]
  description: string
}

export interface SnapshotMeta {
  snapshot_id: string
  canvas_slug: string
  label: string
  created: string
}

export interface LibraryStore {
  saveCanvas(name: string, snapshot: unknown, tags: string[], description: string): Promise<CanvasMeta>
  loadCanvas(name: string): Promise<{ snapshot: unknown; meta: CanvasMeta } | null>
  listCanvases(): Promise<CanvasMeta[]>
  deleteCanvas(name: string): Promise<boolean>
  saveEntity(name: string, shapes: unknown[], tags: string[], description: string): Promise<EntityMeta>
  loadEntity(name: string): Promise<{ shapes: unknown[]; meta: EntityMeta } | null>
  listEntities(): Promise<EntityMeta[]>
  deleteEntity(name: string): Promise<boolean>
  searchLibrary(query: string): Promise<{ canvases: CanvasMeta[]; entities: EntityMeta[] }>
  saveSnapshot(canvasName: string, label?: string): Promise<SnapshotMeta>
  listSnapshots(canvasName: string): Promise<SnapshotMeta[]>
  restoreSnapshot(canvasName: string, snapshotId: string): Promise<{ snapshot: unknown; meta: CanvasMeta } | null>
  branchCanvas(parentName: string, newName: string, fromSnapshot?: string): Promise<CanvasMeta>
}

export function slugify(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
}

let cached: LibraryStore | null = null

export async function getStore(): Promise<LibraryStore> {
  if (cached) return cached
  const driver = process.env['VADE_LIBRARY_DRIVER'] ?? 'fs'
  if (driver === 'cloud') {
    const { CloudLibraryStore } = await import('./stores/cloud.js')
    cached = new CloudLibraryStore()
  } else if (driver === 'fs') {
    const { FsLibraryStore } = await import('./stores/fs.js')
    cached = new FsLibraryStore()
  } else {
    throw new Error(`Unknown VADE_LIBRARY_DRIVER=${driver}; expected 'fs' or 'cloud'`)
  }
  return cached
}
