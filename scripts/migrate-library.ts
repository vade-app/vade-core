#!/usr/bin/env tsx
/**
 * One-shot migration: copy a populated local `~/.vade/library/` up to
 * the cloud-backed library behind the Worker.
 *
 * Usage:
 *   VADE_LIBRARY_API_URL=https://vade-app.dev/library \
 *   VADE_LIBRARY_BEARER=<secret> \
 *   VADE_LIBRARY_PATH=~/.vade/library \   # optional; defaults to this
 *   tsx scripts/migrate-library.ts
 */
import { FsLibraryStore } from '../mcp/stores/fs.js'
import { CloudLibraryStore } from '../mcp/stores/cloud.js'

async function main() {
  const fs = new FsLibraryStore()
  const cloud = new CloudLibraryStore()

  const canvases = await fs.listCanvases()
  console.log(`[migrate] ${canvases.length} canvases found locally`)
  for (const meta of canvases) {
    const loaded = await fs.loadCanvas(meta.name)
    if (!loaded) {
      console.warn(`[migrate] skip "${meta.name}" — could not read snapshot`)
      continue
    }
    await cloud.saveCanvas(meta.name, loaded.snapshot, meta.tags, meta.description)
    console.log(`[migrate] canvas "${meta.name}" → cloud`)
  }

  const entities = await fs.listEntities()
  console.log(`[migrate] ${entities.length} entities found locally`)
  for (const meta of entities) {
    const loaded = await fs.loadEntity(meta.name)
    if (!loaded) {
      console.warn(`[migrate] skip entity "${meta.name}" — could not read shapes`)
      continue
    }
    await cloud.saveEntity(meta.name, loaded.shapes, meta.tags, meta.description)
    console.log(`[migrate] entity "${meta.name}" → cloud`)
  }

  console.log('[migrate] done')
}

main().catch(err => {
  console.error('[migrate] failed:', err)
  process.exit(1)
})
