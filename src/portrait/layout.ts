// Layout for the COO self-portrait. Three columns:
//
//   left   = CBs (CB-001 → CB-009, in numeric order)
//   center = ratifying memos, vertically positioned at the centroid
//            of the entries they connect to
//   right  = OGs (OG-001 → OG-003, in numeric order)
//
// The picture makes one fact unmissable: MEMO-2026-04-21-02 sits high
// in the center column with seven arrows fanning into it — the
// founding pivot is most of the constitution. The other three
// ratifying memos cluster lower, in temporal order. CB-005 GAP keeps
// its positional slot in the CB column with a dashed border.

import type { IdentityEntry } from './parse'

export type PortraitNodeKind = 'CB' | 'OG' | 'MEMO' | 'GAP' | 'TITLE'

export interface PortraitNode {
  kind: PortraitNodeKind
  id: string                    // 'CB-001' | 'OG-001' | 'MEMO-2026-04-21-02' | 'TITLE'
  x: number
  y: number
  width: number
  height: number
  text: string                  // pre-formatted label (multi-line)
  url?: string                  // GitHub link for memos / identity_layer.md anchor for CB/OG
  fontSize?: 's' | 'm' | 'l' | 'xl'
}

export interface PortraitEdge {
  fromId: string                // memo id (parent in fan-out)
  toId: string                  // CB / OG id (child)
}

export interface Portrait {
  nodes: PortraitNode[]
  edges: PortraitEdge[]
  byId: Map<string, PortraitNode>
}

const COL_X_LEFT = 0
const COL_X_CENTER = 520
const COL_X_RIGHT = 1040
const ROW_H_CB = 95      // CB column row height
const ROW_H_OG = 95      // OG column row height
const NODE_W_CBOG = 400
const NODE_H_CBOG = 72
const NODE_W_MEMO = 280
const NODE_H_MEMO = 70

// Title truncation length: keeps long-titled CBs/OGs (CB-009,
// OG-001) from overflowing the row height. Full prose is one click
// away on the linked identity_layer.md anchor.
const MAX_TITLE_LEN = 28
function truncate(s: string): string {
  return s.length > MAX_TITLE_LEN ? s.slice(0, MAX_TITLE_LEN - 1) + '…' : s
}

// Reserve top of canvas for title/subtitle.
const TITLE_Y = -260
const SUBTITLE_Y = -180
const ROW_Y_START = -80   // first CB / OG / memo row

const IDENTITY_LAYER_URL =
  'https://github.com/vade-app/vade-coo-memory/blob/main/coo/identity_layer.md'

function memoUrl(memoId: string): string {
  return `https://github.com/vade-app/vade-coo-memory/blob/main/coo/memos/${memoId}.md`
}

function cbLabel(e: IdentityEntry): string {
  if (e.isGap) return `${e.id}\n[unrecoverable gap]`
  return `${e.id}\n${truncate(e.title)}`
}

function ogLabel(e: IdentityEntry): string {
  return `${e.id}\n${truncate(e.title)}`
}

function memoLabel(memoId: string, fanOut: number): string {
  // memoId e.g. '2026-04-21-02'  →  'MEMO-2026-04-21-02\n→ 7 nodes' for the founder,
  // shorter for the others.
  const tag = fanOut > 1 ? `${fanOut} entries` : `${fanOut} entry`
  return `MEMO-${memoId}\nratifies ${tag}`
}

