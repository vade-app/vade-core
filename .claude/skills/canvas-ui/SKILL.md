---
name: canvas-ui
description: Apply vade-core's canvas/tldraw frontend conventions and avoid the recurring landmines we've already learned about. Use this skill whenever you're working in vade-core on anything that touches the canvas — adding or modifying a custom shape under `src/shapes/`, wiring UI through `src/shell/AppShell.tsx`, mutating shapes through the MCP bridge in `src/bridge/`, the `vade-asset-store`, snapshot persistence, the library/catalog/shape-panel surfaces, or anywhere else `tldraw` or `@tldraw/*` is imported. Trigger even when the prompt only mentions "the canvas," "a shape," "AppShell," "persistenceKey," "asset store," "TLAssetStore," "ShapeUtil," "BindingUtil," "snapshot," "the editor," or "tldraw" without naming the skill — and especially trigger before opening a PR that changes any tldraw-touching file. This skill is the anti-patterns and conventions layer; for SDK reference / doc URLs, also consult the `tldraw-docs` skill (the two compose).
---

# canvas-ui

This skill encodes what the `vade-core` codebase has already learned about working with tldraw — the conventions that exist, and the same-day hot-fix patterns we've burned cycles on. It is the *patterns* layer; the sister skill `tldraw-docs` is the *docs URL navigation* layer. Use both: this one tells you what shape good code takes here and which mistakes to pre-empt; `tldraw-docs` tells you exactly which page to fetch when you need an API signature or feature mental model.

The repo runs `tldraw ^4.5.10`, React 18, TypeScript strict. The core architectural commitment is canvas as primary surface, with a Cloudflare Worker hosting the SPA and an MCP bridge mutating shapes via WebSocket on `:7600`. That commitment shapes every decision below.

## Triage posture: cheap moves first

This skill is dense — seven landmines, several conventions, a pre-merge checklist. The temptation is to consult all of it on every prompt. Don't. The right default is:

1. **Match the symptom to a landmine.** If the user's report matches a landmine signature cleanly, prescribe the named fix and stop. The seven landmines below are deliberately phrased as recognisable signatures.
2. **Check whether the fix is already in place.** Most landmines below have already been fixed at least once; the `git log` and PR history will show whether main carries the fix. If the fix is on main and the user is seeing the symptom, the *first* hypothesis is "stale build / cache / local checkout" — not a fresh regression. Recommend `git pull` and a hard-reload before going deeper.
3. **Open up the investigation only when (1) the symptom doesn't match cleanly, or (2) the fix is already applied AND the symptom persists after a clean rebuild.** That's the seam where exploring secondary hypotheses (a recent PR re-introduced the trap, an adjacent code path causes a remount, a deeper API quirk) earns its keep. Until then, the prescriptive answer is the right answer.

The cost framing: a confident one-line diagnosis the user can act on in seconds is usually worth more than a multi-hypothesis investigation that costs minutes. Save the depth for cases that genuinely need it.

## When to consult `tldraw-docs`, when to act from this skill alone

Roughly:

- **`tldraw-docs` first** when you don't know the API: "what does `editor.createShape()` take," "is there a feature page for snapping," "what example most closely resembles this." That skill has the URL patterns and the slug index.
- **This skill first** when you're touching code we already maintain: a new custom shape, a snapshot operation, an asset upload, a panel that wraps `<Tldraw>`. The conventions and landmines below kick in before you hit the SDK boundary.
- **Both, in sequence,** for non-trivial work: skim the seven landmines in this skill so you know which traps apply, then go to `tldraw-docs` for the specific API page.

If you're about to write a new pattern from scratch, check `references/sdk-features-index.md` (in the `tldraw-docs` skill) for an existing example slug — tldraw ships ~150, and most non-trivial canvas patterns have one within one degree.

## The seven landmines

Each of these has at least one same-day hot-fix PR in our history. The pattern is so consistent that it's worth treating these as a pre-merge checklist for any tldraw-touching PR (see end of file). Cite the PR numbers when the same trap shows up again — they're the worked examples.

### 1. Custom `props.src` schemes blow up on canvas load

tldraw's `@tldraw/validate` allowlists `srcUrl` to exactly four protocols: `http:`, `https:`, `data:`, `asset:`. Anything else — including a tempting `vade-asset:` — fails on canvas load with `Expected a valid url, got "..." (invalid protocol)`. The bug doesn't surface at write time; it surfaces when someone reloads the canvas later, often on a different device, and the schema validator runs.

**Convention.** Sub-namespace under `asset:` rather than inventing a new scheme: `asset:vade-<sha256>`. The `vade-asset-store` (`src/assets/vade-asset-store.ts`) detects its own srcs by prefix, and the validator is happy because the protocol is on the allowlist.

