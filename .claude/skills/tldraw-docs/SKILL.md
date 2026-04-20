---
name: tldraw-docs
description: Navigate the tldraw SDK documentation efficiently. Use this skill whenever a task involves the tldraw canvas SDK — including the Editor class, shape utils, custom shapes, bindings, tools, persistence, side effects, the store/signals system, sync, UI components, or any tldraw.dev reference. This includes any work in the vade-core repo, which is built on tldraw. tldraw publishes LLM-optimized markdown bundles at tldraw.dev/llms*.txt plus markdown-ready individual pages; this skill teaches which bundle to fetch and how to navigate so agents don't hallucinate API signatures, grab the full mega-bundle when a narrow fetch would do, or guess at topic names that don't exist. Trigger whenever the user mentions tldraw, canvas shapes, ShapeUtil, BindingUtil, tldraw editor, custom tool, snapshot, or is clearly working in a tldraw-based codebase even if they don't name "tldraw" explicitly.
---

# tldraw-docs

The tldraw team publishes documentation in a format explicitly designed for language models. The naive failure modes when agents work with tldraw are:

1. **Hallucinating API signatures** — guessing `editor.createShape()` arguments from memory instead of looking them up.
2. **Grabbing too much** — fetching the giant `llms-full.txt` bundle when only one SDK feature page was needed.
3. **Getting lost** — wandering the site looking for a topic that has a predictable URL.
4. **Going stale on versioning** — pulling release notes for the wrong major version.

This skill exists to make each of those the obvious failure to avoid. The core move is: **know the four bundle flavors, know the URL patterns, fetch the smallest thing that answers the question.**

## The four bundles

tldraw publishes four markdown bundles at predictable URLs. Pick one:

| URL | What's in it | When to fetch |
| --- | --- | --- |
| `https://tldraw.dev/llms.txt` | **Index only** — a list of every feature page, example, and release with links. No content, just names and URLs. | First stop when you don't know the topic name. Tiny. Always safe. |
| `https://tldraw.dev/llms-docs.txt` | Every SDK feature page, concatenated. | You're working across multiple features at once (e.g. designing a custom shape that involves bindings + side effects + geometry) and want them all in context. |
| `https://tldraw.dev/llms-examples.txt` | Every example with its full source code. | You're looking for working code patterns — "how do I build a custom shape with handles," "how is sync wired up," etc. |
| `https://tldraw.dev/llms-releases.txt` | Every release note. | Version-sensitive questions: "when did method X change," "what broke between v3 and v4," migration work. |
| `https://tldraw.dev/llms-full.txt` | **Everything** — features + releases + examples concatenated. | Almost never. Only reach for this if the task is genuinely "read the whole SDK into context" and you've confirmed that's what's wanted. It is large. |

**Default posture:** start with `llms.txt` (the index) to orient, then fetch individual pages. Reach for a bundle only when you've confirmed you need breadth.

## Individual page URL patterns

