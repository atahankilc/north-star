// One line per thing, the same everywhere the read layer lists them (map, view, query, search, get):
//   c12 · problem · "Founders can't price" · testing +2 −1 · #pricing · for c3 · ⧉ also on p4 "Rivals"
import type { Card } from '../../model/cards'
import { FOR } from '../../model/edges'
import { kindOf, type Label } from '../../model/labels'
import { kindOfPiece, KIND_NAME } from '../../model/pieces'
import type { Task, KanbanSetup } from '../../data/tasks'
import type { MatrixSetup } from '../../model/matrix'
import { entriesOf, nounOf } from '../../model/matrix'
import type { TableSetup } from '../../model/table'
import { colName } from '../../model/table'
import { tableRows } from '../../model/lens'
import { heldCards } from '../../model/kanbanCards'
import { derive, nameOf, shownTasks, timelineDecks, type Derived, type P } from './derive'
import type { Ids } from './ids'
import { count, q, oneLine } from './text'
import type { ReadWs } from './types'

// Link kinds in the chain's order, then the rest; to it after from it.
const LINK_ORDER = ['solves', 'competes-with', 'inspired-by', 'part-of', 'depends-on', 'contradicts', 'relates', 'for']
const linkRank = (k: string) => (k.startsWith('←') ? 100 : 0) + (LINK_ORDER.indexOf(k.replace('←', '')) + 1 || 50)

export type CardLineOpts = { links?: boolean; tags?: boolean; planes?: boolean; except?: string; max?: number }

// What a card says after its type: status and evidence, a competitor's regions, a feature's plan, a package's contents.
export function cardHead(c: Card, d: Derived): string[] {
  const f = d.facts.get(c.id)
  const out: string[] = []
  if (c.validation) {
    const p = f?.proof
    out.push(`${c.validation}${p ? ` +${p.supports} −${p.contradicts}` : ''}${f?.clash ? ' !' : ''}`)
  }
  if (c.type === 'competitor' && c.regions?.length) out.push(c.regions.join(', '))
  if (c.type === 'feature') {
    for (const x of [c.priority, c.status, c.impact && `impact ${c.impact}`, c.effort && `effort ${c.effort}`]) if (x) out.push(x)
  }
  if (c.type === 'package') {
    for (const x of [c.impact && `impact ${c.impact}`, c.effort && `effort ${c.effort}`]) if (x) out.push(x)
    out.push(`holds ${f?.meta ?? 'nothing'}`)
  }
  if (c.type === 'competitor') {
    const n = d.featuresOf.get(c.id)?.length ?? 0
    if (n) out.push(count(n, 'feature'))
  }
  return out
}

export function cardLine(ws: ReadWs, ids: Ids, c: Card, o: CardLineOpts = {}): string {
  const d = derive(ws)
  const parts = [ids.short('card', c.id), c.type, q(c.title, o.max ?? 80), ...cardHead(c, d)]
  if (o.tags !== false && c.tags?.length) parts.push(c.tags.map((t) => `#${t}`).join(' '))
  if (o.links !== false) {
    const links = d.linksOf.get(c.id) ?? []
    const fors = links.filter((e) => e.kind === FOR && e.fromId === c.id && d.cards.has(e.toId)).map((e) => ids.short('card', e.toId))
    if (fors.length) parts.push(`for ${fors.join(' ')}`)
    const parent = d.folds.parentOf.get(c.id)
    if (parent) parts.push(`part of ${ids.short('card', parent)}`)
    // The other links by kind: `solves c4 c7` from it, `←solves c2` to it; past six, counts by kind.
    const other = links.filter((e) => d.cards.has(e.fromId) && d.cards.has(e.toId) && !(e.kind === FOR && e.fromId === c.id) && !(e.kind === 'part-of' && e.fromId === c.id && e.toId === parent))
    const byKind = new Map<string, string[]>()
    for (const e of other) {
      const key = e.fromId === c.id ? e.kind : `←${e.kind}`
      byKind.set(key, [...(byKind.get(key) ?? []), ids.short('card', e.fromId === c.id ? e.toId : e.fromId)])
    }
    const kinds = [...byKind].sort((a, b) => linkRank(a[0]) - linkRank(b[0]) || (a[0] < b[0] ? -1 : 1))
    if (other.length > 6) parts.push(`links: ${kinds.map(([k, l]) => `${k} ${l.length}`).join(', ')}`)
    else for (const [k, l] of kinds) parts.push(`${k} ${l.join(' ')}`)
  }
  const t = d.facts.get(c.id)?.tasks
  if (t) parts.push(`☐ ${t.done}/${t.all}`)
  if (o.planes !== false) {
    const planes = (d.planesOf.get(c.id) ?? []).filter((p) => p !== o.except)
    if (planes.length && (planes.length > 1 || o.except !== undefined || planes[0] !== c.pieceId))
      parts.push(`⧉ ${o.except !== undefined ? 'also on' : 'on'} ${planes.map((p) => `${ids.short('piece', p)} ${q(d.nameById(p), 30)}`).join(', ')}`)
  }
  return parts.join(' · ')
}

