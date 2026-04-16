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
