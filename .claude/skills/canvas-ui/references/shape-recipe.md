# Custom shape recipe

Walk-through for adding a new custom shape under `src/shapes/<name>/`. Read this once when scaffolding; from then on, modelling a new shape from `src/shapes/code/` or `src/shapes/data/` is faster than re-reading.

## Layout

```
src/shapes/<name>/
├── index.ts      — re-exports (so registry imports stay clean)
├── meta.ts       — registry entry: {id, name, util, paramSchema, defaultProps}
├── params.ts     — Zod paramSchema + tldraw `T.*` tldrawProps + defaultProps
└── util.tsx     — the ShapeUtil class (component, indicator, default props)
```

## Step 1 — `params.ts`

The dual-schema is the load-bearing structure here. **Zod** drives the param-form UI in `src/shape-panel/` and runtime validation; **tldraw `T.*`** drives the store record schema (what survives `loadStoreSnapshot`). They duplicate intentionally and locally.

```ts
import { T } from '@tldraw/editor'
import { z } from 'zod'

export const paramSchema = z.object({
  w: z.number().positive().default(320),
  h: z.number().positive().default(200),
  // shape-specific fields with sensible defaults via .default()
})

export type FooShapeProps = z.infer<typeof paramSchema>

export const tldrawProps = {
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  // mirror the Zod fields with tldraw validators
}

export const defaultProps: FooShapeProps = {
  w: 320,
  h: 200,
  // every field present, even when the Zod default would cover it —
  // BaseBoxShapeUtil reads from getDefaultProps() at create time
}
```

**Why both?** Zod's form integrations (`ParamForm`) and TypeScript inference are great for editor-side UI. tldraw's `T.*` are part of the schema that snapshots are validated against on load — if you change `T.string` to `T.nonEmptyString`, old snapshots may fail validation. Keep them in sync; review the change set when you touch one.

**`.default()` matters.** Old saved snapshots predating a new field will lack it. Zod's `.default()` lets the form render. tldraw's record schema doesn't have a defaulting mechanism here — if you add a non-optional field without a migration, old shape records may fail validation on load. For now, keep new fields optional or make sure `getDefaultProps()` covers them; revisit when we wire formal migrations.

## Step 2 — `util.tsx`

```tsx
import { BaseBoxShapeUtil, HTMLContainer } from '@tldraw/editor'
import { defaultProps, tldrawProps, type FooShapeProps } from './params'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FooShape = any
export type { FooShape }

export class FooShapeUtil extends BaseBoxShapeUtil<FooShape> {
  static override type = 'vade-foo' as const
  static override props = tldrawProps

  getDefaultProps(): FooShapeProps {
    return { ...defaultProps }
  }

  component(shape: { props: FooShapeProps }) {
    return (
      <HTMLContainer style={{ /* ... */ }}>
        {/* render shape contents from shape.props */}
      </HTMLContainer>
    )
  }

  indicator(shape: { props: FooShapeProps }) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
```

The `type FooShape = any` plus eslint-disable is intentional and matches the existing shapes. tldraw's overload signatures for `BaseBoxShapeUtil<T>` over a custom shape type require a more elaborate type binding than the value of getting a strict shape pays for here. If you find a clean way to type this, propose it — but don't burn 30 minutes on a type-juggle when the existing pattern works.

`HTMLContainer` is the right wrapper for non-SVG shape contents — it sets `pointer-events: all` and the canvas-relative positioning. Use it for any shape rendered as DOM (code, data, rich text). Pure-SVG shapes (geo-style) skip it.

## Step 3 — `meta.ts`

```ts
import { paramSchema, defaultProps } from './params'
import { FooShapeUtil } from './util'
import type { ShapeMeta } from '../types'

export const fooShapeMeta: ShapeMeta = {
  id: 'vade-foo',
  name: 'Foo',
  util: FooShapeUtil,
  paramSchema,
  defaultProps,
}

export default fooShapeMeta
```

The shape ID is the `'vade-foo'` string. It must match `static type` in the util and is what the bridge / MCP refers to when creating shapes of this type.

## Step 4 — `index.ts`

```ts
export * from './params'
export * from './util'
export { default as meta } from './meta'
```

## Step 5 — Registry hook-up

`src/shapes/registry.ts` glob-imports every `meta.ts` via Vite's `import.meta.glob`. Adding a new shape directory under `src/shapes/<name>/` with the right structure should be picked up automatically — no edit to `registry.ts` needed.

The registry computes a `version` hash from the registered shape IDs. That hash becomes part of `<Tldraw key={...}>`, so a registry change forces a remount (fresh shape util binding). That's the right thing — if the shapes list has changed, the editor's schema is different.

## Step 6 — Verify

Locally:

```bash
npm run dev    # confirm the new shape registers without TS errors
npm run build  # tsc + vite build — catches type errors that dev's HMR forgives
```

Via the bridge: have the MCP `createShape` tool (`mcp/tools/shapes.ts`) create your shape with the correct `type` string. Roundtrip: save the canvas via `LibraryPanel`, reload, confirm the shape rehydrates with all props intact.

If validation fails on reload (`Expected ... at shape.props.<field>`), the Zod and tldraw `T.*` schemas have drifted. Re-align them.

## What you don't need to do

- Define a custom `ShapeUtil` from scratch — `BaseBoxShapeUtil<T>` is the right base for nearly everything we do; sub-classing it gives you bounding-box behavior, default geometry, and resize handles for free. Reach for `ShapeUtil<T>` only if you need non-rectangular geometry (`getGeometry()` overridden) or a custom resize model.
- Register tools or toolbar buttons. Custom shapes don't require a custom tool — they can be created via `editor.createShape({type: 'vade-foo', ...})` from the bridge or a UI button. A custom tool is only needed if you want a click-and-drag-to-create UX, which is an additional layer (`tldraw.dev/sdk-features/tools`, `examples/custom-tool`).
- Write migrations. We don't have a formal shape-migrations setup yet; for now, additive schema changes with `getDefaultProps()` defaulting cover the common case. When the shape model becomes more complex, revisit `tldraw.dev/sdk-features/shape-migrations` and the `examples/shape-with-migrations` example.

## When to look at the SDK

If any of these feel ambiguous:

| Question | Page (via `tldraw-docs` skill) |
| --- | --- |
| What can a `ShapeUtil` override? | `tldraw.dev/sdk-features/shapes`, `tldraw.dev/reference/editor/ShapeUtil` |
| How do bindings between shapes work? | `tldraw.dev/sdk-features/bindings`, `tldraw.dev/reference/editor/BindingUtil` |
| How do I make my shape resizable in a non-default way? | `tldraw.dev/examples/shape-with-geometry`, `tldraw.dev/sdk-features/shape-transforms` |
| Can a shape be edited in place (text, etc.)? | `tldraw.dev/examples/editable-shape` |
| Custom indicators (selection outlines) | `tldraw.dev/sdk-features/indicators`, `tldraw.dev/examples/indicators-logic` |

Anchor lookups to `tldraw ^4.5.10` — our pinned version. Confirm a method exists on this version before relying on it.