Every documentation page on tldraw.dev has a "Copy markdown" button, and the pages render cleanly through `web_fetch` (the tool's markdown extraction handles them well). Use these patterns to go directly to a page when you know the topic:

| Pattern | Example | What it covers |
| --- | --- | --- |
| `tldraw.dev/sdk-features/{topic}` | `tldraw.dev/sdk-features/shapes` | Per-feature deep dive. The authoritative source for how a feature works. ~65 topics; see `references/sdk-features-index.md` for the full list of slugs. |
| `tldraw.dev/docs/{topic}` | `tldraw.dev/docs/editor`, `tldraw.dev/docs/shapes`, `tldraw.dev/docs/persistence` | Higher-level conceptual guides. Smaller set: `editor`, `shapes`, `tools`, `user-interface`, `handles`, `persistence`, `assets`, `indicators`, `collaboration`, `ai`, `sync`. |
| `tldraw.dev/reference/{package}/{Symbol}` | `tldraw.dev/reference/editor/Editor`, `tldraw.dev/reference/editor/ShapeUtil`, `tldraw.dev/reference/editor/BindingUtil` | **API reference.** Method signatures, parameter types, return types. This is where to go for "what does `editor.createShape()` take." Packages: `editor`, `state`, `state-react`, `store`, `sync`, `sync-core`, `tldraw`, `tlschema`, `validate`. |
| `tldraw.dev/examples/{slug}` | `tldraw.dev/examples/custom-shape`, `tldraw.dev/examples/sticker-bindings` | Working example with full source. The `llms-examples.txt` bundle is just these concatenated. |
| `tldraw.dev/releases/v{major}.{minor}.{patch}` | `tldraw.dev/releases/v4.5.0` | Release notes for a specific version. Also `/releases/next` for unreleased changes. |

When uncertain about a slug, fetch `llms.txt` first — it lists every valid path.

## Decision tree for common questions

**"What does `editor.{method}` do / what are its arguments?"**
→ `tldraw.dev/reference/editor/Editor` (the Editor API reference; the page has anchors like `#createShape`).

**"How do I define a custom shape / binding / tool?"**
→ Start at the SDK feature page: `tldraw.dev/sdk-features/shapes` (or `/bindings`, `/tools`). Then pull a matching example from `tldraw.dev/examples/custom-shape`, `/sticker-bindings`, `/custom-tool`. The feature page explains the model; the example shows the code.

**"How does {shape type} work — geo, text, draw, arrow, note, embed, highlight?"**
→ `tldraw.dev/sdk-features/{shape}-shape` (e.g. `geo-shape`, `note-shape`, `draw-shape`, `text-shape`, `embed-shape`). For arrows specifically, bindings are on `sdk-features/bindings`.

**"What's the right way to react to canvas changes / persist state / handle an event?"**
→ `sdk-features/events`, `sdk-features/side-effects`, `sdk-features/store`, `sdk-features/signals`, `sdk-features/persistence`. Pick the one that matches the granularity: events for UI input, side-effects for store mutations, signals for reactive derivations.

**"Did this API change recently / is this still the right approach in v4.5?"**
→ `tldraw.dev/releases/v4.5.0` and adjacent versions, or `llms-releases.txt` to search across all of them.

**"Show me working code for X."**
→ `tldraw.dev/examples` (or `llms-examples.txt`). The examples index in `references/sdk-features-index.md` lists every example slug.

**"I don't know the right topic name."**
→ Fetch `tldraw.dev/llms.txt` (the index). It's small and lists every feature, example, and release by name.

## Working efficiently

**Fetch narrowly by default.** Feature pages are usually a few hundred lines of markdown; the index is tiny. Fetching one page to answer a question is almost always cheaper than pulling `llms-full.txt`.

**Read the API reference for signatures, read the feature page for mental model.** The `sdk-features/*` pages explain *why* something works the way it does and when to use it. The `reference/*` pages give you exact parameter types. Most non-trivial tasks want both: skim the feature page, then confirm signatures against the reference.

**Check examples before writing from scratch.** tldraw has ~150 examples covering most patterns. If you're about to write a custom shape, there's likely an example within one degree of what you want. Check `references/sdk-features-index.md` for the example list before inventing.

**Anchor version-sensitive claims to a release.** If you're reasoning about whether a method exists, what its shape is, or whether an approach is current, name the version and cite the release notes. tldraw has moved through major versions fairly quickly, and behavior that held in v2 may not hold in v3, and v3 and v4 diverge in nontrivial ways (notably around licensing).

## VADE-specific context

This skill is used heavily inside the `vade-core` repo. A few things worth knowing when doing tldraw work there:

- **Current version: tldraw `3.15.6`** (pinned in `package.json` at commit `3495afd`). The repo's `CLAUDE.md` and `README.md` still say `^4.5.x` — that's stale; the actual dependency is v3. The pin is temporary, tracked in **issue #32**: tldraw v4 ships a license-enforcement gate in `@tldraw/editor`'s `LicenseProvider` that hides the editor DOM after a 5-second grace period on any deployment classified as `unlicensed-production` (HTTPS + non-localhost + `NODE_ENV=production`). Until a licensing decision lands, we're on the last v3 release that predates the enforcement gate.
  - **Implication for docs lookups:** anchor to `tldraw.dev/releases/v3.15.0` (and preceding v3 releases) rather than v4. When in doubt, check that an API existed in v3 — a handful of methods, defaults, and integration patterns were added or renamed in v4 (e.g. around assets, sync, and license plumbing).
  - **The `reference/editor/Editor` page on tldraw.dev reflects the latest release.** If a signature there looks unfamiliar compared to what's in our codebase, cross-check against `tldraw.dev/releases/v4.0.0` and later to see if it's a post-v3 addition, then fall back to the v3 behavior (the "See source code" link on each reference page points at `packages/editor/src/lib/editor/Editor.ts` on the main branch, which is v4 — useful for seeing the current implementation, not authoritative for us).
  - Before relying on a method, tool, or example that only appears in the v4 docs, run `node -e "console.log(require('@tldraw/editor/package.json').version)"` or check `package.json` to confirm what we actually ship.
- **Custom shapes live in `src/shapes/`.** VADE extends tldraw with `CodeShape` and `DataShape`. When adding a new custom shape, the relevant reading is `sdk-features/shapes`, `sdk-features/default-shapes`, and the examples `custom-shape`, `shape-with-migrations`, `shape-with-geometry`, `shape-with-tldraw-styles`, `editable-shape`. Confirm each example's code still compiles against v3 — some examples on tldraw.dev demonstrate v4-only APIs.
- **The MCP bridge (`mcp/`) wraps `Editor` methods.** MCP tools in `mcp/tools/shapes.ts`, `canvas.ts`, and `runtime.ts` translate JSON-RPC calls into `editor.createShape()`, `editor.updateShape()`, `editor.createBindings()`, etc. When extending the MCP surface, the tool's implementation needs to match a real v3 `Editor` method — check `reference/editor/Editor` for the signature, then verify it existed at v3.15 before wiring it up.
- **Bindings are load-bearing.** The `createBindings` MCP tool exists specifically because arrow terminals and similar connections need `BindingUtil`. Read `sdk-features/bindings` and `reference/editor/BindingUtil` before touching binding code. Bindings as a first-class concept shipped in v3.
- **The WebSocket protocol (`mcp/protocol.ts`) mirrors a subset of the Editor API.** When adding a new message type (e.g. a new `ServerMessage`), the corresponding canvas-side handler will call into the Editor — so whatever you add should map cleanly onto one or more v3 Editor methods.
- **Persistence is IndexedDB by default, R2+D1 via the cloud library.** See `sdk-features/persistence` and `sdk-features/store` for how tldraw snapshots work; the vade-core `worker/library.ts` and `mcp/stores/` modules wrap that. The snapshot format is v3's — if we eventually upgrade to v4, migrations will need a look.
- **Sync / collaboration is gated on the version decision.** `@tldraw/sync` compatibility with v3.15.6 needs confirmation before we commit to that path (see issue #44's out-of-scope section). If you're exploring sync, flag the version question explicitly rather than assuming parity with the current docs.
- **Phase 2 topics to be ready for:** richer shape types, selection-aware tools, side effects (for the Control → State → Visualization loop), ai integrations (`docs/ai`), and potentially tldraw sync (`sdk-features/collaboration`, `docs/sync`). When any of these come up, go straight to the relevant feature page — but filter through the v3 lens described above.

## The bundled reference

`references/sdk-features-index.md` is a snapshot of tldraw's `llms.txt` — the full listing of SDK features, examples, and releases by slug. Read it when you want to browse for a topic name without a network fetch. It's a snapshot, so if you can't find something there, fetch `tldraw.dev/llms.txt` fresh — new features and examples get added over time.
