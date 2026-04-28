// Parser for `coo/identity_layer.md` — the canonical list of active
// COO core_beliefs (CB-*) and overarching_goals (OG-*). The file
// follows a very regular structure: one `### CB-NNN — Title` (or
// `### OG-NNN — Title`) heading per entry, followed by an italic
// citation line of the form `*MEMO-YYYY-MM-DD-<suffix> · v1 · …*`,
// then prose. CB-005 is a deliberate GAP with no ratifying memo and
// no recoverable body. Trust the file shape — this is internal data,
// not a parser-fuzzing boundary.

export type IdentityKind = 'CB' | 'OG'

export interface IdentityEntry {
  id: string                       // 'CB-001' or 'OG-001'
  kind: IdentityKind
  title: string                    // human title without the leading 'CB-001 — '
  isGap: boolean                   // CB-005
  ratifyingMemoId: string | null   // memo_index id, e.g. '2026-04-21-02', without MEMO- prefix
  body: string                     // prose paragraph(s); used as hover/expand text
}

const HEADING_RE = /^### (CB|OG)-(\d{3}) — (.+?)\s*$/
const MEMO_RE = /MEMO-(\d{4}-\d{2}-\d{2}-[A-Za-z0-9]+)/

export function parseIdentityLayer(md: string): IdentityEntry[] {
  const entries: IdentityEntry[] = []
  const lines = md.split('\n')

  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const m = HEADING_RE.exec(line)
    if (!m) { i++; continue }

    const kindStr = m[1] ?? ''
    const num = m[2] ?? ''
    const titleRaw = m[3] ?? ''
    const id = `${kindStr}-${num}`
    const isGap = titleRaw.includes('[GAP]')

    // Walk ahead to find the citation line (first italic-only line).
    let j = i + 1
    let citation = ''
    while (j < lines.length) {
      const l = lines[j] ?? ''
      if (l.trim() === '') { j++; continue }
      if (l.startsWith('*') && l.trimEnd().endsWith('*')) {
        citation = l
        j++
      }
      break
    }

    const memoMatch = MEMO_RE.exec(citation)
    const ratifyingMemoId = memoMatch ? (memoMatch[1] ?? null) : null

    // Body: everything until the next heading or `---` separator.
    const bodyLines: string[] = []
    while (j < lines.length) {
      const l = lines[j] ?? ''
      if (l.startsWith('### ') || l.startsWith('---')) break
      bodyLines.push(l)
      j++
    }
    const body = bodyLines.join('\n').trim()

    entries.push({
      id,
      kind: kindStr as IdentityKind,
      title: titleRaw.trim(),
      isGap,
      ratifyingMemoId,
      body,
    })
    i = j
  }

  return entries
}
