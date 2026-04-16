# vade-core — Repo Instructions for Claude Code

This is the **VADE kernel and canvas IDE**. These instructions
apply to any Claude Code session working in this repository.

## Session-start reading order

1. This file (`CLAUDE.md`) — repo scope and conventions.
2. `README.md` — current state and goals.
3. The public authority and decision-rights document at
   [vade-governance/authority.md](https://github.com/vade-app/vade-governance/blob/main/authority.md)
   — for what may and may not be done autonomously.
4. Any `.claude/` contents (repo-local agents, skills, settings).

## Scope

Work in this repository is scoped to the VADE kernel and canvas
IDE: the runtime, rendering, orchestration layer, plugin system,
and reference artifacts. Do not modify governance documents or
other `vade-app` repositories from sessions started here.

## Architecture (target)

- Canvas-based UI built on **tldraw SDK** (v4.5.x). tldraw provides
  the infinite canvas, pan/zoom, gestures, touch/tablet support,
  shape system, and persistence. React 18 + TypeScript.
- **MCP server** (`mcp/`) bridges Claude agents to the canvas via
  WebSocket. Agents can create, update, delete, and query shapes
  programmatically through MCP tools.
- **Custom shapes** (`src/shapes/`) extend tldraw for computational
  artifacts: CodeShape (code display), DataShape (structured data).
- Control → State → Visualization loop as the primitive pattern
  for every artifact.
- **Library system** (`~/.vade/library/`) — file-based storage of
  canvas snapshots and reusable entity groups.
- Target platforms: web (primary), iPad (via PWA), macOS desktop
  (via Tauri, deferred until web earns its weight).

## Tech stack

- TypeScript (strict mode) + Node.js 20+ LTS
- React 18 + tldraw ^4.5.x
- Vite for dev server and bundling
- @modelcontextprotocol/server for MCP
- ws (WebSocket) for MCP-to-canvas bridge
- Tauri 2.x for desktop/mobile wrappers (later phase)

## Conventions

- Commit messages: imperative mood, subject line under 72 chars,
  body wrapped at 72.
- Branches: `feat/*`, `fix/*`, `chore/*`, `refactor/*`.
- Pull requests require BDFL review before merge to `main`.
- TypeScript strict mode. No `any` without an inline comment
  justifying it.
- Prefer simplicity over premature abstraction.
- Tests where they earn their keep. Prefer integration tests when
  the integration boundary is the risk.

## What may be done autonomously in this repo

- Create feature branches and draft pull requests.
- Run the dev server, tests, and build.
- Scaffold new modules under `src/`.
- Install dependencies that are clearly in-scope. Flag anything
  ambiguous before running `npm install`.

## What requires explicit approval

- Merging to `main`.
- Changing the tech stack or introducing a framework not listed
  above.
- Changing the MVP scope.
- Touching any other `vade-app` repository.
- Spending money or signing up for paid services.
- Any irreversible action (force push, history rewrite, file
  deletion outside scratch paths).

See [vade-governance/authority.md](https://github.com/vade-app/vade-governance/blob/main/authority.md)
for the authoritative list.

## Current state

Canvas shell scaffolded with tldraw SDK. Vite + React 18 +
TypeScript strict. PWA manifest for iPad. MCP server and custom
shapes in progress.

## Running the project

```bash
npm install           # install dependencies
npm run dev           # start Vite dev server (LAN-accessible)
npm run mcp           # start MCP server (when implemented)
npm run dev:all       # start both (when MCP server exists)
npm run build         # production build
```
