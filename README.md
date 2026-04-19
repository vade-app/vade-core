# vade-core

**VADE kernel and canvas IDE.** The primary application repo for
[VADE](https://github.com/vade-app) — a Visual Agent-based
Development Environment. Canvas-based IDE/OS hybrid where AI agents
build interactive tools on an infinite canvas.

## Status

**Pre-alpha.** Canvas shell scaffolded with tldraw SDK. MCP server
and custom shapes in progress.

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

Access from iPad: open `http://<your-mac-ip>:5173` in Safari, then
Add to Home Screen for full-screen PWA mode.

## Governance

See [vade-governance](https://github.com/vade-app/vade-governance)
for the project's authority structure, decision rights, and
contribution rules. BDFL: Ven Popov.

## License

TBD — will be set before the first external contribution window.

## Contributing

Not open for external contribution during bootstrap. See
`vade-governance` for when and how external contribution opens.

## Deploy: Cloudflare Pages

The canvas SPA is hosted on **Cloudflare Pages** at
[`app.vade.dev`](https://app.vade.dev) so the operator can load VADE
on iPad with no Mac running. Configuration lives in `wrangler.toml`.

### One-time setup (BDFL only)

1. Create a Cloudflare account for the `vade-app` org (or reuse an
   existing one).
2. Create a Pages project named `vade-core` in the Cloudflare
   dashboard.
3. Issue a scoped API token with the `Pages:Edit` permission; export
   it locally as `CLOUDFLARE_API_TOKEN` and capture the account ID as
   `CLOUDFLARE_ACCOUNT_ID`.
4. Add a CNAME record `app.vade.dev` → `<project>.pages.dev` and
   attach the custom domain in the Pages UI so Cloudflare provisions
   the TLS certificate.

### Deploying

```bash
npm run deploy:web    # builds dist/ and uploads via wrangler pages deploy
```

`deploy:web` runs `npm run build` (which emits `dist/`) and then
`wrangler pages deploy dist --project-name vade-core`. `wrangler`
picks up `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the
environment. Install wrangler on demand via `npx wrangler …` or add
it as a devDependency in a follow-up.

CI-driven deploys (GitHub Actions, `VITE_COMMIT_SHA` injection,
preview URLs on PRs) are out of scope for this change and tracked in
sub-issue #10.

### iPad first-load checklist

1. Open `https://app.vade.dev` in mobile Safari.
2. Tap Share → **Add to Home Screen** — the PWA manifest
   (`public/manifest.json`) and `apple-touch-icon` make it install
   full-screen.
3. Launch from the home screen; the service worker
   (`public/sw.js`) handles offline fallback for already-cached
   assets. `ConnectionIndicator` will show `offline` until the MCP
   WSS host lands (tracked separately).
