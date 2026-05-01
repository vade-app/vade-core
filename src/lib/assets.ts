// SPA-side client for the Worker's /library/assets/* endpoints.
// Mirrors src/lib/library.ts. Assets are content-addressed by SHA-256
// computed server-side; the client just POSTs bytes and receives a hash.

import { LibraryAuthError, LibraryError } from './library'

const TOKEN_STORAGE_KEY = 'vade-auth-token'

function readToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(TOKEN_STORAGE_KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

function baseUrl(): string {
  const override = import.meta.env.VITE_LIBRARY_URL as string | undefined
  if (override && override.trim()) return override.replace(/\/+$/, '')
  return ''
}

export async function uploadAsset(file: Blob): Promise<string> {
  const token = readToken()
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', file.type || 'application/octet-stream')
  const res = await fetch(`${baseUrl()}/library/assets`, {
    method: 'POST',
    headers,
    body: file,
  })
  if (res.status === 401) throw new LibraryAuthError()
  if (!res.ok) throw new LibraryError(await res.text(), res.status)
  const body = (await res.json()) as { hash: string }
  return body.hash
}

export async function fetchAssetBlob(hash: string): Promise<Blob> {
  const token = readToken()
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${baseUrl()}/library/assets/${encodeURIComponent(hash)}`, {
    headers,
  })
  if (res.status === 401) throw new LibraryAuthError()
  if (!res.ok) throw new LibraryError(await res.text(), res.status)
  return await res.blob()
}
