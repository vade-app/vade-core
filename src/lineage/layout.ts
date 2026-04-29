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

export type Topic =
  | 'memory'      // Mem0, memo-protocol, memo-pointer, episodic
  | 'identity'    // CB-*, OG-*, subject-of-project, mind-kind, society
  | 'substrate'   // cloud, bootstrap, hooks, integrity-check, OS-image
  | 'governance'  // committee, quorum, tier, attribution, briefing
  | 'tooling'     // skills, slash commands, MCP, agents, taxonomy
  | 'operations'  // catch-all

export interface LayoutNode {
  memo: MemoEntry
  x: number
  y: number
  width: number
  height: number
  isCB: boolean
  isFrontier: boolean
  topic: Topic
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

// Keyword-based topic classifier. Order matters — earlier rules win.
// Driven by case-insensitive substring match against memo title.
// Governance comes before memory so "Memo protocol …" hits governance
// (more specific) rather than the bare "memo" memory rule.
function classifyTopic(title: string): Topic {
  const t = title.toLowerCase()
  if (/(\bcb-|\bog-|subject|mind-kind|society of selves|symbiosis|^identity|patterns?-discourse|are we stressed)/.test(t)) {
    return 'identity'
  }
  if (/(committee|quorum|attribution|briefing|\btier\b|memo protocol|memo citation|memo-claim|memo shape|f4|night's watch|weekly watch|pr-watch|publication|governance|publishable)/.test(t)) {
    return 'governance'
  }
  if (/(mem0|\bmemo\b|episodic|pointer|sop-mem)/.test(t)) {
    return 'memory'
  }
  if (/(cloud|bootstrap|hook|integrity|setup script|os image|sandbox|cli setup|workspace path|claude code identity|spend cap|cloud sandbox|cf-|cloudflare|secret)/.test(t)) {
    return 'substrate'
  }
  if (/(skill|mcp|slash|agent|taxonom|playwright|tools|tldraw|canvas|adoption|github)/.test(t)) {
    return 'tooling'
  }
  return 'operations'
}

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
      const isCB = CB_BEARING_IDS.has(m.id)
      // CB-bearing memos render as ellipses (see populate.ts) and need
      // ~25% more width than rectangles for the title to wrap inside
      // the ellipse's inscribed text region rather than under it.
      const node: LayoutNode = {
        memo: m,
        x: isCB ? x - 40 : x,
        y: lane * ROW_H,
        width: isCB ? NODE_W + 80 : NODE_W,
        height: NODE_H,
        isCB,
        isFrontier: m.superseded_by.length === 0,
        topic: classifyTopic(m.title),
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
