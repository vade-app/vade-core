import type { Editor } from 'tldraw'
import type { Layout, LayoutNode } from './layout'

// Render a Layout into the editor as plain `geo` rectangles + `arrow`
// shapes. No bindings: arrows use absolute relative coordinates, so
// they don't track when nodes move. Acceptable for a generated
// snapshot — the canvas is a picture of the lineage at one moment,
// not a live editor.

// Inlined `toRichText`: tldraw 3.x stores geo-shape text as a
// ProseMirror-like doc tree (TLRichText), not a plain string. The
// helper exists in @tldraw/tlschema but isn't re-exported by the
// public `tldraw` facade, so we inline its 8-line body rather than
// reach into a non-public surface. Mirrors
// node_modules/@tldraw/tlschema/src/misc/TLRichText.ts.
function toRichText(text: string): unknown {
  const lines = text.split('\n')
  const content = lines.map((line) =>
    line
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph' },
  )
  return { type: 'doc', content }
}

function nodeColor(n: LayoutNode): 'black' | 'grey' | 'green' {
  if (n.isCB) return 'black'
  if (n.isFrontier) return 'green'
  return 'grey'
}

function nodeFill(n: LayoutNode): 'none' | 'semi' | 'solid' {
  if (n.isCB) return 'solid'
  if (n.isFrontier) return 'semi'
  return 'none'
}

function nodeText(n: LayoutNode): string {
  const title = n.memo.title.length > 32
    ? n.memo.title.slice(0, 30) + '…'
    : n.memo.title
  return `${n.memo.id}\n${title}`
}

export interface PopulateResult {
  nodeCount: number
  edgeCount: number
}

export function populateLineage(editor: Editor, layout: Layout): PopulateResult {
  editor.run(() => {
    // Nodes: one geo rectangle per memo.
    for (const n of layout.nodes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.createShape<any>({
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
          size: 's',
          richText: toRichText(nodeText(n)),
          font: 'mono',
          align: 'middle',
          verticalAlign: 'middle',
        },
      })
    }

    // Edges: one arrow per supersession ref. Child → parent (citation
    // direction). Arrow shape sits at child's center; start at (0,0),
    // end at the parent center delta. Center-to-center; arrowheads
    // will dip into rectangle interiors slightly. Fine.
    for (const e of layout.edges) {
      const child = layout.byId.get(e.fromId)
      const parent = layout.byId.get(e.toId)
      if (!child || !parent) continue
      const cx = child.x + child.width / 2
      const cy = child.y + child.height / 2
      const px = parent.x + parent.width / 2
      const py = parent.y + parent.height / 2
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.createShape<any>({
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
    }
  })

  // Frame the result so the user sees the whole graph immediately.
  editor.zoomToFit({ animation: { duration: 240 } })

  return { nodeCount: layout.nodes.length, edgeCount: layout.edges.length }
}
