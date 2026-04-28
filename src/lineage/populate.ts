import { createShapeId, type Editor, type TLShapeId } from 'tldraw'
import type { Layout, LayoutNode, Topic } from './layout'

// Render a Layout into the editor as `geo` rectangles + `arrow`
// shapes connected by tldraw bindings (so arrows snap to shape edges
// and follow if a node moves). Each rectangle carries a `url` prop
// pointing at the memo's GitHub blob URL — clicking the link icon
// opens the memo source. Color encodes topic; fill + size encode
// state (CB / frontier / superseded).

// Inlined `toRichText`: tldraw 3.x stores geo-shape text as a
// ProseMirror-like doc tree (TLRichText), not a plain string. The
// helper exists in @tldraw/tlschema but isn't re-exported by the
// public `tldraw` facade, so we inline its 8-line body rather than
// reach into a non-public surface.
function toRichText(text: string): unknown {
  const lines = text.split('\n')
  const content = lines.map((line) =>
    line
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph' },
  )
  return { type: 'doc', content }
}

const TOPIC_COLOR: Record<Topic, string> = {
  memory:     'blue',
  identity:   'violet',
  substrate:  'orange',
  governance: 'red',
  tooling:    'green',
  operations: 'grey',
}

function nodeColor(n: LayoutNode): string {
  return TOPIC_COLOR[n.topic]
}

function nodeFill(n: LayoutNode): 'none' | 'semi' | 'solid' {
  if (n.isCB) return 'solid'
  if (n.isFrontier) return 'semi'
  return 'none'
}

function nodeText(n: LayoutNode): string {
  // Two lines: ID on top, truncated title underneath. ~28 chars fits
  // comfortably in a 300px box at font='mono' size='s'.
  const title = n.memo.title.length > 30
    ? n.memo.title.slice(0, 28) + '…'
    : n.memo.title
  return `${n.memo.id}\n${title}`
}

function memoUrl(filePath: string): string {
  return `https://github.com/vade-app/vade-coo-memory/blob/main/${filePath}`
}

export interface PopulateResult {
  nodeCount: number
  edgeCount: number
}

export function populateLineage(editor: Editor, layout: Layout): PopulateResult {
  // Pre-allocate stable IDs for every node so we can reference them
  // from arrow bindings within the same transaction.
  const shapeIdByMemo = new Map<string, TLShapeId>()
  for (const n of layout.nodes) {
    shapeIdByMemo.set(n.memo.id, createShapeId())
  }

  editor.run(() => {
    // Nodes: one geo rectangle per memo. CB-bearing memos use size='l'
    // to physically dominate the timeline. URL prop links the shape to
    // the memo's GitHub blob URL — click the link icon on the shape.
    for (const n of layout.nodes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.createShape<any>({
        id: shapeIdByMemo.get(n.memo.id),
        type: 'geo',
        x: n.x,
        y: n.y,
        props: {
          geo: 'rectangle',
          w: n.width,
          h: n.height,
          color: nodeColor(n),
          fill: nodeFill(n),
          dash: 'solid',
          size: n.isCB ? 'l' : 's',
          url: memoUrl(n.memo.file_path),
          richText: toRichText(nodeText(n)),
          font: 'mono',
          align: 'middle',
          verticalAlign: 'middle',
        },
      })
    }

    // Edges: one arrow per supersession ref, plus two bindings
    // attaching its terminals to the child (start) and parent (end)
    // shapes. tldraw auto-routes between shape edges from the
    // normalized anchor.
    const bindings: unknown[] = []
    for (const e of layout.edges) {
      const child = layout.byId.get(e.fromId)
      const parent = layout.byId.get(e.toId)
      const childShapeId = shapeIdByMemo.get(e.fromId)
      const parentShapeId = shapeIdByMemo.get(e.toId)
      if (!child || !parent || !childShapeId || !parentShapeId) continue

      const arrowId = createShapeId()
      const cx = child.x + child.width / 2
      const cy = child.y + child.height / 2
      const px = parent.x + parent.width / 2
      const py = parent.y + parent.height / 2
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.createShape<any>({
        id: arrowId,
        type: 'arrow',
        x: cx,
        y: cy,
        props: {
          start: { x: 0, y: 0 },
          end: { x: px - cx, y: py - cy },
          color: 'light-violet',
          size: 's',
          dash: 'solid',
          arrowheadStart: 'none',
          arrowheadEnd: 'arrow',
          bend: 0,
        },
      })

      bindings.push(
        {
          type: 'arrow',
          fromId: arrowId,
          toId: childShapeId,
          props: {
            terminal: 'start',
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isPrecise: false,
            isExact: false,
          },
        },
        {
          type: 'arrow',
          fromId: arrowId,
          toId: parentShapeId,
          props: {
            terminal: 'end',
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isPrecise: false,
            isExact: false,
          },
        },
      )
    }

    if (bindings.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.createBindings(bindings as any)
    }
  })

  // Frame the result so the user sees the whole graph immediately.
  editor.zoomToFit({ animation: { duration: 240 } })

  return { nodeCount: layout.nodes.length, edgeCount: layout.edges.length }
}
