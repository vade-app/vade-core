# Authentication

Single-operator bearer-token auth for the hosted canvas and MCP
service. **Two distinct secret values** in **four secret slots**:

| Value | Fly (`vade-mcp`) | Worker (`vade-core`) |
|---|---|---|
| **Operator token** — typed into clients | `VADE_AUTH_TOKENS` (JSON `{"operator":[…],"agents":[]}`) | `OPERATOR_TOKENS` (same JSON) |
| **Library service token** — never typed | `VADE_LIBRARY_BEARER` (hex string) | `LIBRARY_BEARER` (hex string) |

Plus `VADE_OAUTH_ENABLED=1` on Fly to surface the OAuth metadata
endpoints for the Claude.ai custom-connector flow. That's the whole
secret surface.

## First-time setup

```sh
OPERATOR=$(openssl rand -hex 32)
SERVICE=$(openssl rand -hex 32)

# Fly (vade-mcp)
flyctl secrets set \
  VADE_AUTH_TOKENS="$(jq -cn --arg t "$OPERATOR" '{operator:[$t],agents:[]}')" \
  VADE_LIBRARY_BEARER="$SERVICE" \
  VADE_OAUTH_ENABLED=1 \
  --app vade-mcp

# Worker (vade-core; run from this repo)
echo "{\"operator\":[\"$OPERATOR\"],\"agents\":[]}" | wrangler secret put OPERATOR_TOKENS
echo "$SERVICE" | wrangler secret put LIBRARY_BEARER

# Save to 1Password / Keychain
echo "Operator token (paste this into clients): $OPERATOR"
```

The Fly machine restarts (~15s) on each `flyctl secrets set`. The
process **fails closed** if `VADE_AUTH_TOKENS` is unset in SSE mode.

Then paste `$OPERATOR` into each client — see [Clients](#clients).

## Inspect current state

You can verify what's set without exposing values:

```sh
flyctl secrets list --app vade-mcp   # names + digests
wrangler secret list                  # names only

# Confirm which token the SPA is currently sending (8-char prefix
# only; matches what the bridge logs accept):
flyctl logs --app vade-mcp | grep "auth ok: operator"
```

If `OPERATOR_TOKENS` (Worker) and `VADE_AUTH_TOKENS` (Fly) hold
different operator tokens, the SPA save path will 401 with
*Library unavailable (401). Worker needs OPERATOR_TOKENS …* even
though MCP/canvas WS still works. Both stores must hold the same
operator token.

Sanity-check the live endpoints:

```sh
curl -fsS https://mcp.vade-app.dev/healthz                  # → ok
curl -sS -o /dev/null -w "%{http_code}\n" \
  https://mcp.vade-app.dev/sse                              # → 401 (fail-closed)
curl -fsS -H 'Accept: text/event-stream' \
  -H "Authorization: Bearer $OPERATOR" \
  https://mcp.vade-app.dev/sse | head -c 200                # → SSE stream
curl -fsS https://mcp.vade-app.dev/.well-known/oauth-authorization-server \
  | head -c 100                                             # → metadata JSON (only with VADE_OAUTH_ENABLED=1)
```

## Clients

Three client surfaces consume the operator token:

### Canvas SPA (iPad / desktop)

1. Open `https://vade-app.dev`.
2. Paste the operator token into the prompt, tap **Connect**.
3. Stored in `localStorage` under `vade-auth-token`.
4. Add to Home Screen for PWA mode.

If the MCP indicator shows `bad token`, tap to clear and re-enter.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or the platform equivalent:

```json
{
  "mcpServers": {
    "vade-canvas": {
      "type": "sse",
      "url": "https://mcp.vade-app.dev/sse",
      "headers": {
        "Authorization": "Bearer <operator-token>"
      }
    }
  }
}
```

Restart Claude Desktop. Tools appear under the hammer icon.

### Claude Code (remote MCP)

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "vade-canvas": {
      "type": "sse",
      "url": "https://mcp.vade-app.dev/sse",
      "headers": {
        "Authorization": "Bearer <operator-token>"
      }
    }
  }
}
```

Restart Claude Code so it picks up the new config.

### Claude.ai (custom connector, OAuth)

Claude.ai's "Add custom connector" UI requires OAuth 2.1 + dynamic
client registration — it cannot paste a static bearer the way
Desktop or Code does. The hosted server speaks the MCP authorization
spec (revision 2025-06-18) when `VADE_OAUTH_ENABLED=1` is set.

1. Settings → Connectors → **Add custom connector**.
2. URL: `https://mcp.vade-app.dev/sse`. Leave OAuth Client ID and
   OAuth Client Secret **blank** — DCR fills them in automatically.
