// MCP authorization-server surface for vade-mcp.
//
// Implements the subset of OAuth 2.1 / RFC 7591 / RFC 9728 / RFC 8414 / RFC 8707
// that the MCP authorization spec (revision 2025-06-18) requires for Claude.ai's
// "Add custom connector" flow. Existing bearer clients (Claude Desktop, Claude
// Code, iPad PWA) are untouched: their tokens never start with `vade_at_` and
// therefore fall through to the existing matchToken path in mcp/auth.ts.
//
// Tokens are bound to the operator entry (in VADE_AUTH_TOKENS) that approved
// their consent, so rotating that secret invalidates every issued OAuth token
// via the startup sweep — one rotation regime, per docs/auth.md.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { type AuthConfig, type Principal, verifyBearer } from './auth.js'

const ACCESS_TOKEN_PREFIX = 'vade_at_'
const REFRESH_TOKEN_PREFIX = 'vade_rt_'
const ACCESS_TOKEN_TTL_S = 3600
const REFRESH_TOKEN_TTL_S = 30 * 24 * 3600
const AUTH_CODE_TTL_S = 60
const CONSENT_NONCE_TTL_S = 5 * 60
const SUPPORTED_SCOPE = 'mcp'

interface ClientRegistration {
  clientId: string
  redirectUris: string[]
  clientName: string
  createdAt: number
}

interface AuthCode {
  clientId: string
  redirectUri: string
  codeChallenge: string
  resource: string
  operatorTokenId: string
  expiresAt: number
}

interface AccessToken {
  clientId: string
  refreshTokenId: string
  operatorTokenId: string
  expiresAt: number
}

interface RefreshToken {
  clientId: string
  operatorTokenId: string
  expiresAt: number
}

interface ConsentNonce {
  // HMAC-style fingerprint of the canonicalized authorize-request params.
  paramsHash: string
  expiresAt: number
}

export interface OAuthContext {
  issuer: string
  resource: string
}

export class OAuthStore {
  readonly clients = new Map<string, ClientRegistration>()
  readonly codes = new Map<string, AuthCode>()
  readonly accessTokens = new Map<string, AccessToken>()
  readonly refreshTokens = new Map<string, RefreshToken>()
  readonly consentNonces = new Map<string, ConsentNonce>()

  sweepExpired(now: number): void {
    for (const [code, v] of this.codes) if (v.expiresAt <= now) this.codes.delete(code)
    for (const [tok, v] of this.accessTokens) if (v.expiresAt <= now) this.accessTokens.delete(tok)
    for (const [tok, v] of this.refreshTokens) if (v.expiresAt <= now) this.refreshTokens.delete(tok)
    for (const [n, v] of this.consentNonces) if (v.expiresAt <= now) this.consentNonces.delete(n)
  }

  // Drop any token whose operator-token-id is no longer in the authoritative
  // operator list. Called on startup and any time auth config rotates.
  sweepOnAuthConfigChange(cfg: AuthConfig): void {
    const live = new Set(cfg.operator.map((t) => operatorTokenId(t)))
    for (const [tok, v] of this.accessTokens) {
      if (!live.has(v.operatorTokenId)) this.accessTokens.delete(tok)
    }
    for (const [tok, v] of this.refreshTokens) {
      if (!live.has(v.operatorTokenId)) this.refreshTokens.delete(tok)
    }
    for (const [code, v] of this.codes) {
      if (!live.has(v.operatorTokenId)) this.codes.delete(code)
    }
  }
}

export function operatorTokenId(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex').slice(0, 16)
}

function randomToken(prefix: string): string {
  return prefix + randomBytes(32).toString('hex')
}

function randomId(): string {
  return randomBytes(16).toString('hex')
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function isValidRedirectUri(uri: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(uri)
  } catch {
    return false
  }
  if (parsed.protocol === 'https:') return true
  if (parsed.protocol === 'http:') {
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  }
  return false
}

