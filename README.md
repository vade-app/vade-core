# vade-core

**VADE kernel and canvas IDE.** The primary application repo for
[VADE](https://github.com/vade-app) — a Visual Agent-based
Development Environment. Canvas-based IDE/OS hybrid where AI agents
build interactive tools on an infinite canvas.

## Status

**Pre-alpha.** The canvas is live at **https://vade-app.dev** (served
from a Cloudflare Worker), and the MCP server is live at
**https://mcp.vade-app.dev** (served from Fly.io). Canvas snapshots
and reusable entity groups persist to Cloudflare R2 + D1 via a
`/library/*` route on the Worker, so Fly redeploys no longer wipe
saved work. Remaining milestone-1 work is tracked under issues
#9 (auth), #10 (CI/CD), and #11 (remote-MCP client docs).

## What this repo contains

- **Canvas app** (`src/`) — tldraw-based infinite canvas with custom
  shapes for computational artifacts
- **MCP server** (`mcp/`) — bridges Claude agents to the running
  canvas via WebSocket, enabling real-time shape creation and
  manipulation through MCP tools
- **Cloud library** (`worker/library.ts` + `migrations/`) — bearer-
  gated `/library/*` route on the Worker, snapshots to R2, metadata
  to D1; selected from the MCP side via `VADE_LIBRARY_DRIVER=fs|cloud`
- **PWA support** — installable on iPad via Add to Home Screen

## Tech stack

- React 18 + TypeScript (strict) + Vite
- tldraw ^4.5.x (infinite canvas SDK)
- @modelcontextprotocol/server (MCP bridge)
- WebSocket (real-time MCP-to-canvas communication)

## Getting started

```bash
npm install           # install dependencies
npm run dev           # start Vite dev server (LAN-accessible on :5173)
npm run build         # production build
```

Access the local dev server from iPad by opening
`http://<your-mac-ip>:5173` in Safari, then Add to Home Screen for
full-screen PWA mode. For the hosted app, open
[https://vade-app.dev](https://vade-app.dev) and Add to Home Screen.

## Deploy

Two independent deploy targets, both driven off `main`:

**Canvas SPA + library API** — Cloudflare Worker (`wrangler.jsonc`).
The Worker serves Vite-built assets from `dist/client/` and owns the
bearer-gated `/library/*` route, which reads/writes R2 (`LIBRARY_R2`)
and D1 (`vade_library`). Deploys are triggered by Cloudflare's Git
integration on push to `main`. `routes` attaches both `vade-app.dev`
and `www.vade-app.dev` as `custom_domain` routes.

**MCP server** — Fly.io app `vade-mcp` at `mcp.vade-app.dev`
(`Dockerfile` + `fly.toml`). The container runs the SSE MCP transport
on `:8080` with a WebSocket bridge at `/canvas`, and defaults
`VADE_LIBRARY_DRIVER=cloud` so canvas state round-trips through the
Worker's library routes instead of a local filesystem. Redeploy with
`flyctl deploy --app vade-mcp`.

The two services share a bearer: the Worker holds it as
`LIBRARY_BEARER` (`wrangler secret put`), the Fly container holds it
as `VADE_LIBRARY_BEARER` (`flyctl secrets set`). CI/CD via GitHub
Actions is tracked under issue #10.

## Governance

See [vade-governance](https://github.com/vade-app/vade-governance)
for the project's authority structure, decision rights, and
contribution rules. BDFL: Ven Popov.

## License

TBD — will be set before the first external contribution window.

## Contributing

Not open for external contribution during bootstrap. See
`vade-governance` for when and how external contribution opens.