3. Click **Add**. Claude.ai discovers
   `/.well-known/oauth-authorization-server`, registers itself
   dynamically (RFC 7591), and opens the consent screen at
   `/oauth/authorize`.
4. Paste the same operator token used for Desktop / Code into the
   "Operator token" field. Click **Authorize**.
5. The connector shows **Connected** and `vade-canvas` tools surface
   in conversations.

OAuth-issued tokens descend from the operator entry that approved
consent. They live in-memory on the Fly machine; restart loses them
and Claude.ai re-runs consent on the next 401. Access tokens are
prefixed `vade_at_`, refresh tokens `vade_rt_` — they never collide
with the hex bearer tokens above.

The server's RFC 8707 `resource` validation accepts any URI whose
origin matches `https://mcp.vade-app.dev` — Claude.ai sends the URL
the user typed (e.g. `https://mcp.vade-app.dev/sse`) rather than
the canonical resource URI advertised in metadata, and we accept
both.

Disable, fully reversible:

```sh
flyctl secrets unset VADE_OAUTH_ENABLED --app vade-mcp
```

## Surfaces gated

| Surface | Endpoint | How the token travels |
|---|---|---|
| Canvas SPA bootstrap | `https://vade-app.dev` | Prompt on first load, persisted in `localStorage` |
| MCP SSE transport | `https://mcp.vade-app.dev/sse` + `/messages/<machine-id>` | `Authorization: Bearer <token>` |
| Canvas↔MCP WebSocket | `wss://mcp.vade-app.dev/canvas` | `Sec-WebSocket-Protocol: vade-canvas, vade-auth.<token>` |
| Canvas SPA → library | `https://vade-app.dev/library/*` | `Authorization: Bearer <operator-token>` (matched against `OPERATOR_TOKENS`) |
| Fly MCP → library | `https://vade-app.dev/library/*` | `Authorization: Bearer <service-token>` (matched against `LIBRARY_BEARER`) |

The Worker accepts `LIBRARY_BEARER` (service-to-service) **OR** any
token in `OPERATOR_TOKENS.{operator,agents}[]` on `/library/*`.
Both must be set for normal operation.

## Trade-off — operator on `/library/*`

Accepting `OPERATOR_TOKENS` on `/library/*` widens the blast radius
of a leaked operator token from "MCP only" to "MCP + library". The
operator already has indirect library write access via authenticated
MCP tools; the new capability is direct library read/write without
a live MCP session. M1's single-operator threat model accepts this.
If the operator token shouldn't reach `/library/*`, unset
`OPERATOR_TOKENS` and the Worker falls back to `LIBRARY_BEARER`-only.

## Rotating the operator token

```sh
NEW=$(openssl rand -hex 32)

# Update both stores. Include the old value during cutover for
# zero-downtime rotation.
flyctl secrets set \
  VADE_AUTH_TOKENS="$(jq -cn --arg n "$NEW" --arg o "$OLD" '{operator:[$n,$o],agents:[]}')" \
  --app vade-mcp
echo "{\"operator\":[\"$NEW\",\"$OLD\"],\"agents\":[]}" | wrangler secret put OPERATOR_TOKENS

# Update each client (SPA prompt / Claude Code config / 1Password).
# Then drop $OLD from both arrays.
```

OAuth-issued `vade_at_*` tokens cascade-revoke on rotation: the
Fly startup sweep drops every issued token whose source operator
entry is no longer present, and Claude.ai re-runs consent on the
next 401. One regime, no parallel OAuth credential to manage.

## Rotating the library service token

