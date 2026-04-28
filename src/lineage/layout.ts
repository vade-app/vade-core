// Date-pinned timeline layout for the COO memo DAG. Not a generic graph
// layout: X is calendar date, Y is within-day lane. Crossings are
// expected and informative — they show the rate elevation 04-26→-28
// against the 04-12→-19 floor.

export interface MemoEntry {
  id: string
  date: string
  title: string
  status: string
  supersedes: string
  supersedes_refs: string[]
  superseded_by: string[]
  linked_issues: number[]
  summary_one_line: string
  file_path: string
}

export interface LayoutNode {
  memo: MemoEntry
  x: number
  y: number
  width: number
  height: number
  isCB: boolean
  isFrontier: boolean
}

export interface LayoutEdge {
  fromId: string
  toId: string
}

export interface Layout {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  byId: Map<string, LayoutNode>
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

export const NODE_W = 300
export const NODE_H = 60
const COL_W = 340
const ROW_H = 110
const ORIGIN_DATE = '2026-04-11'

const CB_BEARING_IDS = new Set([
  '2026-04-24-09', // CB-006 society of selves
  '2026-04-26-15', // CB-007 + CB-008 mind-kind, symbiosis
  '2026-04-27-03', // CB-009 pattern-discourse autonomy
])

function dayIndex(date: string): number {
  const a = Date.parse(`${date}T00:00:00Z`)
  const b = Date.parse(`${ORIGIN_DATE}T00:00:00Z`)
  return Math.round((a - b) / 86_400_000)
}

export function computeLayout(memos: MemoEntry[]): Layout {
  const byDate = new Map<string, MemoEntry[]>()
  for (const m of memos) {
    const list = byDate.get(m.date) ?? []
    list.push(m)
    byDate.set(m.date, list)
  }

  const nodes: LayoutNode[] = []
  const byId = new Map<string, LayoutNode>()

  for (const [date, list] of byDate) {
    list.sort((a, b) => a.id.localeCompare(b.id))
    const x = dayIndex(date) * COL_W
    list.forEach((m, lane) => {
      const node: LayoutNode = {
        memo: m,
        x,
        y: lane * ROW_H,
        width: NODE_W,
        height: NODE_H,
        isCB: CB_BEARING_IDS.has(m.id),
        isFrontier: m.superseded_by.length === 0,
      }
      nodes.push(node)
      byId.set(m.id, node)
    })
  }

  const edges: LayoutEdge[] = []
  for (const m of memos) {
    for (const parentId of m.supersedes_refs) {
      if (byId.has(m.id) && byId.has(parentId)) {
        edges.push({ fromId: m.id, toId: parentId })
      }
    }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.width)
    maxY = Math.max(maxY, n.y + n.height)
  }

  return { nodes, edges, byId, bounds: { minX, minY, maxX, maxY } }
}
