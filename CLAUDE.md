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

- Canvas-based UI built on **tldraw SDK** (^4.5.10; Hobby
  License for `*.vade-app.dev` wired in #100, closed #32).
  tldraw provides the infinite canvas, pan/zoom,
  gestures, touch/tablet support, shape system, and persistence.
  React 18 + TypeScript.
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
- React 18 + tldraw ^4.5.10
- Vite for dev server and bundling
- @modelcontextprotocol/sdk for MCP
- ws (WebSocket) for MCP-to-canvas bridge
- Cloudflare Workers + wrangler for hosted deployment
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

### Canonical config files

- `.mcp.json` — project-scoped MCP server config (Mem0 + GitHub),
  shared across surfaces. Committed.
- `.claude/settings.local.json` — Claude Code permissions and
  session settings for this repo. Committed where it encodes
  repo-wide policy; user-local overrides stay out of git.
- `.devcontainer/` — reproducible dev environment spec. Used by
  VS Code devcontainers and by Codespaces.
- `wrangler.jsonc` — Cloudflare Worker deploy config. See
  Deployment below.

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

## Hitting an OAuth/scope wall on `git push` from a remote session

Claude Code on the web sessions push through a scoped-down git
proxy. The two recurring blockers are:

- `git push` rejected with `refusing to allow an OAuth App to
  create or update workflow ... without 'workflow' scope` (any
  `.github/workflows/*` change).
- GitHub MCP `create_or_update_file` / `push_files` returning
  `404 Not Found` despite reads working.

Don't burn cycles retrying or asking for token swaps. Commit the
work locally on the branch, then suggest the user `/teleport` the
session to their local Claude Code and finish the push from there
— typically with `git push git@github.com:OWNER/REPO.git BRANCH`.
SSH key auth bypasses the OAuth-app scope restriction entirely.
The unblock for vade-core PR #49 (workflow files) on 2026-04-20
is the canonical example.

## Current state

**Pre-alpha MVP scaffold is in `main`.** The canvas is live at
**https://vade-app.dev**, served from a Cloudflare Worker that
auto-deploys on push to `main`. What ships today:

- **Canvas shell** — tldraw-backed infinite canvas, pan/zoom,
  gesture + touch support, IndexedDB persistence so the canvas
  document survives reloads.
- **PWA** — installable on iPad via Add to Home Screen; manifest
  and icons are wired up.
- **MCP server** — functional over stdio, with a WebSocket bridge
  on `:7600` to push shape operations into the running canvas.
- **Custom shapes** — `CodeShape` (syntax-highlighted code block)
  and `DataShape` (structured JSON rendering).
- **Library system** — file-based storage at `~/.vade/library/`
  for canvas snapshots and reusable entity groups.
- **Connection status indicator** — surfaces the WS bridge state
  in the canvas UI.

The bridge from a hosted MCP endpoint to the hosted canvas is
the next MVP milestone (tracked under issue #7). CI/CD via
GitHub Actions is tracked under issue #10.

## Running the project

```bash
npm install           # install dependencies
npm run dev           # start Vite dev server (LAN-accessible on :5173)
npm run mcp           # start the MCP server (stdio + WebSocket :7600)
npm run dev:all       # run Vite + MCP server concurrently
npm run build         # production build (tsc -b && vite build)
npm run preview       # build, then serve via `wrangler dev` locally
npm run deploy        # build, then `wrangler deploy` to Cloudflare
```

## Deployment

The canvas SPA is deployed as a **Cloudflare Worker** that serves
the Vite-built static assets (`dist/`). Config lives in
`wrangler.jsonc`:

- `assets.not_found_handling: "single-page-application"` — SPA
  routing fallback to `index.html`.
- `routes` — both `vade-app.dev` and `www.vade-app.dev` are
  attached as `custom_domain` routes; DNS and TLS are managed
  by Cloudflare.
- `compatibility_flags: ["nodejs_compat"]`.

Deploys are triggered by Cloudflare's Git integration on push to
`main` (one build per push, auto-deploys to both custom domains).
Manual deploy from a local clone: `npm run deploy`. A proper
GitHub Actions CI/CD pipeline is tracked under issue #10.

## Auth and secrets

Single-operator bearer-token model. **Two distinct secret values**
across **four slots**, plus one feature flag:

| Value | Fly (`vade-mcp`) | Worker (`vade-core`) |
|---|---|---|
| Operator token (typed into clients) | `VADE_AUTH_TOKENS` (JSON `{"operator":[…],"agents":[]}`) | `OPERATOR_TOKENS` (same JSON) |
| Library service token (never typed) | `VADE_LIBRARY_BEARER` (hex string) | `LIBRARY_BEARER` (hex string) |

Plus `VADE_OAUTH_ENABLED=1` on Fly to enable the Claude.ai
custom-connector OAuth surface.

The full setup, rotation, and threat-model spec lives in
[`docs/auth.md`](docs/auth.md). That file is the source of truth.

Inspect current state without exposing values:

- `flyctl secrets list --app vade-mcp` — shows secret names + digests
- `wrangler secret list` — shows Worker secret names
- `flyctl logs --app vade-mcp` — bridge logs `auth ok: operator
  <8-char-prefix>` on each successful WS auth, useful for confirming
  which token the SPA is currently sending

**Common foot-gun:** Worker `OPERATOR_TOKENS` and Fly
`VADE_AUTH_TOKENS` must hold the **same** operator token(s).
Updating one without the other surfaces as a 401 from
`/library/canvases` (*Library unavailable (401). Worker needs
OPERATOR_TOKENS …*) — and the SPA's MCP/canvas WS still works,
which makes the drift easy to miss.

## MCP tools

The MCP server exposes tools across three categories. See `mcp/`
for the exact callable surface and argument schemas — that
directory is the source of truth; do not treat this section as
an enumeration.

- **Shapes** (`mcp/tools/shapes.ts`) — create, update, delete,
  and query tldraw shapes, including the custom `CodeShape` and
  `DataShape`; batch operations; bindings between shapes.
- **Canvas** (`mcp/tools/canvas.ts`) — query and navigate canvas
  state (viewport, selection), persist snapshots into
  `~/.vade/library/`, restore / search the library.
- **Runtime** (`mcp/tools/runtime.ts`) — wire shapes into the
  Control → State → Visualization loop: request code changes on
  a shape, execute runtime hooks, move data between shapes.

The server registers all three tool groups through
`mcp/index.ts`; transport is stdio, and the canvas bridge is a
separate WebSocket on `:7600` (`mcp/ws-server.ts`).