// A task: `t4 "Write the pitch" · → u2 Bob · due 2026-11-10 (overdue) · for c3 "Anna" · P2 · ☐ 1/2 · #pitch`.
// `card`: the card it's for with its title (default), only its id, or left out (listed under that card).
export function taskLine(ws: ReadWs, ids: Ids, t: Task, o: { where?: boolean; card?: 'title' | 'id' | 'none'; days?: boolean } = {}): string {
  const d = derive(ws)
  const finished = !!d.doneCols.get(t.pieceId)?.has(t.col)
  const parts = [ids.short('task', t.id), q(t.title)]
  if (o.where) {
    const deck = d.pieces.get(t.pieceId)
    const col = deck?.kanban?.cols.find((c) => c.id === t.col)
    parts.push(`in ${deck ? `${ids.short('piece', deck.id)} ${q(d.pieceName(deck), 30)}` : '?'} · ${col?.name ?? t.col}${finished ? ' ✓' : ''}`)
  }
  if (t.assignee) parts.push(`→ ${ids.short('person', t.assignee)} ${t.assigneeName ?? nameOf(d, t.assignee)}`)
  if ((t.start || t.due) && o.days !== false) {
    const late = !!t.due && !finished && t.due < d.today
    parts.push([t.start && `from ${t.start}`, t.due && `due ${t.due}${late ? ' (overdue)' : ''}`].filter(Boolean).join(' '))
  }
  if (t.cardId && o.card !== 'none') {
    const c = d.cards.get(t.cardId)
    parts.push(c ? `for ${ids.short('card', c.id)}${o.card !== 'id' ? ` ${q(c.title, 40)}` : ''}` : 'for a card that is gone')
  }
  if (t.priority) parts.push(t.priority)
  if (t.checks?.length) parts.push(`☐ ${t.checks.filter((x) => x.done).length}/${t.checks.length}`)
  if (t.labels?.length) parts.push(t.labels.map((l) => `#${l}`).join(' '))
  return parts.join(' · ')
}

// Text: `x3 heading "Who we beat" (02)`, `x7 sticky "Ask Anna…" by Alice`.
export function textLine(ws: ReadWs, ids: Ids, l: Label, max = 80): string {
  const k = kindOf(l)
  const d = derive(ws)
  const text = k === 'title' ? [ws.workspace?.name, ws.workspace?.description].filter(Boolean).join(' — ') : l.text
  const level = k === 'heading' ? ({ heading: 'H1', subheading: 'H2', minor: 'H3' } as Record<string, string>)[l.size ?? 'heading'] : ''
  const parts = [ids.short('text', l.id), k === 'heading' ? `heading ${level}` : k === 'title' ? 'project title' : k, q(text, max)]
  if (l.kicker) parts.push(`(${oneLine(l.kicker, 20)})`)
  if (k === 'sticky' && (l.author || l.uid)) parts.push(`by ${l.author ?? nameOf(d, l.uid)}`)
  return parts.join(' ')
}

// A deck's columns with how many each holds: `todo 3 · doing 1 · done ✓ 2`.
export function deckCounts(ws: ReadWs, deck: P): { line: string; tasks: Task[] } {
  const d = derive(ws)
  const k = deck.kanban as KanbanSetup | undefined
  const tasks = shownTasks(ws, d, deck)
  const cols = k?.cols ?? []
  const line = cols
    .map((c) => {
      const n = tasks.filter((t) => t.col === c.id).length
      return `${c.name}${c.done ? ' ✓' : ''} ${n}${c.limit ? `/${c.limit}` : ''}`
    })
    .join(' · ')
  return { line, tasks }
}

// A piece's name in quotes; a nameless one (a document piece: its document's title) says so.
export const pieceTitle = (d: Derived, p: P) => (p.name || p.kind === 'document' ? q(d.pieceName(p), 60) : '(unnamed)')

// A piece in words, one line: kind, name, what it holds.
export function pieceLine(ws: ReadWs, ids: Ids, p: P): string {
  const d = derive(ws)
  const kind = kindOfPiece(p)
  const head = `${ids.short('piece', p.id)} ${KIND_NAME[kind]} ${pieceTitle(d, p)}`
  const stuck = p.stuckTo && d.pieces.get(p.stuckTo) ? ` · stuck to ${ids.short('piece', p.stuckTo)}` : ''
  return head + stuck + ' · ' + pieceSays(ws, ids, p)
}

const axisWords = (ids: Ids, d: Derived, a: MatrixSetup['rows']) => {
  const typed = a.items.filter((i) => !i.cardId).length
  const picked = a.items.filter((i) => i.cardId).length
  const parts: string[] = []
  if (a.type) parts.push(`every ${a.type}${a.plane && d.pieces.get(a.plane) ? ` on ${ids.short('piece', a.plane)}` : ''}${a.hide?.length ? ` (${a.hide.length} taken out)` : ''}`)
  if (picked) parts.push(count(picked, 'card'))
  if (typed) parts.push(count(typed, 'typed name'))
  return `${nounOf(a)}: ${parts.join(' + ') || 'nothing yet'}${a.unfold ? ', criteria unfolded' : ''}`
}