**Worked example.** PR #119 introduced `vade-asset:`, broke canvas load. PR #121 (one-line fix) renamed to `asset:vade-`. The lesson is structural: any new asset URI you emit must start with one of the four allowlisted protocols.

### 2. `persistenceKey` + `loadSnapshot` is a race

`persistenceKey` controls tldraw's IndexedDB session-state isolation (camera, current page, selection). Tldraw remounts when its `key` changes, and on remount it hydrates from the IndexedDB key. If you set `persistenceKey` per-document and rely on `loadStoreSnapshot` to populate from R2, the order is: snapshot loads → `setActive` flips persistenceKey → Tldraw remounts → IndexedDB hydration overwrites the just-loaded snapshot with empty state. Symptom: empty canvas after switching documents.

**Convention.** Use a single static `persistenceKey` (we use `'vade-main'` in `src/shell/AppShell.tsx:102`). Treat it as session-state isolation only, never as document identity. Document content lives in R2 and round-trips through `getCanvas` / `saveCanvas`; `loadStoreSnapshot` is the single source of truth on canvas switch.

**Worked example.** PR #174 introduced per-canvas `persistenceKey`. Issue #177 reported empty canvases. PR #178 reverted. If you ever have a strong need for per-canvas IndexedDB isolation, the only sound construction is to fire `loadSnapshot` *inside* the new Tldraw's `onMount` (after the remount lands), not before — and that's enough complexity to require explicit scope.

**If you're diagnosing this symptom right now:** check whether the fix in PR #178 (`persistenceKey = 'vade-main'`, no `persistenceKey` in the React `key`) is already on main. If it is, the symptom on a deployed app is almost always a stale build or cached SPA bundle. Recommend `git pull` + hard-reload + Cloudflare cache check before opening up secondary hypotheses (a later PR re-introduced the trap, a flex restructure caused a remount, etc.). Those hypotheses are real and worth exploring — but only if a fresh build still reproduces. The cheap move is the first move.

### 3. Snapshot wrapper objects passed to `loadStoreSnapshot`

`getStoreSnapshot()` returns an object with `schemaVersion`, `store`, etc. If you wrap that in a bridge envelope (e.g. `{shapeCount, types, pageId, snapshot}`) and pass the envelope back to `loadStoreSnapshot`, it crashes reading `.schemaVersion` off a field that doesn't exist there: `undefined is not an object (evaluating 'n.schemaVersion')`.

**Convention.** Always pass the raw `getStoreSnapshot()` return value to `loadStoreSnapshot()`. Type the wire format with a discriminator (`{kind: 'snapshot', payload: TLStoreSnapshot}`) so this is unstoreable at the type level.

**Worked example.** PR #43.

### 4. `editor.run(...)` followed by an un-batched duplicate of the same loop

When a refactor adds `editor.run(() => { ...createShape... })` for batched history, it's easy to leave the original loop in place. Every shape op then runs twice — symptom: one MCP `createShapes` call returns two shape IDs, undo only removes one.

**Convention.** When wrapping mutations in `editor.run`, delete the prior call sites. Single undo step is the correctness signal: one MCP call should equal one history entry. The bridge code in `src/bridge/ws-client.ts` is the pattern source — every shape mutation handler is one `editor.run`, no follow-up loop.

**Worked example.** PR #106 (−18 lines, +0).

### 5. Modal/portal patterns that lose `editor.isFocused`

tldraw gates keyboard shortcuts (`H`, `V`, etc.) and wheel/pan events on `editor.isFocused`. Two failure paths:

1. A modal portaled to `document.body` blurs the editor when the user clicks inside it.
2. `loadStoreSnapshot` restores the saved `instance` record carrying `isFocused=false`, so even after a clean snapshot load, the editor is unfocused.

**Convention.** Any UI that portals or steals focus must call `editor.focus()` on close. After every `loadStoreSnapshot`, force-refocus regardless of how the snapshot was authored.

**Worked example.** PR #68.

### 6. Floating fixed-position chrome collides with tldraw's stock UI

`position: fixed; top: 12; right: 12` overlay buttons sit on top of tldraw's Style panel; `top: 12; left: 12` overlay buttons sit on top of undo/redo. The overlap is invisible on a clean canvas (no shape selected, default tools) and obvious the moment a user actually works.

**Convention.** Render custom chrome through tldraw's `TLUiComponents` slots — `SharePanel` (top-right) for chips, `MainMenu` for menu items, etc. — or reflow tldraw's container so its chrome moves out of the way. Never as a sibling overlay with hardcoded coordinates that share screen space with tldraw chrome. See `src/shell/AppShell.tsx` for the slot-injection pattern.