// RFC 8707 §2: the resource indicator MUST be an absolute URI. The MCP spec
// (rev 2025-06-18 §2.10) tells clients to use the canonical resource URI from
// the protected-resource metadata, but real clients (notably Claude.ai's "Add
// custom connector") send the URL the user typed — e.g. the SSE endpoint
// `https://mcp.vade-app.dev/sse` rather than the issuer root. We accept any
// URI whose origin equals our canonical resource origin, which keeps the
// audience-binding intent of RFC 8707 (you can't redirect a token to a
// different host) while not breaking on path drift.
function resourceMatches(received: string | null, canonical: string): boolean {
  if (received == null || received === '') return true
  let receivedUrl: URL
  let canonicalUrl: URL
  try {
    receivedUrl = new URL(received)
    canonicalUrl = new URL(canonical)
  } catch {
    return false
  }
  return receivedUrl.origin === canonicalUrl.origin
}

function canonicalizeAuthorizeParams(params: URLSearchParams): string {
  const keys = ['response_type', 'client_id', 'redirect_uri', 'code_challenge',
    'code_challenge_method', 'resource', 'scope', 'state']
  return keys.map((k) => `${k}=${params.get(k) ?? ''}`).join('&')
}

function consentNonceFor(paramsHash: string, store: OAuthStore): string {
  const nonce = randomId()
  store.consentNonces.set(nonce, {
    paramsHash,
    expiresAt: nowSeconds() + CONSENT_NONCE_TTL_S,
  })
  return nonce
}

function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]!)
}

