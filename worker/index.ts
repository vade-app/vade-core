import { handleLibrary } from './library.js'

export interface Env {
  ASSETS: Fetcher
  LIBRARY_R2: R2Bucket
  LIBRARY_D1: D1Database
  LIBRARY_BEARER: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/library' || url.pathname.startsWith('/library/')) {
      return handleLibrary(request, env, url)
    }
    return env.ASSETS.fetch(request)
  },
}
