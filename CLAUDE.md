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

- Canvas-based UI — HTML5 Canvas / WebGL. Pannable, zoomable,
  infinite canvas treated as a camera over content.
- Control → State → Visualization loop as the primitive pattern
  for every artifact.
- Plugin system for extensibility.
- Target platforms: web (primary), iPad (via PWA), macOS desktop
  (via Tauri, deferred until web earns its weight).

## Tech stack (planned)

- TypeScript (strict mode) + Node.js 20 LTS
- Vite for dev server and bundling
- Tauri 2.x for desktop/mobile wrappers (later phase)
- Rust for performance-critical backend modules (later phase)

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

The repository is a fresh scaffold. No source yet. The first
concrete task is to scaffold the canvas shell: Vite + TypeScript
with an empty HTML5 canvas that supports pan and zoom.
