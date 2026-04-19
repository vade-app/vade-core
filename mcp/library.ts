/**
 * Library facade.
 *
 * Two surfaces live here:
 *
 * 1. The async {@link LibraryStore} interface and its driver
 *    selector {@link getLibraryStore} — consumed by the hosted MCP
 *    (issue #7) and any new code. Select via
 *    `VADE_LIBRARY_DRIVER=fs|cloud` (default `fs`).
 *
 * 2. A set of legacy synchronous re-exports (`saveCanvas`,
 *    `loadCanvas`, `listCanvases`, `saveEntity`, `loadEntity`,
 *    `listEntities`, `searchLibrary`) preserved so that
 *    `mcp/tools/canvas.ts` keeps working unchanged under the fs
 *    driver. These delegate to a process-wide
 *    {@link FsLibraryStore} and are filesystem-only by design —
 *    cloud access is always async and must go through
 *    {@link getLibraryStore}.
 */
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'fs'
import { join } from 'path'
import { homedir } from 'os'

import type {
  CanvasMeta,
  EntityMeta,
  LibraryStore,
  SearchResults,
} from './stores/types.js'
import { slugify } from './stores/types.js'
import { FsLibraryStore } from './stores/fs.js'
import { CloudLibraryStore } from './stores/cloud.js'

export type { CanvasMeta, EntityMeta, LibraryStore, SearchResults }
export { FsLibraryStore, CloudLibraryStore }

export type LibraryDriver = 'fs' | 'cloud'

export function resolveDriver(
  env: NodeJS.ProcessEnv = process.env,
): LibraryDriver {
  const raw = (env['VADE_LIBRARY_DRIVER'] ?? 'fs').toLowerCase()
  if (raw === 'cloud') return 'cloud'
  if (raw === 'fs') return 'fs'
  throw new Error(
    `[library] invalid VADE_LIBRARY_DRIVER=${raw}. Expected "fs" or "cloud".`,
  )
}

let activeStore: Promise<LibraryStore> | null = null

/**
 * Return the process-wide LibraryStore selected by
 * VADE_LIBRARY_DRIVER. Cached after first call.
 */
export function getLibraryStore(): Promise<LibraryStore> {
  if (activeStore) return activeStore
  const driver = resolveDriver()
  activeStore =
    driver === 'cloud'
      ? CloudLibraryStore.fromEnv()
      : Promise.resolve(new FsLibraryStore())
  return activeStore
}

/** Test hook: reset the cached driver. */
export function __resetLibraryStoreForTests(): void {
  activeStore = null
}

// ---------------------------------------------------------------
// Legacy synchronous fs-backed API.
//
// Preserved so `mcp/tools/canvas.ts` stays untouched. The canvas
// tools currently use these return values synchronously (no
// await), so they must remain sync. They are intentionally
// fs-only — downstream callers that need cloud storage must use
// {@link getLibraryStore} instead.
// ---------------------------------------------------------------

const LIBRARY_ROOT =
  process.env['VADE_LIBRARY_PATH'] ?? join(homedir(), '.vade', 'library')
const CANVASES_DIR = join(LIBRARY_ROOT, 'canvases')
const ENTITIES_DIR = join(LIBRARY_ROOT, 'entities')

function ensureDirs(): void {
  mkdirSync(CANVASES_DIR, { recursive: true })
  mkdirSync(ENTITIES_DIR, { recursive: true })
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

export function saveCanvas(
  name: string,
  snapshot: unknown,
  tags: string[] = [],
  description = '',
): CanvasMeta {
  ensureDirs()
  const dir = join(CANVASES_DIR, slugify(name))
  mkdirSync(dir, { recursive: true })

  const now = new Date().toISOString()
  const existingMeta = (() => {
    try {
      return JSON.parse(
        readFileSync(join(dir, 'metadata.json'), 'utf-8'),
      ) as CanvasMeta
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

export function loadCanvas(
  name: string,
): { snapshot: unknown; meta: CanvasMeta } | null {
  ensureDirs()
  const dir = join(CANVASES_DIR, slugify(name))
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

export function saveEntity(
  name: string,
  shapes: unknown[],
  tags: string[] = [],
  description = '',
): EntityMeta {
  ensureDirs()
  const dir = join(ENTITIES_DIR, slugify(name))
  mkdirSync(dir, { recursive: true })

  const meta: EntityMeta = { name, tags, description }
  writeFileSync(join(dir, 'shapes.json'), JSON.stringify(shapes, null, 2))
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify(meta, null, 2))
  return meta
}

export function loadEntity(
  name: string,
): { shapes: unknown[]; meta: EntityMeta } | null {
  ensureDirs()
  const dir = join(ENTITIES_DIR, slugify(name))
  const shapesPath = join(dir, 'shapes.json')
  const metaPath = join(dir, 'metadata.json')
  if (!existsSync(shapesPath) || !existsSync(metaPath)) return null
  return {
    shapes: JSON.parse(readFileSync(shapesPath, 'utf-8')) as unknown[],
    meta: JSON.parse(readFileSync(metaPath, 'utf-8')) as EntityMeta,
  }
}

export function searchLibrary(query: string): SearchResults {
  const q = query.toLowerCase()
  const canvases = listCanvases().filter(
    c =>
      c.name.toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q)) ||
      c.description.toLowerCase().includes(q),
  )
  const entities = listEntities().filter(
    e =>
      e.name.toLowerCase().includes(q) ||
      e.tags.some(t => t.toLowerCase().includes(q)) ||
      e.description.toLowerCase().includes(q),
  )
  return { canvases, entities }
}
