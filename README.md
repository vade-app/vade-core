# vade-core

**VADE kernel and canvas IDE.** The primary application repo for
[VADE](https://github.com/vade-app) — a Visual Agent-based
Development Environment. Canvas-based IDE/OS hybrid where AI agents
build interactive tools on an infinite canvas.

## Status

**Pre-alpha.** Canvas is live at **https://vade-app.dev** (served
from a Cloudflare Worker). MCP server and custom shapes still in
progress — the hosted app currently runs canvas-only; the bridge
to a hosted MCP endpoint is tracked under issue #7.

## What this repo contains

- **Canvas app** (`src/`) — tldraw-based infinite canvas with custom
  shapes for computational artifacts
- **MCP server** (`mcp/`) — bridges Claude agents to the running
  canvas via WebSocket, enabling real-time shape creation and
  manipulation through MCP tools
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

The canvas SPA is deployed as a **Cloudflare Worker** that serves
the Vite-built static assets (`dist/`). Configuration lives in
`wrangler.jsonc`:

- `assets.not_found_handling: "single-page-application"` — SPA
  routing fallback to `index.html`.
- `routes` — both `vade-app.dev` and `www.vade-app.dev` are
  attached as `custom_domain` routes; DNS and TLS are managed by
  Cloudflare.

Deploys are triggered by Cloudflare's Git integration on push to
`main` (one build per push, auto-deploys to the custom domains).
CI/CD via GitHub Actions is tracked under issue #10.

## Governance

See [vade-governance](https://github.com/vade-app/vade-governance)
for the project's authority structure, decision rights, and
contribution rules. BDFL: Ven Popov.

## License

TBD — will be set before the first external contribution window.

## Contributing

Not open for external contribution during bootstrap. See
`vade-governance` for when and how external contribution opens.