function readBody(req: IncomingMessage, limit = 64 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let total = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      total += c.length
      if (total > limit) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function sendOAuthError(
  res: ServerResponse,
  status: number,
  error: string,
  description?: string,
): void {
  sendJson(res, status, description ? { error, error_description: description } : { error })
}

function verifyPkceS256(verifier: string, challenge: string): boolean {
  const computed = createHash('sha256').update(verifier).digest()
  // base64url, no padding.
  const b64 = computed.toString('base64')
    .replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const a = Buffer.from(b64)
  const b = Buffer.from(challenge)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// Look up an OAuth-issued access token. Returns a Principal sourced from the
// operator role — agents do not currently obtain OAuth tokens (acceptance #4).
export function lookupOauthAccessToken(
  presented: string,
  store: OAuthStore,
): Principal | null {
  if (!presented.startsWith(ACCESS_TOKEN_PREFIX)) return null
  const entry = store.accessTokens.get(presented)
  if (!entry) return null
  if (entry.expiresAt <= nowSeconds()) {
    store.accessTokens.delete(presented)
    return null
  }
  return {
    role: 'operator',
    tokenId: 'oauth.' + presented.slice(ACCESS_TOKEN_PREFIX.length, ACCESS_TOKEN_PREFIX.length + 8),
  }
}

function operatorTokenFromBearerOrForm(
  raw: string | null | undefined,
  cfg: AuthConfig,
): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Match against operator entries only (consent is operator-only).
  const buf = Buffer.from(trimmed)
  for (const candidate of cfg.operator) {
    const c = Buffer.from(candidate)
    if (c.length !== buf.length) continue
    if (timingSafeEqual(c, buf)) return candidate
  }
  return null
}

export interface OAuthRouteResult {
  handled: boolean
}

export async function handleOauthRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  cfg: AuthConfig,
  store: OAuthStore,
  ctx: OAuthContext,
): Promise<OAuthRouteResult> {
  const path = url.pathname
  const method = req.method ?? 'GET'

  // RFC 9728 — Protected Resource Metadata
  if (method === 'GET' && path === '/.well-known/oauth-protected-resource') {
    sendJson(res, 200, {
      resource: ctx.resource,
      authorization_servers: [ctx.issuer],
      scopes_supported: [SUPPORTED_SCOPE],
      bearer_methods_supported: ['header'],
    })
    return { handled: true }
  }

  // RFC 8414 — Authorization Server Metadata
  if (method === 'GET' && path === '/.well-known/oauth-authorization-server') {
    sendJson(res, 200, {
      issuer: ctx.issuer,
      authorization_endpoint: `${ctx.issuer}/oauth/authorize`,
      token_endpoint: `${ctx.issuer}/oauth/token`,
      registration_endpoint: `${ctx.issuer}/oauth/register`,
      revocation_endpoint: `${ctx.issuer}/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: [SUPPORTED_SCOPE],
    })
    return { handled: true }
  }

  // RFC 7591 — Dynamic Client Registration
  if (method === 'POST' && path === '/oauth/register') {
    let body: unknown
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      sendOAuthError(res, 400, 'invalid_client_metadata', 'request body must be JSON')
      return { handled: true }
    }
    if (!body || typeof body !== 'object') {
      sendOAuthError(res, 400, 'invalid_client_metadata')
      return { handled: true }
    }
    const meta = body as Record<string, unknown>
    const redirectUris = meta['redirect_uris']
    if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
      sendOAuthError(res, 400, 'invalid_redirect_uri', 'redirect_uris is required')
      return { handled: true }
    }
    const validatedRedirects: string[] = []
    for (const uri of redirectUris) {
      if (typeof uri !== 'string' || !isValidRedirectUri(uri)) {
        sendOAuthError(res, 400, 'invalid_redirect_uri', `not allowed: ${String(uri)}`)
        return { handled: true }
      }
      validatedRedirects.push(uri)
    }
    const authMethod = meta['token_endpoint_auth_method']
    if (authMethod !== undefined && authMethod !== 'none') {
      sendOAuthError(res, 400, 'invalid_client_metadata',
        'only token_endpoint_auth_method=none (public client + PKCE) is supported')
      return { handled: true }
    }
    const clientId = randomId()
    const reg: ClientRegistration = {
      clientId,
      redirectUris: validatedRedirects,
      clientName: typeof meta['client_name'] === 'string' ? meta['client_name'] as string : '',
      createdAt: nowSeconds(),
    }
    store.clients.set(clientId, reg)
    sendJson(res, 201, {
      client_id: clientId,
      client_id_issued_at: reg.createdAt,
      redirect_uris: reg.redirectUris,
      client_name: reg.clientName || undefined,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    })
    return { handled: true }
  }

  // /oauth/authorize — GET renders consent, POST processes it
  if (path === '/oauth/authorize') {
    if (method === 'GET') {
      return handleAuthorizeGet(req, res, url, store, ctx)
    }
    if (method === 'POST') {
      return handleAuthorizePost(req, res, cfg, store)
    }
  }

  if (method === 'POST' && path === '/oauth/token') {
    return handleToken(req, res, store)
  }

  if (method === 'POST' && path === '/oauth/revoke') {
    return handleRevoke(req, res, store)
  }

  return { handled: false }
}

async function handleAuthorizeGet(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  store: OAuthStore,
  ctx: OAuthContext,
): Promise<OAuthRouteResult> {
  const p = url.searchParams
  const responseType = p.get('response_type')
  const clientId = p.get('client_id') ?? ''
  const redirectUri = p.get('redirect_uri') ?? ''
  const codeChallenge = p.get('code_challenge') ?? ''
  const codeChallengeMethod = p.get('code_challenge_method')
  const resource = p.get('resource')
  console.log(`[oauth] authorize GET client_id=${clientId} resource=${resource ?? '(missing)'} redirect_uri=${redirectUri}`)
  const state = p.get('state') ?? ''
  const scope = p.get('scope') ?? SUPPORTED_SCOPE

  // Errors that cannot redirect back: missing or unregistered client/redirect.
  const client = clientId ? store.clients.get(clientId) : undefined
  if (!client) {
    sendOAuthError(res, 400, 'invalid_request', 'unknown client_id')
    return { handled: true }
  }
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    sendOAuthError(res, 400, 'invalid_request', 'redirect_uri does not match registration')
    return { handled: true }
  }

  // Errors past this point redirect back to the client per RFC 6749 §4.1.2.1.
  const redirectError = (err: string, desc?: string) => {
    const target = new URL(redirectUri)
    target.searchParams.set('error', err)
    if (desc) target.searchParams.set('error_description', desc)
    if (state) target.searchParams.set('state', state)
    res.writeHead(302, { Location: target.toString() })
    res.end()
    return { handled: true } as OAuthRouteResult
  }

  if (responseType !== 'code') return redirectError('unsupported_response_type')
  if (!codeChallenge) return redirectError('invalid_request', 'code_challenge is required')
  if (codeChallengeMethod !== 'S256') {
    return redirectError('invalid_request', 'code_challenge_method must be S256')
  }
  if (!resourceMatches(resource, ctx.resource)) {
    return redirectError('invalid_target',
      `resource origin must match ${ctx.resource} (RFC 8707; got ${resource ?? 'null'})`)
  }
  if (scope !== SUPPORTED_SCOPE) return redirectError('invalid_scope')

  // Mint a single-use consent nonce keyed to the canonicalized request.
  store.sweepExpired(nowSeconds())
  const paramsHash = createHash('sha256')
    .update(canonicalizeAuthorizeParams(p))
    .digest('hex')
  const nonce = consentNonceFor(paramsHash, store)

  const html = renderConsentHtml({
    clientId,
    clientName: client.clientName,
    redirectUri,
    codeChallenge,
    resource: resource ?? '',
    state,
    scope,
    consentNonce: nonce,
  })
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  })
  res.end(html)
  return { handled: true }
}

interface ConsentHtmlInput {
  clientId: string
  clientName: string
  redirectUri: string
  codeChallenge: string
  resource: string
  state: string
  scope: string
  consentNonce: string
}

function renderConsentHtml(i: ConsentHtmlInput): string {
  const name = i.clientName ? htmlEscape(i.clientName) : '(unnamed client)'
  const E = htmlEscape
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Authorize ${name} · vade-canvas</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font:14px/1.5 system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#111}
h1{font-size:18px;margin:0 0 16px}
dl{margin:0 0 16px}dt{font-weight:600;margin-top:8px}dd{margin:0;font-family:ui-monospace,monospace;word-break:break-all;color:#444}
label{display:block;margin:16px 0 8px}
input[type=password]{width:100%;padding:8px;font:inherit;border:1px solid #ccc;border-radius:4px}
.row{display:flex;gap:8px;margin-top:16px}
button{padding:8px 16px;font:inherit;border:1px solid #888;border-radius:4px;cursor:pointer}
button[value=approve]{background:#0a7;color:#fff;border-color:#085}
button[value=deny]{background:#fff;color:#333}
.note{margin-top:16px;color:#666;font-size:12px}
</style></head><body>
<h1>Authorize ${name} to access vade-canvas?</h1>
<dl>
<dt>Client ID</dt><dd>${E(i.clientId)}</dd>
<dt>Redirect</dt><dd>${E(i.redirectUri)}</dd>
<dt>Resource</dt><dd>${E(i.resource)}</dd>
<dt>Scope</dt><dd>${E(i.scope)}</dd>
</dl>
<form method="post" action="/oauth/authorize" autocomplete="off">
<label>Operator token
<input type="password" name="operator_token" autofocus required></label>
<input type="hidden" name="consent_nonce" value="${E(i.consentNonce)}">
<input type="hidden" name="client_id" value="${E(i.clientId)}">
<input type="hidden" name="redirect_uri" value="${E(i.redirectUri)}">
<input type="hidden" name="code_challenge" value="${E(i.codeChallenge)}">
<input type="hidden" name="code_challenge_method" value="S256">
<input type="hidden" name="resource" value="${E(i.resource)}">
<input type="hidden" name="scope" value="${E(i.scope)}">
<input type="hidden" name="state" value="${E(i.state)}">
<input type="hidden" name="response_type" value="code">
<div class="row">
<button type="submit" name="action" value="approve">Authorize</button>
<button type="submit" name="action" value="deny">Deny</button>
</div>
</form>
<p class="note">Paste the same operator token used in <code>Authorization: Bearer</code> on existing clients. The token is not stored or sent anywhere except this server.</p>
</body></html>`
}

async function handleAuthorizePost(
  req: IncomingMessage,
  res: ServerResponse,
  cfg: AuthConfig,
  store: OAuthStore,
): Promise<OAuthRouteResult> {
  const ct = String(req.headers['content-type'] ?? '')
  if (!ct.startsWith('application/x-www-form-urlencoded')) {
    sendOAuthError(res, 400, 'invalid_request', 'expected application/x-www-form-urlencoded')
    return { handled: true }
  }
  const raw = await readBody(req)
  const form = new URLSearchParams(raw)

  const action = form.get('action') ?? ''
  const clientId = form.get('client_id') ?? ''
  const redirectUri = form.get('redirect_uri') ?? ''
  const codeChallenge = form.get('code_challenge') ?? ''
  const codeChallengeMethod = form.get('code_challenge_method')
  const resource = form.get('resource') ?? ''
  const state = form.get('state') ?? ''
  const scope = form.get('scope') ?? SUPPORTED_SCOPE
  const consentNonce = form.get('consent_nonce') ?? ''
  const operatorToken = form.get('operator_token') ?? ''

  const client = store.clients.get(clientId)
  if (!client || !client.redirectUris.includes(redirectUri)) {
    sendOAuthError(res, 400, 'invalid_request', 'unknown client or redirect_uri')
    return { handled: true }
  }

  const redirectBack = (params: Record<string, string>) => {
    const target = new URL(redirectUri)
    for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v)
    if (state) target.searchParams.set('state', state)
    res.writeHead(302, { Location: target.toString() })
    res.end()
    return { handled: true } as OAuthRouteResult
  }

  // Re-validate consent nonce against the originally rendered params hash.
  store.sweepExpired(nowSeconds())
  const nonceEntry = consentNonce ? store.consentNonces.get(consentNonce) : undefined
  if (!nonceEntry) {
    sendOAuthError(res, 400, 'invalid_request', 'consent expired or replayed')
    return { handled: true }
  }
  // Single-use.
  store.consentNonces.delete(consentNonce)
  const paramsForHash = new URLSearchParams()
  paramsForHash.set('response_type', 'code')
  paramsForHash.set('client_id', clientId)
  paramsForHash.set('redirect_uri', redirectUri)
  paramsForHash.set('code_challenge', codeChallenge)
  paramsForHash.set('code_challenge_method', codeChallengeMethod ?? '')
  paramsForHash.set('resource', resource)
  paramsForHash.set('scope', scope)
  paramsForHash.set('state', state)
  const expected = createHash('sha256')
    .update(canonicalizeAuthorizeParams(paramsForHash))
    .digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(nonceEntry.paramsHash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    sendOAuthError(res, 400, 'invalid_request', 'consent params drift')
    return { handled: true }
  }

  if (action === 'deny') {
    return redirectBack({ error: 'access_denied' })
  }
  if (action !== 'approve') {
    sendOAuthError(res, 400, 'invalid_request', 'unknown action')
    return { handled: true }
  }

  const operator = operatorTokenFromBearerOrForm(operatorToken, cfg)
  if (!operator) {
    const trimmed = (operatorToken ?? '').trim()
    const recvLen = trimmed.length
    const recvPrefix = trimmed.slice(0, 8)
    const candLens = cfg.operator.map((t) => t.length)
    const candPrefixes = cfg.operator.map((t) => t.slice(0, 8))
    console.log(`[oauth] consent token mismatch: recv_len=${recvLen} recv_prefix=${recvPrefix} cand_lens=[${candLens.join(',')}] cand_prefixes=[${candPrefixes.join(',')}]`)
    // Per spec we should redirect back, but we do not want to leak that the
    // password was wrong via a redirect — re-render or show a 401. 401 is
    // simplest and the operator can hit back and retry.
    sendOAuthError(res, 401, 'access_denied', 'operator token did not match')
    return { handled: true }
  }

  const code = randomToken('vade_ac_')
  store.codes.set(code, {
    clientId,
    redirectUri,
    codeChallenge,
    resource,
    operatorTokenId: operatorTokenId(operator),
    expiresAt: nowSeconds() + AUTH_CODE_TTL_S,
  })
  return redirectBack({ code })
}

async function parseFormOrJson(req: IncomingMessage): Promise<Record<string, string>> {
  const ct = String(req.headers['content-type'] ?? '')
  const raw = await readBody(req)
  if (ct.startsWith('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw))
  }
  if (ct.startsWith('application/json')) {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string') out[k] = v
      }
      return out
    }
    return {}
  }
  // The OAuth spec mandates form-encoding; tolerate JSON as a courtesy.
  return Object.fromEntries(new URLSearchParams(raw))
}

async function handleToken(
  req: IncomingMessage,
  res: ServerResponse,
  store: OAuthStore,
): Promise<OAuthRouteResult> {
  let form: Record<string, string>
  try {
    form = await parseFormOrJson(req)
  } catch {
    sendOAuthError(res, 400, 'invalid_request', 'malformed body')
    return { handled: true }
  }
  const grantType = form['grant_type']
  if (grantType === 'authorization_code') {
    return handleTokenAuthCode(form, res, store)
  }
  if (grantType === 'refresh_token') {
    return handleTokenRefresh(form, res, store)
  }
  sendOAuthError(res, 400, 'unsupported_grant_type')
  return { handled: true }
}

function handleTokenAuthCode(
  form: Record<string, string>,
  res: ServerResponse,
  store: OAuthStore,
): OAuthRouteResult {
  const code = form['code'] ?? ''
  const redirectUri = form['redirect_uri'] ?? ''
  const clientId = form['client_id'] ?? ''
  const codeVerifier = form['code_verifier'] ?? ''
  const resource = form['resource'] ?? ''

  const entry = store.codes.get(code)
  // Single-use: delete on first lookup regardless of whether it succeeds.
  if (entry) store.codes.delete(code)
  if (!entry || entry.expiresAt <= nowSeconds()) {
    sendOAuthError(res, 400, 'invalid_grant', 'code unknown or expired')
    return { handled: true }
  }
  if (entry.clientId !== clientId || entry.redirectUri !== redirectUri) {
    sendOAuthError(res, 400, 'invalid_grant', 'client_id / redirect_uri mismatch')
    return { handled: true }
  }
  // Skip the audience check if either side is empty: the consent-binding
  // hash already binds the token to the resource declared at consent time.
  if (resource && entry.resource && !resourceMatches(resource, entry.resource)) {
    sendOAuthError(res, 400, 'invalid_target', 'resource mismatch')
    return { handled: true }
  }
  if (!verifyPkceS256(codeVerifier, entry.codeChallenge)) {
    sendOAuthError(res, 400, 'invalid_grant', 'PKCE verification failed')
    return { handled: true }
  }

  const refreshToken = randomToken(REFRESH_TOKEN_PREFIX)
  const accessToken = randomToken(ACCESS_TOKEN_PREFIX)
  const now = nowSeconds()
  store.refreshTokens.set(refreshToken, {
    clientId: entry.clientId,
    operatorTokenId: entry.operatorTokenId,
    expiresAt: now + REFRESH_TOKEN_TTL_S,
  })
  store.accessTokens.set(accessToken, {
    clientId: entry.clientId,
    refreshTokenId: refreshToken,
    operatorTokenId: entry.operatorTokenId,
    expiresAt: now + ACCESS_TOKEN_TTL_S,
  })
  sendJson(res, 200, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_S,
    refresh_token: refreshToken,
    scope: SUPPORTED_SCOPE,
  })
  return { handled: true }
}

