// The workspace map (agent.md §4.3 point 2): one compact block the model gets every turn, kept byte-identical while
// the snapshot is the same (prompt caching). Canvases → pieces (kind as the person sees it, name, what it holds) →
// each plane's sections and headings in reading order → one line per card. Decks say their columns and counts; small
// ones list their tasks. When it would pass its budget (≤ 15k tokens, estimated), it says less, level by level: first
// the notes' words and task lines go, then big planes are summed up (counts by type and status, the first few titles,
// "use view/query for the rest"), then every plane.
import { kindOf } from '../../model/labels'
import { kindOfPiece } from '../../model/pieces'
import type { Card } from '../../model/cards'
import { derive, type Derived, type P, clean } from './derive'
import type { Ids } from './ids'
import { cardLine, deckCounts, pieceLine, taskLine, textLine } from './lines'
import { canvasNodes, planeNodes, flatten, type Node } from './space'
import { count, estimateTokens, MAP_BUDGET, q, wrap } from './text'
import type { ReadWs } from './types'

type Level = { n: number; notes: boolean; tasks: boolean; tags: boolean; bigPlane: number; firsts: number }
const LEVELS: Level[] = [
  { n: 0, notes: true, tasks: true, tags: true, bigPlane: Infinity, firsts: 0 },
  { n: 1, notes: false, tasks: false, tags: true, bigPlane: Infinity, firsts: 0 },
  { n: 2, notes: false, tasks: false, tags: false, bigPlane: 60, firsts: 30 },
  { n: 3, notes: false, tasks: false, tags: false, bigPlane: 60, firsts: 20 },
  { n: 4, notes: false, tasks: false, tags: false, bigPlane: 60, firsts: 12 },
  { n: 5, notes: false, tasks: false, tags: false, bigPlane: 40, firsts: 6 },
  { n: 6, notes: false, tasks: false, tags: false, bigPlane: 20, firsts: 3 },
  { n: 7, notes: false, tasks: false, tags: false, bigPlane: 0, firsts: 0 },
]

export const SYMBOL_LEGEND =
  'Reading a line: +a −b evidence for/against · ! status and evidence disagree · ☐ d/a tasks done/all · ⧉ on more than one plane (or canvas) · 7/5 count/limit · ✓ finished column · for cN tagged for that customer · part of cN its parent · solves cN, ←solves cN links from it / to it · #tag'

export const ID_LEGEND =
  'Ids (stable in this chat; a title works too): c card · p piece · x text · t task · d document · k canvas · u person · e link · v evidence · f competitor feature · m comment thread'

export function workspaceMap(ws: ReadWs, ids: Ids, o: { budget?: number } = {}): string {
  ws = clean(ws)
  ids.sync(ws)
  const budget = o.budget ?? MAP_BUDGET
  let text = ''
  for (const level of LEVELS) {
    text = render(ws, ids, level)
    if (estimateTokens(text) <= budget) break
  }
  return text
}

const TYPE_ORDER = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package']

