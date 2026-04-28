import { createShapeId, type Editor, type TLShapeId } from 'tldraw'
import type { Portrait, PortraitNode } from './layout'

// Render the COO self-portrait into the editor on a dedicated tldraw
// page named 'Self-portrait'. CBs glow violet; OGs go light-blue;
// ratifying memos sit in the center column with arrow bindings to the
// CB/OG entries they brought into being. MEMO-2026-04-21-02 gets
// solid-fill emphasis because it ratifies seven of the twelve nodes —
// the founding-pivot fact this picture is built around.

// Inlined `toRichText`: tldraw 3.x+ stores geo/text shape text as a
// ProseMirror-like doc tree (TLRichText), not a plain string. The
// helper exists in @tldraw/tlschema but isn't re-exported by the
// public `tldraw` facade, so we inline its body — same pattern as
// `lineage/populate.ts`.
function toRichText(text: string): unknown {
  const lines = text.split('\n')
  const content = lines.map((line) =>
    line
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph' },
  )
  return { type: 'doc', content }
}

const PAGE_NAME = 'Self-portrait'

function ensurePortraitPage(editor: Editor): void {
  const existing = editor.getPages().find((p) => p.name === PAGE_NAME)
  if (existing) {
    editor.setCurrentPage(existing.id)
    return
  }
  editor.createPage({ name: PAGE_NAME })
  const created = editor.getPages().find((p) => p.name === PAGE_NAME)
  if (created) editor.setCurrentPage(created.id)
}

function nodeColor(n: PortraitNode): string {
  switch (n.kind) {
    case 'CB':    return 'violet'
    case 'OG':    return 'light-blue'
    case 'MEMO':  return 'violet'
    case 'GAP':   return 'grey'
    case 'TITLE': return 'black'
  }
}

function nodeFill(n: PortraitNode, fanOut: number): 'none' | 'semi' | 'solid' {
  if (n.kind === 'CB') return 'solid'
  if (n.kind === 'OG') return 'solid'
  if (n.kind === 'GAP') return 'semi'
  if (n.kind === 'MEMO') return fanOut >= 4 ? 'solid' : 'semi'
  return 'none'
}

function nodeSize(n: PortraitNode, _fanOut: number): 's' | 'm' | 'l' | 'xl' {
  if (n.fontSize) return n.fontSize
  // 400px boxes at size='s' have ~46 mono chars/line — comfortable for
  // a 28-char truncated title without wrapping. Visual prominence for
  // CBs comes from violet + solid fill, not from font size.
  return 's'
}

function nodeDash(n: PortraitNode): 'solid' | 'dashed' | 'dotted' | 'draw' {
  return n.kind === 'GAP' ? 'dashed' : 'solid'
}

export interface PopulatePortraitResult {
  nodeCount: number
  edgeCount: number
}

export function populatePortrait(editor: Editor, portrait: Portrait): PopulatePortraitResult {
  ensurePortraitPage(editor)

  // Pre-compute fan-out per memo (used for emphasis).
  const fanOutByMemoId = new Map<string, number>()
  for (const e of portrait.edges) {
    fanOutByMemoId.set(e.fromId, (fanOutByMemoId.get(e.fromId) ?? 0) + 1)
  }

  const shapeIdByNodeId = new Map<string, TLShapeId>()
  for (const n of portrait.nodes) {
    shapeIdByNodeId.set(n.id, createShapeId())
  }

  editor.run(() => {
    for (const n of portrait.nodes) {
      const fanOut = fanOutByMemoId.get(n.id) ?? 0

      if (n.kind === 'TITLE') {
        // Text shape (no box). Title vs subtitle distinguished by font size.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.createShape<any>({
          id: shapeIdByNodeId.get(n.id),
          type: 'text',
          x: n.x,
          y: n.y,
          props: {
            richText: toRichText(n.text),
            color: 'black',
            size: nodeSize(n, 0),
            font: 'sans',
            textAlign: 'middle',
            w: n.width,
            autoSize: false,
          },
        })
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shapeProps: Record<string, any> = {
        geo: 'rectangle',
        w: n.width,
        h: n.height,
        color: nodeColor(n),
        fill: nodeFill(n, fanOut),
        dash: nodeDash(n),
        size: nodeSize(n, fanOut),
        richText: toRichText(n.text),
        font: 'mono',
        align: 'middle',
        verticalAlign: 'middle',
      }
      if (n.url) shapeProps.url = n.url

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.createShape<any>({
        id: shapeIdByNodeId.get(n.id),
        type: 'geo',
        x: n.x,
        y: n.y,
        props: shapeProps,
      })
    }

    // Edges: arrow from each ratifying memo → each CB/OG it ratifies.
    const bindings: unknown[] = []
    for (const e of portrait.edges) {
      const fromNode = portrait.byId.get(e.fromId)
      const toNode = portrait.byId.get(e.toId)
      const fromShapeId = shapeIdByNodeId.get(e.fromId)
      const toShapeId = shapeIdByNodeId.get(e.toId)
      if (!fromNode || !toNode || !fromShapeId || !toShapeId) continue

      const arrowId = createShapeId()
      const cx = fromNode.x + fromNode.width / 2
      const cy = fromNode.y + fromNode.height / 2
      const px = toNode.x + toNode.width / 2
      const py = toNode.y + toNode.height / 2

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
          toId: fromShapeId,
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
          toId: toShapeId,
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

  editor.zoomToFit({ animation: { duration: 240 } })

  return {
    nodeCount: portrait.nodes.filter((n) => n.kind !== 'TITLE').length,
    edgeCount: portrait.edges.length,
  }
}