function handleTokenRefresh(
  form: Record<string, string>,
  res: ServerResponse,
  store: OAuthStore,
): OAuthRouteResult {
  const presented = form['refresh_token'] ?? ''
  const clientId = form['client_id'] ?? ''
  const entry = store.refreshTokens.get(presented)
  // Public-client refresh-token rotation: always invalidate on use.
  if (entry) store.refreshTokens.delete(presented)
  if (!entry || entry.expiresAt <= nowSeconds()) {
    sendOAuthError(res, 400, 'invalid_grant', 'refresh_token unknown or expired')
    return { handled: true }
  }
  if (entry.clientId !== clientId) {
    sendOAuthError(res, 400, 'invalid_grant', 'client_id mismatch')
    return { handled: true }
  }

  // Cascade-revoke the access token chained to the consumed refresh token.
  for (const [tok, v] of store.accessTokens) {
    if (v.refreshTokenId === presented) store.accessTokens.delete(tok)
  }

  const newRefresh = randomToken(REFRESH_TOKEN_PREFIX)
  const newAccess = randomToken(ACCESS_TOKEN_PREFIX)
  const now = nowSeconds()
  store.refreshTokens.set(newRefresh, {
    clientId: entry.clientId,
    operatorTokenId: entry.operatorTokenId,
    expiresAt: now + REFRESH_TOKEN_TTL_S,
  })
  store.accessTokens.set(newAccess, {
    clientId: entry.clientId,
    refreshTokenId: newRefresh,
    operatorTokenId: entry.operatorTokenId,
    expiresAt: now + ACCESS_TOKEN_TTL_S,
  })
  sendJson(res, 200, {
    access_token: newAccess,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_S,
    refresh_token: newRefresh,
    scope: SUPPORTED_SCOPE,
  })
  return { handled: true }
}

