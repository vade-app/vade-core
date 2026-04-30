# Remote MCP — connect Claude Code to the hosted vade-canvas

A focused 5-minute setup for Claude Code clients connecting to the
hosted MCP server. For the full picture (rotation, Claude.ai
custom-connector OAuth, threat model), read [`docs/auth.md`](auth.md).

## What you need

- An **operator token** — a hex string the operator generated during
  first-time setup (see [`docs/auth.md` § First-time setup](auth.md#first-time-setup)).
- The canonical hosted endpoint: **`https://mcp.vade-app.dev/sse`**.

## Configure Claude Code

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

Restart Claude Code. The `vade-canvas` tools surface in the next
session.

For Claude Desktop and the Claude.ai custom-connector OAuth flow, see
[`docs/auth.md` § Clients](auth.md#clients) — the same operator token
works across all three.

## Verify

```sh
# Health (no auth required)
curl -fsS https://mcp.vade-app.dev/healthz                    # → ok

# Fail-closed without a token
curl -sS -o /dev/null -w "%{http_code}\n" \
  https://mcp.vade-app.dev/sse                                # → 401

# SSE handshake with a valid token
curl -fsS -H 'Accept: text/event-stream' \
  -H "Authorization: Bearer $OPERATOR" \
  https://mcp.vade-app.dev/sse | head -c 200                  # → SSE stream
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 Unauthorized` on `/sse` | Token missing, malformed, or rotated | Re-paste the current operator token from 1Password. Tokens prefixed `vade_at_` are OAuth tokens — they only travel via the Claude.ai connector flow, not raw bearer headers. |
| `404 Not Found` on `/sse` | Wrong endpoint or stale doc | Use `https://mcp.vade-app.dev/sse` exactly. Earlier drafts referenced `mcp.vade.dev/sse` — that host does not exist; vade-coo-memory#11. |
| WebSocket disconnects in a loop | Token mismatch between Worker and Fly stores | Operator token must be identical in Worker `OPERATOR_TOKENS` and Fly `VADE_AUTH_TOKENS`. See [`docs/auth.md` § Inspect current state](auth.md#inspect-current-state). |
| Tools never appear after restart | Claude Code didn't reload the config | Fully quit and relaunch (not just close the window). Confirm with `claude mcp list`. |
| `redirect_uri must use https` (Claude.ai connector flow) | OAuth issue, not bearer-token | See [`docs/auth.md` § Claude.ai (custom connector, OAuth)](auth.md#claudeai-custom-connector-oauth). |

## See also

- [`docs/auth.md`](auth.md) — full auth model, rotation, OAuth, threat model
- [`README.md` § Auth and secrets](../README.md#auth-and-secrets) — secret-slot map
