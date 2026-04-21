# Connecting to the hosted vade-canvas MCP

The hosted MCP server (`https://mcp.vade-app.dev`) speaks the Model
Context Protocol over SSE and is gated by a single bearer token.
Any MCP-capable client that accepts a remote SSE URL plus
`Authorization` header can drive the canvas.

See [auth.md](./auth.md) for how tokens are minted, stored on Fly,
and rotated. This doc covers the client side only.

## Endpoint

| Field | Value |
|---|---|
| Transport | SSE |
| URL | `https://mcp.vade-app.dev/sse` |
| Auth header | `Authorization: Bearer <operator-token>` |
| Health check | `GET https://mcp.vade-app.dev/healthz` → `200 ok` |

`/healthz` is unauthenticated. Any 4xx on `/sse` with a bearer is
almost always a bad or expired token — see
[Rotation](./auth.md#rotation).

## Claude.ai (web)

**Not currently supported.** Claude.ai's custom connectors require
OAuth 2.0 authentication; the hosted `vade-mcp` server uses bearer
tokens and does not implement an OAuth flow.

Tracked under issue #7 (remote MCP bridge). For now, use Claude
Desktop or Claude Code to access the hosted MCP server.

## Claude Desktop

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

## Claude Code

Project-scoped config already lives at `.mcp.json` in this repo and
references `${VADE_AUTH_TOKEN}`. Export it before launching:

```sh
export VADE_AUTH_TOKEN=<operator-token>
claude
```

For Claude Code on the web, set `VADE_AUTH_TOKEN` as a secret in the
environment bound to this repo (see the `defaultEnvironmentId` in
`.claude/settings.local.json`) and start a fresh session.

## Tool surface

The server registers three groups under `mcp/tools/`:

- **Shapes** (`shapes.ts`) — `createShape`, `updateShape`,
  `deleteShapes`, `createBindings`, `queryShapes`, `createBatch`.
- **Canvas** (`canvas.ts`) — `getCanvasState`, `saveCanvas`,
  `loadCanvas`, `listCanvases`, `deleteCanvas`, `saveEntity`,
  `loadEntity`, `deleteEntity`, `searchLibrary`.
- **Runtime** (`runtime.ts`) — `requestCodeChange`.

Argument schemas live next to each registration. Treat the source
as the source of truth; the list above will drift.

## Sanity check

```sh
curl -fsS https://mcp.vade-app.dev/healthz          # → ok
curl -fsS -H 'Accept: text/event-stream' \
  -H "Authorization: Bearer $VADE_AUTH_TOKEN" \
  https://mcp.vade-app.dev/sse | head -c 200        # → SSE stream opens
```

401 on the second call → bad token. Anything else 5xx → check Fly.