async function handleRevoke(
  req: IncomingMessage,
  res: ServerResponse,
  store: OAuthStore,
): Promise<OAuthRouteResult> {
  let form: Record<string, string>
  try {
    form = await parseFormOrJson(req)
  } catch {
    // RFC 7009 §2.2: revocation always returns 200 to avoid disclosure.
    res.writeHead(200, { 'Cache-Control': 'no-store' })
    res.end()
    return { handled: true }
  }
  const token = form['token'] ?? ''
  const hint = form['token_type_hint']
  if (token) {
    if (hint === 'refresh_token' || token.startsWith(REFRESH_TOKEN_PREFIX)) {
      const entry = store.refreshTokens.get(token)
      if (entry) {
        store.refreshTokens.delete(token)
        for (const [tok, v] of store.accessTokens) {
          if (v.refreshTokenId === token) store.accessTokens.delete(tok)
        }
      }
    } else {
      store.accessTokens.delete(token)
    }
  }
  res.writeHead(200, { 'Cache-Control': 'no-store' })
  res.end()
  return { handled: true }
}

// Composed bearer verifier — bearer first (timing-safe equality on the
// configured operator/agent lists), then OAuth-issued tokens. Returns the
// merged Principal or null.
export function verifyBearerOrOauth(
  authHeader: string | undefined | null,
  cfg: AuthConfig,
  store: OAuthStore,
): Principal | null {
  const direct = verifyBearer(authHeader, cfg)
  if (direct) return direct
  if (!authHeader) return null
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim())
  if (!m) return null
  return lookupOauthAccessToken(m[1]!.trim(), store)
}

export const _internals = {
  ACCESS_TOKEN_PREFIX,
  REFRESH_TOKEN_PREFIX,
  isValidRedirectUri,
  verifyPkceS256,
  canonicalizeAuthorizeParams,
}
