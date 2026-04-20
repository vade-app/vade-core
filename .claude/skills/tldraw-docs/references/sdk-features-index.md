# tldraw docs: slug index (snapshot)

Snapshot of `https://tldraw.dev/llms.txt` captured on **2026-04-20** (tldraw v4.5.x). This is the authoritative list of every SDK feature, release, and example page as of the snapshot date.

**If a topic isn't listed here, fetch `https://tldraw.dev/llms.txt` fresh** — the tldraw team adds pages over time and this file goes stale between skill updates.

URL patterns:
- SDK feature → `https://tldraw.dev/sdk-features/{slug}`
- Example → `https://tldraw.dev/examples/{slug}`
- Release → `https://tldraw.dev/releases/{slug}`

---

## SDK features

Each slug maps to `tldraw.dev/sdk-features/{slug}`.

- accessibility
- actions
- animation
- assets
- bindings
- camera
- click-detection
- clipboard
- collaboration
- coordinates
- culling
- cursor-chat
- cursors
- deep-links
- default-shapes
- drag-and-drop
- draw-shape
- edge-scrolling
- editor
- embed-shape
- environment
- errors
- events
- external-content
- focus
- geo-shape
- geometry
- groups
- handles
- highlighting
- history
- image-export
- indicators
- input-handling
- instance-state
- internationalization
- license-key
- locked-shapes
- note-shape
- options
- pages
- parenting
- performance
- persistence
- readonly
- rich-text
- scribble
- selection
- shape-clipping
- shape-indexing
- shape-transforms
- shapes
- side-effects
- signals
- snapping
- store
- styles
- text-measurement
- text-shape
- ticks
- tools
- ui-components
- ui-primitives
- user-following
- user-preferences
- validation
- visibility

## Higher-level docs

Slugs under `tldraw.dev/docs/{slug}`. Smaller, more conceptual than the per-feature pages.

- editor
- shapes
- tools
- user-interface
- handles
- persistence
- assets
- indicators
- collaboration
- ai
- sync
- llm-docs

## Releases

Each slug maps to `tldraw.dev/releases/{slug}`.

- next (unreleased changes)
- v4.5.0
- v4.4.0
- v4.3.0
- v4.2.0
- v4.1.0
- v4.0.0
- v3.15.0
- v3.14.0
- v3.13.0
- v3.12.0
- v3.11.0
- v3.10.0
- v3.9.0
- v3.8.0
- v3.7.0
- v3.6.0
- v3.5.0
- v3.4.0
- v3.3.0
- v3.2.0
- v3.1.0
- v3.0.0
- v2.4.0
- v2.3.0
- v2.2.0
- v2.1.0
- v2.0.0

## Examples

Each slug maps to `tldraw.dev/examples/{slug}`. Grouped loosely by topic for easier browsing.

### Getting started & configuration
- basic — the Tldraw component
- custom-options — editor options
- configure-shape-util — shape options
- camera-options
- asset-props
- custom-text-outline
- persistence-key
- readonly
- reduced-motion
- custom-embed
- custom-stroke-and-font-sizes
- environment-detection
- deep-links
- frame-colors
- resize-note
- arrows-precise-exact
- disable-pages
- only-editor — minimal
- exploded — sublibraries

### Canvas control & snapshots
- api — controlling the canvas
- snapshots — save and load
- coordinate-system
- create-arrow
- custom-clipping-shape
- zoom-to-bounds
- arrow-labels
- local-videos — create a video shape
- local-images — create an image shape
- dynamic-tools
- editor-focus
- lock-camera-zoom
- text-search
- shape-animation
- z-order
- align-and-distribute-shapes
- conditional-culling
- lasso-select-tool
- locked-shapes
- reactive-inputs
- focus-mode
- interaction-end-callback
- easter-egg-styles
- inspector-panel

### UI customization
- toolbar-groups
- vertical-toolbar
- add-tool-to-toolbar
- remove-tool
- changing-default-colors
- changing-default-style
- custom-menus
- rich-text-on-multiple-shapes
- ui-components-hidden
- menu-system-hover
- screen-reader-accessibility
- things-on-the-canvas
- toasts-and-dialogs
- ui-primitives
- zones
- hide-ui
- custom-ui — replace the entire UI
- contextual-toolbar
- custom-components
- custom-grid
- drag-and-drop-tray
- error-boundary
- selection-ui
- text-mass-style-updates
- action-overrides — custom actions
- custom-error-capture
- indicators-logic — custom indicators
- keyboard-shortcuts
- selection-color-condition
- force-mobile
- infer-dark-mode
- dark-mode-toggle
- layer-panel
- floaty-window
- custom-language-translations

