import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'

export type Role = 'operator' | 'agent'

export type Principal = {
  role: Role
  tokenId: string
}

export type AuthConfig = {
  operator: string[]
  agents: string[]
}

const CLIENT_SUBPROTOCOL = 'vade-canvas'
const TOKEN_SUBPROTOCOL_PREFIX = 'vade-auth.'

export function loadAuthConfig(raw: string | undefined | null): AuthConfig {
  if (!raw || !raw.trim()) {
    throw new Error('VADE_AUTH_TOKENS is required (set via `flyctl secrets set`)')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`VADE_AUTH_TOKENS is not valid JSON: ${msg}`)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('VADE_AUTH_TOKENS must be an object { operator: [...], agents: [...] }')
  }
  const obj = parsed as Record<string, unknown>
  const operator = normalizeList(obj['operator'], 'operator')
  const agents = normalizeList(obj['agents'], 'agents')
  if (operator.length === 0 && agents.length === 0) {
    throw new Error('VADE_AUTH_TOKENS must contain at least one token')
  }
  return { operator, agents }
}

function normalizeList(value: unknown, name: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new Error(`VADE_AUTH_TOKENS.${name} must be an array of strings`)
  }
  const tokens: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error(`VADE_AUTH_TOKENS.${name} contains an empty or non-string token`)
    }
    tokens.push(entry.trim())
  }
  return tokens
}

function matchToken(presented: string, cfg: AuthConfig): Principal | null {
  if (!presented) return null
  const presentedBuf = Buffer.from(presented)
  for (const role of ['operator', 'agents'] as const) {
    for (const candidate of cfg[role]) {
      const candidateBuf = Buffer.from(candidate)
      if (candidateBuf.length !== presentedBuf.length) continue
      if (timingSafeEqual(candidateBuf, presentedBuf)) {
        return {
          role: role === 'operator' ? 'operator' : 'agent',
          tokenId: candidate.slice(0, 8),
        }
      }
    }
  }
  return null
}

export function verifyBearer(header: string | undefined | null, cfg: AuthConfig): Principal | null {
  if (!header) return null
  const m = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!m) return null
  return matchToken(m[1]!.trim(), cfg)
}

export type SubprotocolResult = {
  principal: Principal
  chosenSubprotocol: string
}

export function verifySubprotocols(
  header: string | undefined | null,
  cfg: AuthConfig,
): SubprotocolResult | null {
  if (!header) return null
  const offered = header.split(',').map((p) => p.trim()).filter(Boolean)
  let tokenValue: string | null = null
  let hasClientProtocol = false
  for (const entry of offered) {
    if (entry === CLIENT_SUBPROTOCOL) {
      hasClientProtocol = true
    } else if (entry.startsWith(TOKEN_SUBPROTOCOL_PREFIX)) {
      tokenValue = entry.slice(TOKEN_SUBPROTOCOL_PREFIX.length)
    }
  }
  if (!hasClientProtocol || !tokenValue) return null
  const principal = matchToken(tokenValue, cfg)
  if (!principal) return null
  return { principal, chosenSubprotocol: CLIENT_SUBPROTOCOL }
}

export { CLIENT_SUBPROTOCOL, TOKEN_SUBPROTOCOL_PREFIX }