```sh
NEW=$(openssl rand -hex 32)
flyctl secrets set VADE_LIBRARY_BEARER="$NEW" --app vade-mcp
echo "$NEW" | wrangler secret put LIBRARY_BEARER
```

Both restart on secret change; brief library-API downtime is
expected (~15s on Fly side).

## Preview deployments

The `vade-core-preview` Worker (one Worker, multiple subdomains via
the `*.preview.vade-app.dev/*` wildcard route) carries its own
secret slots, separate from the production `vade-core` Worker by
virtue of distinct Worker names. **Use distinct token values** —
sharing the prod operator token with preview widens the blast
radius of a leaked preview build.

```sh
# Provision preview-only operator token (runs once, before first
# preview deploy lands).
PREVIEW_OPERATOR=$(openssl rand -hex 32)
echo "{\"operator\":[\"$PREVIEW_OPERATOR\"],\"agents\":[]}" | \
  wrangler secret put OPERATOR_TOKENS --env preview

# Library bearer is unused on the preview Worker today (no R2 / D1
# bindings under env.preview in wrangler.jsonc). When stateful
# previews land, set a preview-only LIBRARY_BEARER on a separate
# preview bucket + D1.
```

### One-time Cloudflare-side setup

Done in the Cloudflare dashboard (Worker / DNS / Builds /
SSL-TLS settings), not via `wrangler`:

1. **Wildcard DNS.** Zone `vade-app.dev` → DNS → add an AAAA
   record `*.preview` pointing at `100::` (Cloudflare's proxied-
   only placeholder), proxied (orange cloud).
2. **Advanced Certificate Manager (ACM).** Zone → SSL/TLS →
   Edge Certificates → "Order Advanced Certificate" with hosts
   `*.preview.vade-app.dev` and `preview.vade-app.dev`,
   validation method `txt`, validity 365d. Required because the
   Free-plan Universal SSL only covers `vade-app.dev` and
   `*.vade-app.dev` (one level); the two-level wildcard
   `*.preview.vade-app.dev` is an ACM cert (paid). Without this,
   any `https://pr-<N>.preview.vade-app.dev/` returns 503 with a
   TLS-handshake error from Cloudflare's edge.
3. **Workers Builds production lock.** Workers & Pages →
   `vade-core` → Settings → Builds → set production-branch to
   `main` only. Without this, every PR-branch push redeploys
   production (the bug that surfaced in #167).
4. **Workers Builds preview env.** On the same `vade-core` build
   config, enable preview deployments for non-production
   branches with the build command **`npm run deploy:preview`**.
   Cloudflare provisions the `vade-core-preview` Worker on the
   first preview run. (The script invokes
   `wrangler deploy --config wrangler.jsonc --env preview
   --assets ./dist/client`; see README "Deploy" for why the
   `--config`/`--assets` overrides are required.)
5. **Preview Worker secrets.** Once `vade-core-preview` exists in
   the dashboard, set its operator token via
   `wrangler secret put OPERATOR_TOKENS --env preview` (separate
   value from production, per above).

### Verifying

After the preview Worker is live:

```sh
curl -fsS "https://pr-<N>.preview.vade-app.dev/" -o /dev/null -w "%{http_code}\n"   # → 200 (SPA shell)
curl -sS  "https://pr-<N>.preview.vade-app.dev/library/canvases" -o /dev/null -w "%{http_code}\n"   # → 500 (no R2 binding; expected)
```

The preview Worker is "demo the UI" only until `/library/*` is
unwired with a separate bucket + database. Pasting the
`PREVIEW_OPERATOR` token into the preview SPA gates past the
TokenGate; canvas pan/zoom/shape-creation work; save/load fail.

## Threat model (M1)

In-scope:
- Anonymous internet traffic hitting hosted endpoints.
- Accidental exposure of the canvas URL.

Out-of-scope (M1 is single-operator):
- Per-principal capability separation (`operator` vs `agents` is
  logged, not enforced).
- Token leakage via browser XSS — mitigated operationally (one
  trusted SPA). Future hardening: httpOnly cookie + same-origin
  proxy.
- WebSocket subprotocol logging — Fly's edge does not routinely log
  `Sec-*` headers, but they may appear in verbose access logs.
  Acceptable for M1.