// A rule as words: `type is feature`, `plane is not p2`.
export function ruleWords(ids: Ids, d: Derived, r: { field: string; not?: boolean; values: string[] }) {
  const vals = r.field === 'plane' ? r.values.map((v) => (d.pieces.get(v) ? ids.short('piece', v) : v)) : r.field === 'tag' ? r.values.map((v) => `#${v}`) : r.values
  return `${r.field} ${r.not ? 'is not' : r.field === 'title' ? 'has' : 'is'} ${vals.join(' or ')}`
}

// What a piece holds, in a few words.
export function pieceSays(ws: ReadWs, ids: Ids, p: P): string {
  const d = derive(ws)
  switch (kindOfPiece(p)) {
    case 'plane': {
      const cards = d.onPlane.get(p.id) ?? []
      const byType = new Map<string, number>()
      for (const c of cards) byType.set(c.type, (byType.get(c.type) ?? 0) + 1)
      const texts = ws.labels.filter((l) => l.pieceId === p.id).length
      return `${count(cards.length, 'card')}${byType.size ? ` (${[...byType].map(([t, n]) => `${n} ${t}`).join(', ')})` : ''}${texts ? ` · ${count(texts, 'text')}` : ''}`
    }
    case 'matrix': {
      const m = p.matrix as MatrixSetup | undefined
      if (!m) return 'not set up'
      const rows = entriesOf(m.rows, ws.cards).length
      const cols = entriesOf(m.cols, ws.cards).length
      const filled = ws.cells.filter((c) => c.matrixId === p.id && c.value !== undefined).length
      const cell = m.cell === 'scale' ? `scale ${m.steps.map((s) => s.label).join('/')}` : m.cell === 'number' ? `numbers${m.unit ? ` (${m.unit})` : ''}` : 'text'
      return `${rows} rows (${axisWords(ids, d, m.rows)}) × ${cols} columns (${axisWords(ids, d, m.cols)}) · cells: ${cell} · ${filled} filled`
    }
    case 'table': {
      const t = p.table as TableSetup | undefined
      if (!t) return 'not set up'
      const rows = tableRows(t, ws.cards).length
      const rules = t.manual ? 'rows typed by hand' : t.rows.rules.length ? `rows where ${t.rows.rules.map((r) => ruleWords(ids, d, r)).join(' and ')}` : 'every card'
      return `${count(rows, 'row')} (${rules}${t.rows.items.length ? ` + ${t.rows.items.length} added` : ''}) · columns: name, ${t.cols.map((c) => colName(c) + (c.unit ? ` (${c.unit})` : '')).join(', ')}`
    }
    case 'kanban': {
      const k = p.kanban as KanbanSetup | undefined
      if (k?.holds === 'cards') {
        const cards = heldCards(p, ws.cards)
        return `holds cards: ${count(cards.length, 'card')} by ${k.colField ?? 'status'}${k.rowField ? ` × ${k.rowField}` : ''}${k.source?.rules.length ? ` (${k.source.rules.map((r) => ruleWords(ids, d, r)).join(' and ')})` : ''}`
      }
      const { line, tasks } = deckCounts(ws, p)
      const late = tasks.filter((t) => t.due && t.due < d.today && !d.doneCols.get(p.id)?.has(t.col)).length
      return `${count(tasks.length, 'task')}: ${line}${late ? ` · ${late} overdue` : ''}`
    }
    case 'timeline': {
      const decks = timelineDecks(ws, p)
      const n = decks.reduce((s, k) => s + shownTasks(ws, d, k).filter((t) => t.due || t.start).length, 0)
      const of = p.stuckTo && d.pieces.get(p.stuckTo) ? `days of ${ids.short('piece', p.stuckTo)}` : 'days of every deck on its canvas'
      return `${of}${decks.length && p.stuckTo && d.pieces.get(p.stuckTo)?.kind === 'plane' ? ` (${decks.map((k) => ids.short('piece', k.id)).join(', ')})` : ''} · ${count(n, 'task')} with days · rows by ${p.timeline?.rows ?? 'kanban'}`
    }
    case 'documents': {
      const kinds = p.documents?.kinds
      const n = ws.documents.filter((x) => !kinds?.length || kinds.includes(x.kind)).length
      return `${count(n, 'document')}${kinds?.length ? ` (${kinds.join(', ')})` : ''}`
    }
    case 'document': {
      const doc = p.docId ? d.docs.get(p.docId) : undefined
      return doc ? `shows ${ids.short('document', doc.id)} (${doc.kind}${doc.words ? `, ${doc.words} words` : ''})` : 'its document is not here (private or gone)'
    }
  }
}
