/// <reference types="vite/client" />
import type { TLAnyShapeUtilConstructor } from '@tldraw/editor'
import type { ShapeMeta } from './_types'

const modules = import.meta.glob<{ meta: ShapeMeta }>(
  './*/index.ts',
  { eager: true },
)

const metaList: ShapeMeta[] = Object.values(modules)
  .map((m) => m.meta)
  .filter((m): m is ShapeMeta => Boolean(m))
  .sort((a, b) => a.id.localeCompare(b.id))

export const metas: Record<string, ShapeMeta> = Object.fromEntries(
  metaList.map((m) => [m.id, m]),
)

export const utils: TLAnyShapeUtilConstructor[] = metaList.map((m) => m.util)

function computeVersion(ids: string[]): string {
  if (typeof btoa === 'function') return btoa(ids.join('|')).slice(0, 8)
  return ids.join('|').slice(0, 8)
}

export const version: string = computeVersion(metaList.map((m) => m.id))