function render(ws: ReadWs, ids: Ids, L: Level): string {
  const d = derive(ws)
  const out: string[] = []
  const head: string[] = ['# Workspace map', ID_LEGEND, SYMBOL_LEGEND]
  const roles = ws.workspace?.roles ?? {}
  const people = [...new Set([...(ws.workspace?.memberIds ?? []), ...(ws.members ?? []).map((m) => m.uid)])]
  const tasksShown = ws.tasks.length
  out.push(`Today: ${d.today}`)
  out.push(`Project: ${q(ws.workspace?.name, 120)}${ws.workspace?.description ? ` — building ${q(ws.workspace.description, 300)}` : ''}`)
  if (people.length) out.push(`People: ${people.map((u) => `${ids.short('person', u)} ${d.names.get(u) ?? u}${roles[u] ? ` (${roles[u]})` : ''}`).join(' · ')}`)
  out.push(
    `Holds: ${[count(ws.canvases.length, 'canvas', 'canvases'), count(ws.pieces.length, 'piece'), count(ws.cards.length, 'card'), count(ws.edges.length, 'link'), count(tasksShown, 'task'), count(ws.labels.length, 'text'), count(ws.documents.length, 'document'), count(ws.threads.length, 'comment thread')].join(' · ')}`,
  )
  if (ws.threads.length) {
    const open = ws.threads.filter((t) => !t.resolved)
    const on = [...new Set([...open, ...ws.threads.filter((t) => t.resolved)].sort((a, b) => b.lastAt - a.lastAt).map((t) => (t.on === 'card' ? ids.short('card', t.targetId) : t.on === 'task' ? ids.short('task', t.targetId) : t.on === 'plane' ? ids.short('piece', t.targetId) : t.on === 'label' ? ids.short('text', t.targetId) : ids.short('link', t.targetId))))]
    out.push(`Comments: ${count(ws.threads.length, 'thread')} (${ws.threads.length - open.length} resolved) on ${on.slice(0, 12).join(', ')}${on.length > 12 ? '…' : ''} · query({kind: "comment"}) lists them`)
  }
  if (L.n > 0) out.push(`(Summed up to fit: level ${L.n}. Use view, query and search for the rest.)`)

  for (const canvas of ws.canvases) {
    out.push('', `## ${ids.short('canvas', canvas.id)} canvas ${q(canvas.name, 60)}`)
    const nodes = canvasNodes(ws, canvas.id)
    if (!nodes.length) out.push('(empty)')
    for (const { node, depth } of flatten(nodes)) out.push(...canvasNode(ws, ids, d, node, depth, canvas.id, L))
  }

  if (ws.documents.length) {
    out.push('', `## Documents (${ws.documents.length})`)
    const list = [...ws.documents].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
    const max = L.n >= 5 ? 15 : 40
    for (const x of list.slice(0, max))
      out.push(`${ids.short('document', x.id)} · ${x.kind} · ${q(x.title, 80)} · by ${x.name}${x.shared ? '' : ' · private'}${x.words ? ` · ${x.words} words` : ''}`)
    if (list.length > max) out.push(`… and ${list.length - max} more (view a documents piece or search)`)
  }
  return [...head, wrap('workspace', out.join('\n'))].join('\n')
}

const pad = (depth: number) => '  '.repeat(depth)

function canvasNode(ws: ReadWs, ids: Ids, d: Derived, n: Node, depth: number, canvas: string, L: Level): string[] {
  const at = pad(depth)
  if (n.kind === 'section') return [`${at}${textLine(ws, ids, n.label, 60)}`]
  if (n.kind === 'text') {
    const k = kindOf(n.label)
    if (!L.notes && (k === 'paragraph' || k === 'sticky')) return []
    return [`${at}${textLine(ws, ids, n.label, k === 'heading' || k === 'title' ? 120 : 60)}`]
  }
  if (n.kind !== 'piece') return []
  const p = n.piece
  // Shown here through a spot: listed in full on its own canvas.
  if ((p.canvasId || 'main') !== canvas) return [`${at}- ${ids.short('piece', p.id)} ${q(d.pieceName(p), 60)} (also shown here; its own canvas is ${ids.short('canvas', p.canvasId || 'main')})`]
  const lines = [`${at}- ${pieceLine(ws, ids, p)}${p.canvases && p.canvases.length > 1 ? ` · ⧉ also on ${p.canvases.slice(1).map((c) => ids.short('canvas', c)).join(', ')}` : ''}`]
  const kind = kindOfPiece(p)
  if (kind === 'plane') lines.push(...planeBlock(ws, ids, d, p, depth + 1, L))
  if (kind === 'kanban' && L.tasks && p.kanban?.holds !== 'cards') {
    const { tasks } = deckCounts(ws, p)
    if (tasks.length && tasks.length <= 6) {
      const cols = p.kanban?.cols ?? []
      for (const t of [...tasks].sort((a, b) => cols.findIndex((c) => c.id === a.col) - cols.findIndex((c) => c.id === b.col) || a.order - b.order))
        lines.push(`${pad(depth + 1)}${taskLine(ws, ids, t, { card: 'id' })} · ${cols.find((c) => c.id === t.col)?.name ?? t.col}`)
    }
  }
  return lines
}

