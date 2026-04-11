# vade-core

**VADE kernel and canvas IDE.** The primary application repo for
[VADE](https://github.com/vade-app) — a Visual Agent-based
Development Environment. Canvas-based IDE/OS hybrid where a
hierarchical society of AI agents builds interactive tools via a
Control → State → Visualization loop.

## Status

**Pre-alpha.** Bootstrap phase — no source yet. Scaffolding begins
once `PROJ-bootstrap` completes.

## What this repo contains (when built)

- The canvas runtime (pan/zoom/camera model)
- The Control → State → Visualization loop primitives
- The agent orchestration layer (single PM + single dev at MVP)
- The plugin system
- The base UI-element and data-type libraries
- The DFT explorer as the reference artifact

## Tech stack

TypeScript (strict) + Vite + HTML5 Canvas / WebGL. Tauri for native
wrappers is deferred until the web target earns its weight.

## Governance

See [vade-governance](https://github.com/vade-app/vade-governance)
for the project's authority structure, decision rights, and
contribution rules. BDFL: Ven Popov.

## License

TBD — will be set before the first external contribution window.

## Contributing

Not open for external contribution during bootstrap. See
`vade-governance` for when and how external contribution opens.
