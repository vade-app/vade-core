/**
 * LibraryStore — storage abstraction for canvas snapshots and
 * reusable entity groups.
 *
 * Implementations:
 * - FsLibraryStore   (mcp/stores/fs.ts)    — default local dev.
 * - CloudLibraryStore (mcp/stores/cloud.ts) — Cloudflare R2 blobs
 *   + D1 metadata, selected by VADE_LIBRARY_DRIVER=cloud.
 *
 * Call-sites in mcp/tools/canvas.ts must continue to work against
 * this interface without modification; the re-exports in
 * mcp/library.ts preserve the legacy module-level function shape
 * by delegating to the active driver.
 */

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

export interface SearchResults {
  canvases: CanvasMeta[]
  entities: EntityMeta[]
}

export interface LibraryStore {
  /** Persist a canvas snapshot under `name`. Returns the stored meta. */
  saveCanvas(
    name: string,
    snapshot: unknown,
    tags?: string[],
    description?: string,
  ): Promise<CanvasMeta>

  /** Load a canvas by name. Resolves null when not found. */
  loadCanvas(
    name: string,
  ): Promise<{ snapshot: unknown; meta: CanvasMeta } | null>

  /** List all canvases. Order is implementation-defined. */
  listCanvases(): Promise<CanvasMeta[]>

  /** Persist an entity (a group of normalized shapes) under `name`. */
  saveEntity(
    name: string,
    shapes: unknown[],
    tags?: string[],
    description?: string,
  ): Promise<EntityMeta>

  /** Load an entity by name. Resolves null when not found. */
  loadEntity(
    name: string,
  ): Promise<{ shapes: unknown[]; meta: EntityMeta } | null>

  /** List all entities. Order is implementation-defined. */
  listEntities(): Promise<EntityMeta[]>

  /** Substring search over name / tags / description. */
  searchLibrary(query: string): Promise<SearchResults>
}

export function slugify(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
}