function planeBlock(ws: ReadWs, ids: Ids, d: Derived, p: P, depth: number, L: Level): string[] {
  const nodes = planeNodes(ws, p.id)
  const all = d.onPlane.get(p.id) ?? []
  const out: string[] = []
  if (all.length > L.bigPlane) {
    const at = pad(depth)
    const home = all.filter((c) => !c.on)
    const byType = TYPE_ORDER.map((t) => [t, home.filter((c) => c.type === t)] as const).filter(([, l]) => l.length)
    out.push(`${at}summed up: ${byType.map(([t, l]) => `${t} ${l.length}${statusCounts(l)}`).join(' · ')}${all.length > home.length ? ` · ${all.length - home.length} from other planes` : ''}`)
    const heads = flatten(nodes).filter(({ node }) => node.kind === 'section' || (node.kind === 'text' && kindOf(node.label) === 'heading'))
    if (heads.length)
      out.push(
        `${at}headings: ${heads
          .slice(0, 12)
          .map(({ node }) => {
            const l = (node as Extract<Node, { kind: 'section' | 'text' }>).label
            const inside = node.kind === 'section' ? flatten(node.children).filter((x) => x.node.kind === 'card').length : 0
            return `${ids.short('text', l.id)} ${q(l.text, 40)}${node.kind === 'section' ? ` (section, ${inside} cards)` : ''}`
          })
          .join(' · ')}${heads.length > 12 ? ` · +${heads.length - 12}` : ''}`,
      )
    if (L.firsts) for (const [t, l] of byType) out.push(`${at}${t}s: ${l.slice(0, L.firsts).map((c) => `${ids.short('card', c.id)} ${q(c.title, 50)}`).join(', ')}${l.length > L.firsts ? `, … +${l.length - L.firsts}` : ''}`)
    out.push(`${at}(every card: view ${ids.short('piece', p.id)} or query plane=${ids.short('piece', p.id)})`)
    return out
  }
  for (const { node, depth: dd } of flatten(nodes)) {
    const at = pad(depth + dd)
    if (node.kind === 'card') {
      const c = node.card
      if (c.on) out.push(`${at}${ids.short('card', c.id)} · ${c.type} · ${q(c.title, 50)} · ⧉ its home is ${ids.short('piece', c.pieceId)}`)
      else out.push(`${at}${cardLine(ws, ids, c, { except: p.id, tags: L.tags, planes: true })}`)
    } else if (node.kind === 'section') out.push(`${at}${textLine(ws, ids, node.label, 60)}`)
    else if (node.kind === 'text') {
      const k = kindOf(node.label)
      if (!L.notes && (k === 'paragraph' || k === 'sticky')) continue
      out.push(`${at}${textLine(ws, ids, node.label, k === 'heading' ? 100 : 60)}`)
    }
  }
  if (!L.notes) {
    const notes = ws.labels.filter((l) => l.pieceId === p.id && (kindOf(l) === 'paragraph' || kindOf(l) === 'sticky')).length
    if (notes) out.push(`${pad(depth)}(+ ${count(notes, 'note')}: paragraphs and stickies, in view ${ids.short('piece', p.id)})`)
  }
  return out
}

const STATUS_ORDER = ['hypothesis', 'testing', 'validated', 'invalidated', 'idea', 'planned', 'building', 'shipped']
function statusCounts(list: Card[]): string {
  const m = new Map<string, number>()
  for (const c of list) {
    const s = c.validation ?? (c.type === 'feature' ? c.status : undefined)
    if (s) m.set(s, (m.get(s) ?? 0) + 1)
  }
  const said = STATUS_ORDER.filter((s) => m.has(s)).map((s) => `${s} ${m.get(s)}`)
  return said.length ? ` (${said.join(', ')})` : ''
}