If the design calls for a sidebar or full-page overlay (catalog, library), keep the canvas in its own flex/grid cell so tldraw lays out within its actual viewport rather than fighting the panel for space.

**Worked example.** PR #174 (introduced floating pills) → issue #175 → PR #176 (moved pills into `TopRightSlot`). Issue #183 is open as of this writing — the catalog sidebar still has the same overlap-vs-push problem; that's an outstanding instance of the same pattern.

### 7. Production hostname triggers tldraw's license-blank

tldraw v4.5.x's `LicenseManager.getIsDevelopment()` flags any non-localhost HTTPS origin as `unlicensed-production` and renders an empty SVG (`<></>`) after a 5-second grace window. The canvas just goes blank.

**Convention.** Any production-hostname deploy needs a `licenseKey` prop on `<Tldraw>` and `VITE_TLDRAW_LICENSE_KEY` in env. Hobby License is wired for `*.vade-app.dev` (issue #100, closed #32). When deploying a new app to a new origin, the symptom to recognise is "canvas works for ~5 seconds then disappears."

**Worked example.** Issue #32 → PR #100.

## Conventions worth knowing before you write code

### Custom shape: three files, not one

Every custom shape under `src/shapes/<name>/` is three files:

| File | Owns |
| --- | --- |
| `params.ts` | Two schemas: a Zod `paramSchema` for the param-form/validation surface, and a tldraw `T.*` `tldrawProps` for the store record schema. They duplicate intentionally — different consumers (form UI vs. store validator). Plus `defaultProps`. |
| `util.tsx` | The `ShapeUtil` (almost always `BaseBoxShapeUtil<...>`). `static type`, `static props = tldrawProps`, `getDefaultProps()`, `component()`, `indicator()`. |
| `meta.ts` | The registry entry — `{id, name, util, paramSchema, defaultProps}` — that the shape registry glob-imports via `import.meta.glob` (`src/shapes/registry.ts`). |

The dual-schema duplication is deliberate and scoped to one file. Don't try to unify Zod and `T.*` — they speak to different layers. See `src/shapes/code/params.ts` and `src/shapes/data/params.ts` for the canonical pair.

For the full step-by-step recipe (including the registry hook-up, props defaulting, and migration footnote), see `references/shape-recipe.md`.

### Editor nullability is a contract

In our shell, the `Editor` instance is created on `<Tldraw>`'s `onMount`, after which `AppShell` calls `setEditor(editor)`. Until then — and during teardown — it's `null`. Components that consume the editor receive it as `editor: Editor | null`, not via `useEditor()`, because they live *outside* `<Tldraw>` in the React tree (the panel composition pattern; see `src/shell/AppShell.tsx`).

**Convention.** Every method call on a forwarded `editor` prop guards with `if (!editor) return`. Don't `editor!.someMethod()` — the null is not theoretical, it's the pre-mount state. See `src/shape-panel/SelectedShapePanel.tsx` and `src/library/LibraryPanel.tsx` for the pattern.

### Reactive reads: `useValue` from `tldraw`, not `useState`

For state that's a function of editor signals — selection, current page, viewport, etc. — wrap the read in `useValue(name, () => editor.getX(), [editor])`. Plain `useState` won't re-render when the editor's signals change. Local UI state (panel open/closed, form values) is `useState` as usual.

For store events (post-commit, scope-filtered), use `editor.store.listen({ scope: 'document', source: 'user' }, callback)`. The `source: 'user'` filter is what excludes programmatic mutations (e.g. the very `loadStoreSnapshot` you just fired) from triggering autosave. See `src/library/useAutosave.ts:53-58`.

### Imports: `tldraw` for public API, `@tldraw/editor` for validators and internals

| Import from | Use for |
| --- | --- |
| `tldraw` | `Tldraw` component, `Editor` type, `useValue`, `BaseBoxShapeUtil`, `TLAssetStore`, `TLUiComponents`, `useEditor` |
| `@tldraw/editor` | `T.*` validators, `HTMLContainer`, `TLShapeId`, `TLAnyShapeUtilConstructor`, internal types not re-exported by `tldraw` |

The codebase mixes these inconsistently in a few places — that's tech debt, not the goal. New code should follow the split above.

### Mutations through `editor.run` for one history entry per call

Every multi-shape mutation in the bridge wraps in `editor.run(() => { ... })`. That guarantees one undo step for one MCP call. The same applies to UI code that mutates multiple shapes in response to a single user action (e.g. "align selected shapes"): one user action = one `editor.run` = one undo step. See `src/bridge/ws-client.ts` for the pattern. Cross-reference: PR #106 (landmine 4 above).

### Asset bytes don't travel in snapshots — use the asset store

`getStoreSnapshot()` round-trips asset *records* but not the bytes. Default tldraw asset stores (`inlineBase64AssetStore`, `persistenceKey`-IndexedDB) pin bytes to the originating device. Cross-device canvases need a real backing store.

`src/assets/vade-asset-store.ts` is the implementation: content-addressed via SHA-256, R2-backed via `POST/GET /library/assets`, srcs round-trip as `asset:vade-<hash>`. New asset-handling code goes through this store. MEMO-2026-05-01-ppjv is the canonical write-up.

### Dynamic chrome through tldraw slots, not fixed-position siblings

Custom buttons, chips, panels, and toolbars compose into `<Tldraw components={...} />` via the `TLUiComponents` API. `SharePanel` is the top-right slot; `TopPanel` and `MainMenu` are also commonly used. Reach for `tldraw-docs`'s `sdk-features/ui-components` and `examples/custom-components` if the slot you want isn't obvious. Cross-reference: landmine 6.

## Pre-merge checklist for tldraw-touching PRs

Before opening a PR that changes any file under `src/{shapes,shell,bridge,assets,library,catalog,shape-panel,portrait,lineage,dft}/` or `worker/library.ts`, walk through these:

1. **Asset URIs** — do any new `props.src` values use one of `http:`, `https:`, `data:`, `asset:`? (Landmine 1.)
2. **`persistenceKey`** — is it a single static value, not derived from active document state? If varying, is the new value computed inside `onMount` rather than as a prop on `<Tldraw>`? (Landmine 2.)
3. **Snapshot shape** — does `loadStoreSnapshot` receive a raw `getStoreSnapshot()` value, not an envelope? Is the wire format type-discriminated? (Landmine 3.)
4. **Mutation paths** — for each shape op, is there exactly one call site? Did a recent refactor wrap operations in `editor.run` without deleting the original loop? (Landmine 4.)
5. **Focus restoration** — does every new modal/panel close path call `editor.focus()`? Does `loadStoreSnapshot` get followed by `editor.focus()`? (Landmine 5.)
6. **Custom chrome** — is custom UI rendered through `TLUiComponents` slots, or as `position: fixed` siblings that overlap tldraw's stock UI? (Landmine 6.)
7. **Production hostname** — if this is wiring up a new origin, is `VITE_TLDRAW_LICENSE_KEY` plumbed through and `licenseKey` passed to `<Tldraw>`? (Landmine 7.)

These don't all apply to every PR. A pure params.ts edit on an existing shape only touches 4 (mutation paths). A new asset-handling module touches 1 and possibly 5. The point is to scan the list, not to rote-tick.

## Where to read first when…

| Situation | Read |
| --- | --- |
| Adding a new custom shape | `references/shape-recipe.md`, then `src/shapes/code/` and `src/shapes/data/` as worked examples; `tldraw.dev/sdk-features/shapes` and `tldraw.dev/examples/custom-shape` for the SDK side |
| Modifying the shell or panel composition | `src/shell/AppShell.tsx` first; `tldraw.dev/sdk-features/ui-components` for the slot API |
| Mutating shapes from the bridge / MCP | `src/bridge/ws-client.ts` + `mcp/tools/shapes.ts`; `tldraw.dev/reference/editor/Editor` for method signatures |
| Snapshot, persistence, save/load | `src/library/useAutosave.ts` + `src/library/LibraryPanel.tsx` + `worker/library.ts`; `tldraw.dev/sdk-features/persistence` for the model |
| Asset upload, image bytes, custom asset stores | `src/assets/vade-asset-store.ts`; MEMO-2026-05-01-ppjv; `tldraw.dev/sdk-features/assets` |
| Bindings (arrow terminals, sticker-on-shape) | `tldraw.dev/sdk-features/bindings`, `tldraw.dev/reference/editor/BindingUtil`, examples `sticker-bindings` and `arrow-binding-options` — we don't have a vade-side worked example yet, so the SDK source is primary |

When in doubt about a method signature or the current shape of an API, anchor the lookup to `^4.5.10` (our pinned version, see `package.json`). Behavior across major versions diverges meaningfully — v3 and v4 most notably around licensing and a few API renames. The `tldraw-docs` skill has the version-anchored URLs.

## What this skill is *not*

- Not a tldraw tutorial — read the SDK feature pages or the `tldraw-docs` skill for that.
- Not a substitute for reading the code in `src/`. Patterns evolve; the live code is authoritative. When you find a divergence between this skill and current `src/`, the skill is stale and should be patched (open a PR to `vade-core` updating this file).
- Not a list of every convention in the codebase — just the ones with concrete failure modes already in our PR history. New patterns earn a section here once they've cost us a hot-fix.
