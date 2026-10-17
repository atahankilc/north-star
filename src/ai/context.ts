// The workspace as plain text for the assistant (D-073): every item with its tags, area, links and matrix cells,
// built fresh for each message so it always sees the live board. Each item carries a short ref so a proposal
// can point at it (D-074).
import type { WithId } from '../data/hooks'
import type { BoardNode, Label, NodeType } from '../data/model'
import type { WorkspaceCtx } from '../views/workspace/context'

// Far beyond a real workspace; keeps a runaway one from becoming an expensive prompt.
const MAX_CHARS = 120_000
const MAX_TEXT = 400

const clip = (s: string | undefined, n = MAX_TEXT) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}
const tags = (t?: string[]) => (t?.length ? ` ${t.map((x) => `#${x}`).join(' ')}` : '')

// A label names the area below it (D-050): a card belongs to the nearest label above it.
function areaOf(labels: WithId<Label>[], x: number, y: number): string {
  let best: WithId<Label> | undefined
  let bestD = Infinity
  for (const l of labels) {
    if (!l.text.trim() || l.y < y) continue
    const d = Math.hypot(l.x - x, l.y - y)
    if (d < bestD) {
      bestD = d
      best = l
    }
  }
  return best ? ` [area: ${clip(best.text, 60)}]` : ''
}

type Where = { view: string; selectedId: string | null }

export type ItemRef = { id: string; type: NodeType; name: string }

// The first 6 characters of the item's id (longer where two would clash): stable across messages, cheap in tokens.
function makeRefs(items: { id: string; type: NodeType; name: string }[]): { byRef: Map<string, ItemRef>; refOf: Map<string, string> } {
  const byRef = new Map<string, ItemRef>()
  const refOf = new Map<string, string>()
  for (const it of items) {
    let n = 6
    while (n < it.id.length && items.some((o) => o.id !== it.id && o.id.slice(0, n) === it.id.slice(0, n))) n++
    const ref = it.id.slice(0, n)
    byRef.set(ref, it)
    refOf.set(it.id, ref)
  }
  return { byRef, refOf }
}

export type Brief = { text: string; refs: Map<string, ItemRef> }

export function workspaceBrief(ws: WorkspaceCtx, where: Where): Brief {
  const names = new Map<string, string>()
  const all: ItemRef[] = []
  const boardLists = [['customer', ws.customers], ['problem', ws.problems], ['idea', ws.ideas], ['feature', ws.features]] as const
  for (const [type, list] of boardLists) {
    for (const n of list) {
      names.set(n.id, n.title || 'Untitled')
      all.push({ id: n.id, type, name: n.title || 'Untitled' })
    }
  }
  for (const c of ws.competitors) {
    names.set(c.id, c.name || 'Untitled')
    all.push({ id: c.id, type: 'competitor', name: c.name || 'Untitled' })
  }
  for (const f of ws.competitorFeatures) {
    names.set(f.id, `${names.get(f.competitorId) ?? '?'}: ${f.name || 'Untitled'}`)
    all.push({ id: f.id, type: 'competitorFeature', name: names.get(f.id)! })
  }
  const { byRef, refOf } = makeRefs(all)
  const r = (id: string) => `[${refOf.get(id)}] `

  const forOf = new Map<string, string[]>()
  for (const e of ws.edges) {
    if (e.kind !== 'for') continue
    const c = names.get(e.toId)
    if (c) forOf.set(e.fromId, [...(forOf.get(e.fromId) ?? []), c])
  }
  const forText = (id: string) => (forOf.has(id) ? ` (for: ${forOf.get(id)!.join(', ')})` : '')

  // Attachments (D-083): names only, never the files.
  const filesOf = new Map<string, string[]>()
  for (const a of ws.attachments) filesOf.set(a.nodeId, [...(filesOf.get(a.nodeId) ?? []), clip(a.name, 80)])
  const filesLine = (id: string) => (filesOf.has(id) ? [`  files: ${filesOf.get(id)!.join(', ')}`] : [])

  const about = clip(ws.workspace.description, 1000)
  const lines: string[] = [
    `WORKSPACE "${ws.workspace.name}" (each item starts with its [ref])`,
    `WHAT WE'RE BUILDING: ${about || '(not written yet; infer it from the items below)'}`,
  ]

  const section = (title: string, items: WithId<BoardNode>[], extra: (n: WithId<BoardNode>) => string = () => '') => {
    lines.push('', `${title} (${items.length})`)
    for (const n of items) {
      const body = clip(n.body)
      lines.push(`- ${r(n.id)}${n.title || 'Untitled'}${extra(n)}${tags(n.tags)}${forText(n.id)}${areaOf(ws.labels, n.x, n.y)}${body ? `: ${body}` : ''}`)
      lines.push(...filesLine(n.id))
    }
  }
  section('CUSTOMERS', ws.customers)
  section('PROBLEMS', ws.problems)
  section('IDEAS', ws.ideas, (n) => {
    const s = (n as { status?: string }).status
    return s ? ` [${s}]` : ''
  })
  section('FEATURES', ws.features, (n) => {
    const f = n as WithId<BoardNode> & { priority?: string; status?: string; effort?: string }
    const meta = [f.priority, f.status, f.effort && `effort ${f.effort}`].filter(Boolean).join(', ')
    return meta ? ` [${meta}]` : ''
  })

  lines.push('', `COMPETITORS (${ws.competitors.length})`)
  for (const c of ws.competitors) {
    const facts = [c.url, c.pricing && `pricing: ${clip(c.pricing, 120)}`, c.audience && `audience: ${clip(c.audience, 120)}`].filter(Boolean)
    const area = c.x !== undefined && c.y !== undefined ? areaOf(ws.labels, c.x, c.y) : ''
    lines.push(`- ${r(c.id)}${c.name || 'Untitled'}${tags(c.tags)}${forText(c.id)}${area}${facts.length ? ` (${facts.join('; ')})` : ''}`)
    if (c.description) lines.push(`  about: ${clip(c.description)}`)
    if (c.notes) lines.push(`  notes: ${clip(c.notes)}`)
    lines.push(...filesLine(c.id))
    const feats = ws.competitorFeatures.filter((f) => f.competitorId === c.id)
    for (const f of feats) lines.push(`  · ${r(f.id)}${f.category ? `${f.category} / ` : ''}${f.name || 'Untitled'}${f.description ? `: ${clip(f.description, 160)}` : ''}`)
  }

  const links = ws.edges.filter((e) => e.kind !== 'for' && names.has(e.fromId) && names.has(e.toId))
  lines.push('', `LINKS (${links.length})`)
  for (const e of links) lines.push(`- ${names.get(e.fromId)} —${e.kind}→ ${names.get(e.toId)}${e.label ? ` (${clip(e.label, 80)})` : ''}`)

  const cells = ws.comparisons.filter((c) => (c.coverage || c.notes) && names.has(c.featureId) && names.has(c.competitorId))
  lines.push('', `MATRIX: our feature × competitor (${cells.length} filled cells; coverage none | partial | full | better)`)
  for (const c of cells) {
    lines.push(`- ${names.get(c.featureId)} × ${names.get(c.competitorId)}: ${c.coverage ?? 'not assessed'}${c.notes ? `; ${clip(c.notes, 200)}` : ''}`)
  }

  const areas = ws.labels.filter((l) => l.text.trim())
  if (areas.length) lines.push('', `AREAS ON THE BOARD: ${areas.map((l) => clip(l.text, 60)).join(' | ')}`)

  // Saved research (D-090): what was found before, so it isn't researched again. The user's own and the shared ones.
  const reports = ws.reports.slice(0, 10)
  if (reports.length) {
    lines.push('', `RESEARCH REPORTS (${ws.reports.length}, newest first; the full text is on the reports tab)`)
    for (const r of reports) {
      lines.push(`- "${clip(r.title, 120)}" (${new Date(r.createdAt).toISOString().slice(0, 10)}, ${r.shared ? 'shared' : 'private'}): ${clip(r.answer, 300)}`)
    }
  }

  lines.push('', `THE USER is in the ${where.view} view.`)
  const sel = where.selectedId && names.get(where.selectedId)
  if (sel) lines.push(`They have "${sel}" [${refOf.get(where.selectedId!)}] selected; "this" probably means it.`)

  const text = lines.join('\n')
  return { text: text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n… (workspace cut short here)` : text, refs: byRef }
}
