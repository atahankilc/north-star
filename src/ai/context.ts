// The workspace as plain text for the assistant (D-073): every item with its tags, area, links and matrix cells,
// built fresh for each message so it always sees the live board. Each item carries a short ref so a proposal
// can point at it (D-074).
import type { WithId } from '../data/hooks'
import type { BoardNode, Feature, Label, NodeType } from '../data/model'
import type { ReportContent, ReportSummary } from '../data/model'
import { colors } from '../styles/tokens'
import { isTitle } from '../views/canvas/titleBlock'
import { holdsRect, isSection, rectOf, sectionsAt } from '../views/canvas/sections'
import type { WorkspaceCtx } from '../views/workspace/context'
import { reportFull } from './readTools'
import { cellLine, criteriaLine } from '../views/matrix/reading'
import { confidenceOf } from '../views/priorities/reading'

// Far beyond a real workspace; keeps a runaway one from becoming an expensive prompt.
const MAX_CHARS = 120_000
const MAX_TEXT = 400

const clip = (s: string | undefined, n = MAX_TEXT) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}
const tags = (t?: string[]) => (t?.length ? ` ${t.map((x) => `#${x}`).join(' ')}` : '')

// Board text colours by name, as edit_label and add_label take them (D-123).
const COLOR_NAME: Record<string, string> = Object.fromEntries(
  (['magenta', 'cyan', 'yellow', 'blue', 'green'] as const).map((n) => [colors[n].toLowerCase(), n]),
)

// A label names the area below it (D-050): a card belongs to the nearest label above it. Notes don't name areas (D-108).
// The named sections round a point (D-130) say it first, outermost to innermost.
function areaOf(labels: WithId<Label>[], x: number, y: number): string {
  const frames = sectionsAt(labels, x, y)
  const inSection = frames.length ? ` [section: ${frames.map((l) => clip(l.text, 60)).join(' › ')}]` : ''
  return inSection + textAreaOf(labels, x, y)
}

function textAreaOf(labels: WithId<Label>[], x: number, y: number): string {
  let best: WithId<Label> | undefined
  let bestD = Infinity
  for (const l of labels) {
    if (!l.text.trim() || l.size === 'note' || l.y < y || isSection(l)) continue
    const d = Math.hypot(l.x - x, l.y - y)
    if (d < bestD) {
      bestD = d
      best = l
    }
  }
  return best ? ` [area: ${clip(best.text, 60)}]` : ''
}

// The card closest to a point, within a few units (a note is usually right under or beside its card).
function nearestCard(ws: WorkspaceCtx, x: number, y: number): string | undefined {
  let best: string | undefined
  let bestD = 3
  for (const n of [...ws.customers, ...ws.problems, ...ws.ideas, ...ws.features, ...ws.competitors]) {
    if (n.x === undefined || n.y === undefined) continue
    const d = Math.hypot(n.x - x, n.y - y)
    if (d < bestD) {
      bestD = d
      best = n.id
    }
  }
  return best
}

// `selection`: everything selected on the board (D-108), when it's more than the one card.
type Where = { view: string; selectedId: string | null; selection?: string[] }

// `parent`: a competitor feature's competitor (D-122), so a matrix cell's "their version" can be checked.
export type ItemRef = { id: string; type: NodeType; name: string; parent?: string }

// The first 6 characters of the item's id (longer where two would clash): stable across messages, cheap in tokens.
function makeRefs(items: ItemRef[]): { byRef: Map<string, ItemRef>; refOf: Map<string, string> } {
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

// `reports`: the handles of the reports it lists (handle → report id), for get_report (D-099).
export type Brief = { text: string; refs: Map<string, ItemRef>; reports: Map<string, string> }

// The report on the report screen (D-099): saved (`id`) or the chat's copy not saved yet.
export type OpenReport = { id: string; report: ReportContent; saved: boolean }

// `reports`: the newest few you may see (D-090); the chat loads them while it's open (D-098).
// `open`: the report the user is reading, in full (D-099).
export function workspaceBrief(ws: WorkspaceCtx, where: Where, reports: WithId<ReportSummary>[] = [], open: OpenReport | null = null): Brief {
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
    all.push({ id: f.id, type: 'competitorFeature', name: names.get(f.id)!, parent: f.competitorId })
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
  // Evidence (D-137): each piece on a line of its own under its card, `+` supports, `−` contradicts.
  const evidenceLines = (id: string) =>
    ws.evidence
      .filter((e) => e.nodeId === id)
      .map((e) => `  ${e.stance === 'supports' ? '+' : '−'} ${e.kind}: ${clip(e.text, 200)}${[e.source, e.date].some(Boolean) ? ` (${[e.source, e.date].filter(Boolean).join(', ')})` : ''}`)
  const statusOf = (n: WithId<BoardNode>) => {
    const v = (n as { validation?: string }).validation
    return v ? ` {${v}}` : ''
  }

  const about = clip(ws.workspace.description, 1000)
  const lines: string[] = [
    `WORKSPACE "${ws.workspace.name}" (each item starts with its [ref])`,
    `WHAT WE'RE BUILDING: ${about || '(not written yet; infer it from the items below)'}`,
    // The project block (D-118) shows these two on the board; update_project edits them (D-120).
    `PROJECT BLOCK ON THE BOARD: ${ws.labels.some(isTitle) ? 'yes, showing the name and WHAT WE\'RE BUILDING' : 'no (added from the board\'s + menu)'}`,
  ]

  const section = (title: string, items: WithId<BoardNode>[], extra: (n: WithId<BoardNode>) => string = () => '') => {
    lines.push('', `${title} (${items.length})`)
    for (const n of items) {
      const body = clip(n.body)
      lines.push(`- ${r(n.id)}${n.title || 'Untitled'}${extra(n)}${tags(n.tags)}${forText(n.id)}${areaOf(ws.labels, n.x, n.y)}${body ? `: ${body}` : ''}`)
      lines.push(...filesLine(n.id), ...evidenceLines(n.id))
    }
  }
  // {status} on customers, problems and ideas (D-137): hypothesis | testing | validated | invalidated.
  section('CUSTOMERS', ws.customers, statusOf)
  section('PROBLEMS', ws.problems, statusOf)
  section('IDEAS', ws.ideas, (n) => {
    const s = (n as { status?: string }).status
    return `${s ? ` [${s}]` : ''}${statusOf(n)}`
  })
  section('FEATURES', ws.features, (n) => {
    const f = n as WithId<BoardNode> & { priority?: string; status?: string; effort?: string; impact?: string }
    // Impact (set) and confidence (from its chain's status, D-138).
    const meta = [f.priority, f.status, f.effort && `effort ${f.effort}`, f.impact && `impact ${f.impact}`, `confidence ${confidenceOf(f, ws).level}`]
      .filter(Boolean)
      .join(', ')
    const must = criteriaLine(f as Feature)
    return `${meta ? ` [${meta}]` : ''}${must ? `; ${must}` : ''}`
  })

  // Packages (D-141): a piece of the chain as one card; listed with what they hold (the assistant edits them in step 3).
  if (ws.packages.length) {
    const title = new Map([...ws.customers, ...ws.problems, ...ws.ideas, ...ws.features].map((n) => [n.id, n.title || 'Untitled']))
    for (const c of ws.competitors) title.set(c.id, c.name || 'Untitled')
    lines.push('', `PACKAGES (${ws.packages.length})`)
    for (const k of ws.packages) {
      const held = k.memberIds.flatMap((id) => (title.has(id) ? [title.get(id)!] : []))
      const rating = [k.impact && `impact ${k.impact}`, k.effort && `effort ${k.effort}`].filter(Boolean).join(', ')
      lines.push(`- ${k.title || 'Untitled'}${rating ? ` [${rating}]` : ''}: holds ${held.join(', ') || 'nothing'}`)
    }
  }

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

  const cells = ws.comparisons.filter((c) => (c.coverage || c.notes || c.competitorFeatureId || c.criteria || c.notRelevant) && names.has(c.featureId) && names.has(c.competitorId))
  // Scored cells read from the feature's criteria (D-133), numbered as in FEATURES.
  lines.push('', `MATRIX: our feature × competitor (${cells.length} filled cells; coverage none | partial | full | better; criteria met | part | no; documented | inferred | guess)`)
  for (const c of cells) {
    const f = ws.features.find((x) => x.id === c.featureId)
    const theirs = c.competitorFeatureId && names.get(c.competitorFeatureId)
    lines.push(`- ${names.get(c.featureId)} × ${names.get(c.competitorId)}: ${cellLine(c, f)}${theirs ? `; their version [${refOf.get(c.competitorFeatureId!)}]` : ''}${c.notes ? `; ${clip(c.notes, 200)}` : ''}`)
  }

  // With its size, style and colour when not the defaults (D-123, D-130), so edit_label / edit_section can change them.
  const look = (l: Label) => {
    const bits = [
      l.size === 'subheading' ? 'subheading (H2)' : l.size === 'minor' ? 'minor (H3)' : '',
      l.bold ? 'bold' : '',
      l.italic ? 'italic' : '',
      l.caps ? 'caps' : '',
      l.color ? (COLOR_NAME[l.color.toLowerCase()] ?? 'coloured') : '',
    ].filter(Boolean)
    return bits.length ? ` (${bits.join(', ')})` : ''
  }
  // Sections (D-130): frames the team drew round parts of the board, nested; a card's [section: …] says which it's in.
  const frames = ws.labels.filter((l) => isSection(l) && l.text.trim())
  if (frames.length) {
    const path = (l: Label) => [...sectionsAt(ws.labels, l.x, l.y).filter((o) => o !== l && holdsRect(rectOf(o), rectOf(l))), l].map((o) => clip(o.text, 60)).join(' › ') + look(l)
    lines.push('', `SECTIONS ON THE BOARD (named frames round areas, outer › inner; arrange_area with a section's exact name moves and refits it, edit_section renames, delete_section removes it; the label rows don't touch them): ${frames.map(path).join(' | ')}`)
  }
  const areas = ws.labels.filter((l) => l.text.trim() && l.size !== 'note' && !isSection(l))

  if (areas.length) lines.push('', `AREAS ON THE BOARD: ${areas.map((l) => `${clip(l.text, 60)}${look(l)}`).join(' | ')}`)
  // Small notes written on the board (D-108), with the card each sits closest to.
  const notes = ws.labels.filter((l) => l.text.trim() && l.size === 'note' && !isSection(l))
  if (notes.length) {
    lines.push('', `NOTES ON THE BOARD (${notes.length})`)
    for (const l of notes) {
      const near = nearestCard(ws, l.x, l.y)
      lines.push(`- "${clip(l.text, 200)}"${look(l)}${near ? ` by [${refOf.get(near)}] ${names.get(near)}` : ''}${areaOf(ws.labels, l.x, l.y)}`)
    }
  }

  // Saved research (D-090): what was found before, so it isn't researched again. The user's own and the shared ones.
  // Each has a handle for get_report (D-099); the open one gets one too, even if it's older than the rest.
  const handles = new Map<string, string>()
  const handleOf = (id: string) => {
    let n = 6
    while (n < id.length && [...handles.values()].some((o) => o !== id && o.slice(0, n) === id.slice(0, n))) n++
    handles.set(id.slice(0, n), id)
    return id.slice(0, n)
  }
  if (reports.length) {
    lines.push('', `REPORTS (the newest ${reports.length}; read one in full with its [report:…] handle)`)
    for (const r of reports) {
      lines.push(`- [report:${handleOf(r.id)}] "${clip(r.title, 120)}" (${new Date(r.createdAt).toISOString().slice(0, 10)}, ${r.shared ? 'shared' : 'private'}): ${clip(r.answer, 300)}`)
    }
  }
  if (open) {
    const handle = open.saved ? ([...handles].find(([, id]) => id === open.id)?.[0] ?? handleOf(open.id)) : null
    lines.push(
      '',
      `OPEN REPORT${handle ? ` [report:${handle}]` : ' (written in this chat, not saved yet)'}: the user has it open on the report screen now; "this report", "the report" and "it" probably mean it.`,
      reportFull(open.report, (id) => refOf.get(id)),
      'END OF OPEN REPORT',
    )
  }

  lines.push('', `THE USER is in the ${where.view} view.`)
  const sel = where.selectedId && names.get(where.selectedId)
  const many = (where.selection ?? []).filter((id) => names.has(id))
  if (many.length > 1) lines.push(`They have ${many.length} items selected: ${many.map((id) => `"${names.get(id)}" [${refOf.get(id)}]`).join(', ')}; "these" or "this" probably means them.`)
  else if (sel) lines.push(`They have "${sel}" [${refOf.get(where.selectedId!)}] selected; "this" probably means it.`)

  const text = lines.join('\n')
  return { text: text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n… (workspace cut short here)` : text, refs: byRef, reports: handles }
}