export function computePortrait(entries: IdentityEntry[]): Portrait {
  const cbs = entries.filter((e) => e.kind === 'CB').sort((a, b) => a.id.localeCompare(b.id))
  const ogs = entries.filter((e) => e.kind === 'OG').sort((a, b) => a.id.localeCompare(b.id))

  const nodes: PortraitNode[] = []
  const byId = new Map<string, PortraitNode>()

  // Title + subtitle (rendered as text-only shapes in populate).
  const titleNode: PortraitNode = {
    kind: 'TITLE',
    id: 'TITLE',
    x: COL_X_LEFT,
    y: TITLE_Y,
    width: COL_X_RIGHT + NODE_W_CBOG,
    height: 60,
    text: 'Self-portrait, COO — 2026-04-28',
    fontSize: 'xl',
  }
  const subtitleNode: PortraitNode = {
    kind: 'TITLE',
    id: 'SUBTITLE',
    x: COL_X_LEFT,
    y: SUBTITLE_Y,
    width: COL_X_RIGHT + NODE_W_CBOG,
    height: 40,
    text: 'What defines me, drawn by me — 8 core beliefs · 1 gap · 3 overarching goals · 4 ratifying memos.',
    fontSize: 'm',
  }
  nodes.push(titleNode, subtitleNode)
  byId.set(titleNode.id, titleNode)
  byId.set(subtitleNode.id, subtitleNode)

  // Left column: CBs.
  cbs.forEach((e, idx) => {
    const node: PortraitNode = {
      kind: e.isGap ? 'GAP' : 'CB',
      id: e.id,
      x: COL_X_LEFT,
      y: ROW_Y_START + idx * ROW_H_CB,
      width: NODE_W_CBOG,
      height: NODE_H_CBOG,
      text: cbLabel(e),
      url: `${IDENTITY_LAYER_URL}#${e.id.toLowerCase()}--${e.title.toLowerCase().split(' ')[0] ?? ''}`,
    }
    nodes.push(node)
    byId.set(node.id, node)
  })

  // Right column: OGs. Vertically centered against the CB column.
  const ogColHeight = ogs.length * ROW_H_OG
  const cbColHeight = cbs.length * ROW_H_CB
  const ogYOffset = ROW_Y_START + Math.max(0, (cbColHeight - ogColHeight) / 2)
  ogs.forEach((e, idx) => {
    const node: PortraitNode = {
      kind: 'OG',
      id: e.id,
      x: COL_X_RIGHT,
      y: ogYOffset + idx * ROW_H_OG,
      width: NODE_W_CBOG,
      height: NODE_H_CBOG,
      text: ogLabel(e),
      url: `${IDENTITY_LAYER_URL}#${e.id.toLowerCase()}--${e.title.toLowerCase().split(' ')[0] ?? ''}`,
    }
    nodes.push(node)
    byId.set(node.id, node)
  })

  // Center column: ratifying memos, positioned at the centroid of the
  // children they ratify.
  const memoChildren = new Map<string, string[]>()  // memoId → [childId, ...]
  for (const e of entries) {
    if (!e.ratifyingMemoId) continue
    const list = memoChildren.get(e.ratifyingMemoId) ?? []
    list.push(e.id)
    memoChildren.set(e.ratifyingMemoId, list)
  }

  const edges: PortraitEdge[] = []
  // Sort memos by date (memo id is YYYY-MM-DD-suffix, lexicographic = chronological).
  const memoIds = [...memoChildren.keys()].sort()
  for (const memoId of memoIds) {
    const childIds = memoChildren.get(memoId) ?? []
    // Centroid Y of children
    const childYs: number[] = []
    for (const cid of childIds) {
      const child = byId.get(cid)
      if (child) childYs.push(child.y + child.height / 2)
    }
    const centroidY = childYs.length
      ? childYs.reduce((a, b) => a + b, 0) / childYs.length
      : ROW_Y_START
    const node: PortraitNode = {
      kind: 'MEMO',
      id: `MEMO-${memoId}`,
      x: COL_X_CENTER,
      y: centroidY - NODE_H_MEMO / 2,
      width: NODE_W_MEMO,
      height: NODE_H_MEMO,
      text: memoLabel(memoId, childIds.length),
      url: memoUrl(memoId),
    }
    nodes.push(node)
    byId.set(node.id, node)
    for (const cid of childIds) {
      edges.push({ fromId: node.id, toId: cid })
    }
  }

  return { nodes, edges, byId }
}
