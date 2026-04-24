# Authentication

Single-operator bearer-token auth for the hosted canvas and MCP
service. Three client-facing surfaces are gated:

| Surface | Endpoint | How the token travels |
|---|---|---|
| Canvas SPA bootstrap | `https://vade-app.dev` | Prompt on first load, persisted in `localStorage` |
| MCP SSE transport | `https://mcp.vade-app.dev/sse` + `/messages/<machine-id>` | `Authorization: Bearer <token>` |
| Canvas↔MCP WebSocket | `wss://mcp.vade-app.dev/canvas` | `Sec-WebSocket-Protocol: vade-canvas, vade-auth.<token>` |
| Canvas SPA → library | `https://vade-app.dev/library/*` | `Authorization: Bearer <token>` (operator token from `OPERATOR_TOKENS`) |

Two Worker secrets gate `/library/*`:

- `LIBRARY_BEARER` (Worker) ↔ `VADE_LIBRARY_BEARER` (Fly) is the
  service-to-service secret used by the Fly MCP container.
- `OPERATOR_TOKENS` (Worker, optional) is a JSON document of the same
  shape as Fly's `VADE_AUTH_TOKENS`. When set, any token listed in
  `operator[]` or `agents[]` is accepted on `/library/*` in addition
  to `LIBRARY_BEARER`. This is what the SPA CanvasSwitcher uses to
  talk to the library with the operator's `localStorage` bearer.

Trade-off. Accepting `OPERATOR_TOKENS` on `/library/*` widens the
blast radius of a leaked operator token from "MCP surface only" to
"MCP + library". The operator already holds write access to the
library indirectly (via MCP tools on an authenticated session), so the
net new capability a stolen token grants is direct library read/write
without a live MCP session. M1's single-operator threat model accepts
this; if an operator token ever shouldn't reach `/library/*`, unset
`OPERATOR_TOKENS` and the Worker falls back to `LIBRARY_BEARER`-only.

## Config shape

The MCP service reads a single JSON env var:

```json
{
  "operator": ["<operator-token-1>"],
  "agents": []
}
```

`operator` is the operator's tokens (iPad PWA, personal Claude Code
instances). `agents` reserves space for a future second principal
(autonomous agent identities); M1 ships with it empty. Validation
accepts any token from either list; the role is logged but not yet
used for capability separation.

## Mint a token

```sh
openssl rand -hex 32
```

Store in 1Password / Keychain. Never commit.

## Set on Fly

```sh
TOKEN=$(openssl rand -hex 32)
flyctl secrets set \
  VADE_AUTH_TOKENS="$(jq -cn --arg t "$TOKEN" '{operator:[$t],agents:[]}')" \
  --app vade-mcp
```

The Fly machine restarts automatically on secret change. If
`VADE_AUTH_TOKENS` is unset when `VADE_MCP_TRANSPORT=sse`, the
process exits at startup — **fail closed**.

## iPad PWA first load

1. Open `https://vade-app.dev`.
2. Paste the token into the prompt, tap **Connect**.
3. The token is stored in `localStorage` under `vade-auth-token`.
4. Add to Home Screen for PWA mode.

If the MCP indicator shows `bad token`, tap it to clear and re-enter.

## Claude Code (remote MCP client)

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "vade-canvas": {
      "type": "sse",
      "url": "https://mcp.vade-app.dev/sse",
      "headers": {
        "Authorization": "Bearer <paste-token-here>"
      }
    }
  }
}
```

Restart Claude Code so it picks up the new config. A full remote-MCP
setup walkthrough lives under issue #11.

## Rotation

1. Mint a new token.
2. `flyctl secrets set VADE_AUTH_TOKENS='{"operator":["<new>"],"agents":[]}' --app vade-mcp`
3. Wait for the Fly machine to restart (~15s).
4. On the iPad: tap the `bad token` indicator, paste the new token.
5. Update the Claude Code MCP config, restart Claude Code.

To support zero-downtime rotation, include both old and new tokens
in the operator array during a cutover window:

```json
{ "operator": ["<new>", "<old>"], "agents": [] }
```

Then remove `<old>` after every client has moved over.

### Rotating `OPERATOR_TOKENS` on the Worker

The SPA → `/library/*` path reads the same operator token from
`localStorage`, so the rotation checklist above covers it — the only
extra step is publishing the new JSON to the Worker alongside Fly:

```sh
echo '{"operator":["<new>"],"agents":[]}' | wrangler secret put OPERATOR_TOKENS
```

Include both old and new tokens in `operator[]` during the cutover,
same as Fly, and remove `<old>` after every client has migrated. If
`OPERATOR_TOKENS` is unset, the Worker falls back to
`LIBRARY_BEARER`-only — that was the pre-CanvasSwitcher posture.

## Threat model (M1)

In-scope:

- Anonymous internet traffic hitting the hosted endpoints.
- Accidental exposure of the canvas URL.

Out-of-scope (M1 is single-operator):

- Per-principal capability separation (role is logged, not enforced).
- Token leakage via browser XSS — mitigated operationally (we run one
  trusted SPA). Future hardening: move the token to an httpOnly
  cookie with a same-origin proxy.
- WebSocket subprotocol logging — Fly's edge does not routinely log
  `Sec-*` headers, but they can appear in verbose access logs. For
  M1 this is acceptable; if it becomes load-bearing, switch to a
  short-lived signed subprotocol token derived from the bearer.