### Layout & embedding
- custom-renderer
- inset — inset editor
- inline — inset editor (fixed sizes)
- inline-behavior — inset editor (common practices)
- inset-canvas
- scroll — scrollable container
- multiple — multiple editors
- external-dialog
- external-ui-context
- external-ui
- image-component — snapshot image
- unsaved-changes

### Events & reactivity
- signals
- canvas-events
- store-events
- ui-events
- event-blocker — block events
- prevent-instance-change
- prevent-shape-change
- prevent-multi-shape-selection

### Side effects on shapes
- before-create-update-shape
- before-delete-shape
- custom-double-click-behavior
- after-create-update-shape
- after-delete-shape
- permissions
- permissions-2
- derived-view
- meta-on-change
- meta-on-create
- custom-shape-wrapper
- globs — globs editor

### Custom shapes & tools
- custom-shape
- custom-tool — sticker tool
- screenshot-tool — custom tool
- cubic-bezier-shape
- custom-config — custom shape and tool
- shape-with-onClick
- shape-with-custom-styles
- shape-with-tldraw-styles
- interactive-shape — clickable custom shape
- custom-relative-snapping — custom handle snap reference
- speech-bubble — custom shape with handles
- tool-with-child-states
- editable-shape
- arrow-binding-options
- shape-with-geometry
- shape-with-migrations
- toSvg-method-example — custom shape SVG export
- bounds-snapping-shape — custom snapping
- custom-validators — custom validators for shape props
- text-shape-configuration — programmatic text shape creation
- ag-grid-shape — data grid shape
- drag-and-drop — drag and drop shape
- sticker-bindings — attach shapes together
- size-from-dom — DOM-based shape size
- layout-bindings — layout constraints
- pin-bindings

### Rich text
- rich-text-custom-extension
- rich-text-font-extensions
- outlined-text
- popup-shape

### Collaboration & sync
- sync-demo — multiplayer sync
- sync-custom-shape
- sync-custom-people-menu
- sync-custom-presence
- sync-custom-user
- sync-private-content
- user-presence — manually update user presence

### Persistence & assets
- local-storage — persist to storage
- static-assets
- export-canvas-as-image
- export-canvas-settings — export with settings
- hosted-images
- custom-paste
- external-content-sources
- meta-migrations

### Application examples (larger, good for reference)
- slideshow — slideshow with fixed camera
- slides — slideshow with free camera
- education-canvas
- image-annotator
- pdf-editor
- mask-window — canvas mask
- fog-of-war
- exam-marking
- many-shapes — performance example
- snowstorm
- timeline-scrubber

---

## API reference packages

Not listed in `llms.txt` but reachable at `tldraw.dev/reference/{package}/{Symbol}`. The index page for each package lists its classes, functions, variables, interfaces, type aliases, and (for the `tldraw` package) components.

- `@tldraw/editor` — `tldraw.dev/reference/editor/Editor` — the biggest package; includes `Editor`, `ShapeUtil`, `BindingUtil`, `StateNode`, geometry classes (`Box`, `Vec`, `Mat`, `Circle2d`, `Rectangle2d`, `Polygon2d`, `CubicBezier2d`, `Geometry2d`, …), managers (`HistoryManager`, `SnapManager`, `ClickManager`, `InputsManager`, `EdgeScrollManager`, `ScribbleManager`, `FontManager`, `TextManager`, `UserPreferencesManager`), `ErrorBoundary`, `EditorAtom`.
- `@tldraw/state` — reactive primitives (atoms, computeds, reactors).
- `@tldraw/state-react` — React bindings for state.
- `@tldraw/store` — the underlying record store.
- `@tldraw/sync` / `@tldraw/sync-core` — tldraw sync multiplayer.
- `tldraw` — the top-level package; includes the `Tldraw` React component and default shape/tool implementations.
- `@tldraw/tlschema` — schema types for records.
- `@tldraw/validate` — runtime validators.

When you need a symbol's signature, go to `tldraw.dev/reference/{package}/{Symbol}` directly. If you don't know which package a symbol lives in, start at `tldraw.dev/reference/editor/Editor` (most common) or fetch the package index page at `tldraw.dev/reference/{package}/Editor`-style (they all share the same left-nav).
