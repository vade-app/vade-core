import type { TLAsset, TLAssetStore } from 'tldraw'
import { fetchAssetBlob, uploadAsset } from '../lib/assets'

// Custom asset URL scheme that round-trips through canvas snapshots.
// `props.src` carries `asset:vade-<sha256>` — a stable, content-addressed
// reference. resolve() turns that into a fetchable blob URL on demand.
// Foreign URLs (default tldraw bookmarks, http(s) thumbnails) pass through
// untouched. The `asset:` scheme is one of tldraw's allowlisted srcUrl
// protocols ({http:, https:, data:, asset:} per @tldraw/validate); we
// sub-namespace under it with `vade-` so our records are distinguishable
// from legacy / default-store ones.
const SCHEME = 'asset:vade-'

function parseHash(src: string | null | undefined): string | null {
  if (!src || !src.startsWith(SCHEME)) return null
  const hash = src.slice(SCHEME.length)
  return /^[0-9a-f]{64}$/.test(hash) ? hash : null
}

export function createVadeAssetStore(): TLAssetStore {
  // Per-session cache of resolved object URLs. Keyed by hash so the same
  // image referenced from multiple shapes / pages only fetches once. The
  // value is a Promise so concurrent resolves coalesce.
  const cache = new Map<string, Promise<string>>()

  return {
    async upload(_asset: TLAsset, file: File) {
      const hash = await uploadAsset(file)
      return { src: `${SCHEME}${hash}` }
    },

    resolve(asset, _ctx) {
      const src = asset.props && 'src' in asset.props ? (asset.props.src as string | null) : null
      const hash = parseHash(src)
      if (!hash) return src ?? null
      let entry = cache.get(hash)
      if (!entry) {
        entry = fetchAssetBlob(hash)
          .then((blob) => URL.createObjectURL(blob))
          .catch((err) => {
            cache.delete(hash)
            throw err
          })
        cache.set(hash, entry)
      }
      return entry
    },
  }
}
