// The workspace as plain text for the assistant (D-073): every item with its tags, area, links and matrix cells,
// built fresh for each message so it always sees the live board.
import type { WithId } from '../data/hooks'
import type { BoardNode, Label } from '../data/model'
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

export function workspaceBrief(ws: WorkspaceCtx, where: Where): string {
  const names = new Map<string, string>()
  for (const list of [ws.customers, ws.problems, ws.ideas, ws.features]) for (const n of list) names.set(n.id, n.title || 'Untitled')
  for (const c of ws.competitors) names.set(c.id, c.name || 'Untitled')
  for (const f of ws.competitorFeatures) names.set(f.id, `${names.get(f.competitorId) ?? '?'}: ${f.name || 'Untitled'}`)

  const forOf = new Map<string, string[]>()
  for (const e of ws.edges) {
    if (e.kind !== 'for') continue
    const c = names.get(e.toId)
    if (c) forOf.set(e.fromId, [...(forOf.get(e.fromId) ?? []), c])
  }
  const forText = (id: string) => (forOf.has(id) ? ` (for: ${forOf.get(id)!.join(', ')})` : '')

  const lines: string[] = [`WORKSPACE "${ws.workspace.name}"`]
  if (ws.workspace.description) lines.push(clip(ws.workspace.description))

  const section = (title: string, items: WithId<BoardNode>[], extra: (n: WithId<BoardNode>) => string = () => '') => {
    lines.push('', `${title} (${items.length})`)
    for (const n of items) {
      const body = clip(n.body)
      lines.push(`- ${n.title || 'Untitled'}${extra(n)}${tags(n.tags)}${forText(n.id)}${areaOf(ws.labels, n.x, n.y)}${body ? `: ${body}` : ''}`)
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
    lines.push(`- ${c.name || 'Untitled'}${tags(c.tags)}${forText(c.id)}${area}${facts.length ? ` (${facts.join('; ')})` : ''}`)
    if (c.description) lines.push(`  about: ${clip(c.description)}`)
    if (c.notes) lines.push(`  notes: ${clip(c.notes)}`)
    const feats = ws.competitorFeatures.filter((f) => f.competitorId === c.id)
    for (const f of feats) lines.push(`  · ${f.category ? `${f.category} / ` : ''}${f.name || 'Untitled'}${f.description ? `: ${clip(f.description, 160)}` : ''}`)
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

  lines.push('', `THE USER is in the ${where.view} view.`)
  const sel = where.selectedId && names.get(where.selectedId)
  if (sel) lines.push(`They have "${sel}" selected; "this" probably means it.`)

  const text = lines.join('\n')
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n… (workspace cut short here)` : text
}
