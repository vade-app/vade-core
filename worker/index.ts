import { handleLibrary } from './library.js'

export interface Env {
  ASSETS: Fetcher
  LIBRARY_R2: R2Bucket
  vade_library: D1Database
  LIBRARY_BEARER: string
  // JSON of shape {"operator":[...],"agents":[...]} — same as Fly's VADE_AUTH_TOKENS.
  // When set, tokens in either array are accepted on /library/* in addition to LIBRARY_BEARER.
  // See docs/auth.md and wrangler.jsonc for provisioning.
  OPERATOR_TOKENS?: string
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
