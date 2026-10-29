// The read tools (agent.md §4.4): search, query, get, view, neighbours, read_document, whats_new, and where_am_i for the
// context's last part. Each is `(ws, ids, args) → { text, more? }`, pure over the snapshot; text stays under ~8k tokens
// (§7.2 point 4), paged, saying how to narrow. Workspace text is inside <workspace_content> wrappers.
import { FOR } from '../../model/edges'
import { isOnPlane, type Card } from '../../model/cards'
import { kindOf } from '../../model/labels'
import { kindOfPiece, KIND_NAME } from '../../model/pieces'
import { canvasOf } from '../../model/canvases'
import { inRegions } from '../../model/regions'
import { statusOf } from '../../model/source'
import { confidenceFor } from '../../model/cardFacts'
import { entriesOf, nounOf, type MatrixSetup } from '../../model/matrix'
import { tableRows } from '../../model/lens'
import { colName, type TableSetup } from '../../model/table'
import { packageTree, byCategory } from '../../model/cardInside'
import { sectionHolds, cardBoxes, piecesShown } from '../../model/textPlace'
import { matchesIn, snippet, pageText } from '../../model/findIndex'
import type { Task, KanbanSetup } from '../../data/tasks'
import type { View } from '../ui'
import { derive, nameOf, shownTasks, type Derived, type P, clean } from './derive'
import { resolve, resolvePerson, unclear, type IdKind, type Ids } from './ids'
import { cardLine, pieceLine, pieceSays, ruleWords, taskLine, textLine } from './lines'
import { finish, readDocument, view, type ReadDocArgs, type ViewArgs } from './view'
import { count, dayOf, oneLine, pageLine, pageOf, q, timeOf, wrap } from './text'
import type { ReadWs, ToolResult } from './types'

export { view, readDocument }

// ---- search

export const SEARCH_KINDS = ['card', 'customer', 'problem', 'competitor', 'idea', 'feature', 'package', 'text', 'task', 'cell', 'evidence', 'competitor_feature', 'document', 'comment', 'piece'] as const
export type SearchArgs = { query: string; kinds?: string[]; scope?: string; page?: number; limit?: number }

type Entry = {
  kind: (typeof SEARCH_KINDS)[number]
  id: string
  // Where it is: a piece's id, or `canvas:<id>`, or `documents`.
  space: string
  // What a scope keeps it for: the planes, decks, lenses and canvases it's in.
  inside: string[]
  fields: { text: string; w: number }[]
  line: () => string
}

const indexes = new WeakMap<object, { ids: Ids; list: Entry[] }>()

function index(ws: ReadWs, ids: Ids): Entry[] {
  const was = indexes.get(ws)
  if (was && was.ids === ids) return was.list
  const d = derive(ws)
  const out: Entry[] = []
  const canvasOfPiece = (id: string) => {
    const p = d.pieces.get(id)
    return p ? (p.canvases ?? [canvasOf(p)]).map((c) => `canvas:${c}`) : []
  }
  const planesIn = (cardId: string) => (d.planesOf.get(cardId) ?? []).flatMap((p) => [p, ...canvasOfPiece(p)])
  for (const c of ws.cards) {
    const f = [
      { text: c.title, w: 3 },
      { text: (c.tags ?? []).join(' '), w: 2 },
      { text: [c.notes, c.description, c.audience, c.pricing, c.url].filter(Boolean).join('\n'), w: 1 },
      { text: [c.type, statusOf(c), ...(c.regions ?? []), c.priority, c.impact && `impact ${c.impact}`, c.effort && `effort ${c.effort}`].filter(Boolean).join(' '), w: 0.5 },
      { text: (c.criteria ?? []).map((x) => x.text).join('\n'), w: 1 },
    ]
    out.push({ kind: c.type, id: c.id, space: c.pieceId, inside: planesIn(c.id), fields: f, line: () => cardLine(ws, ids, c, { links: false }) })
  }
  for (const v of ws.evidence) {
    const c = d.cards.get(v.nodeId)
    out.push({
      kind: 'evidence',
      id: v.id,
      space: c?.pieceId ?? '',
      inside: c ? planesIn(c.id) : [],
      fields: [
        { text: v.text, w: 2 },
        { text: [v.source, v.kind, v.stance, v.url].filter(Boolean).join(' '), w: 1 },
      ],
      line: () => `${ids.short('evidence', v.id)} evidence ${v.stance === 'supports' ? '+' : '−'} ${v.kind} on ${c ? `${ids.short('card', c.id)} ${q(c.title, 40)}` : 'a card that is gone'}: ${q(v.text, 120)}${v.source ? ` · ${oneLine(v.source, 40)}` : ''}`,
    })
  }
  for (const f of ws.competitorFeatures) {
    const c = d.cards.get(f.competitorId)
    out.push({
      kind: 'competitor_feature',
      id: f.id,
      space: c?.pieceId ?? '',
      inside: c ? planesIn(c.id) : [],
      fields: [
        { text: f.name, w: 3 },
        { text: [f.description, f.category, f.availability].filter(Boolean).join(' '), w: 1 },
      ],
      line: () => `${ids.short('feature', f.id)} competitor feature ${q(f.name, 60)} of ${c ? `${ids.short('card', c.id)} ${q(c.title, 30)}` : '?'}${f.category ? ` · ${f.category}` : ''}${f.availability ? ` · ${f.availability}` : ''}`,
    })
  }
  for (const l of ws.labels) {
    const k = kindOf(l)
    const text = k === 'title' ? [ws.workspace?.name, ws.workspace?.description].filter(Boolean).join('\n') : l.text
    const space = l.pieceId === 'canvas' ? `canvas:${canvasOf(l)}` : l.pieceId
    out.push({
      kind: 'text',
      id: l.id,
      space,
      inside: l.pieceId === 'canvas' ? [space] : [l.pieceId, ...canvasOfPiece(l.pieceId)],
      fields: [
        { text, w: k === 'heading' || k === 'section' || k === 'title' ? 3 : 2 },
        { text: [l.kicker, l.author].filter(Boolean).join(' '), w: 1 },
      ],
      line: () => textLine(ws, ids, l, 100),
    })
  }
  for (const t of ws.tasks) {
    const c = t.cardId ? d.cards.get(t.cardId) : undefined
    out.push({
      kind: 'task',
      id: t.id,
      space: t.pieceId,
      inside: [t.pieceId, ...canvasOfPiece(t.pieceId), ...(c ? planesIn(c.id) : [])],
      fields: [
        { text: t.title, w: 3 },
        { text: [t.notes, ...(t.checks ?? []).map((x) => x.text)].filter(Boolean).join('\n'), w: 1 },
        { text: [...(t.labels ?? []), t.assigneeName, t.priority].filter(Boolean).join(' '), w: 1 },
      ],
      line: () => taskLine(ws, ids, t),
    })
  }
  for (const p of ws.pieces) {
    out.push({ kind: 'piece', id: p.id, space: `canvas:${canvasOf(p)}`, inside: canvasOfPiece(p.id), fields: [{ text: d.pieceName(p), w: 3 }, { text: KIND_NAME[kindOfPiece(p)], w: 0.5 }], line: () => pieceLine(ws, ids, p) })
    // A matrix's and a table's cells: their words and notes.
    if (p.kind === 'matrix' || p.kind === 'table') {
      const names = new Map<string, string>()
      if (p.kind === 'matrix' && p.matrix) for (const e of [...entriesOf(p.matrix.rows, ws.cards), ...entriesOf(p.matrix.cols, ws.cards)]) names.set(e.key, e.card ? `${ids.short('card', e.card.id)} ${oneLine(e.name, 30)}` : oneLine(e.name, 30))
      if (p.kind === 'table' && p.table) {
        for (const r of tableRows(p.table as TableSetup, ws.cards)) names.set(r.key, r.card ? `${ids.short('card', r.card.id)} ${oneLine(r.name, 30)}` : oneLine(r.name, 30))
        for (const c of (p.table as TableSetup).cols) names.set(c.id, colName(c))
      }
      for (const cell of ws.cells) {
        if (cell.matrixId !== p.id) continue
        const words = [typeof cell.value === 'string' ? cell.value : typeof cell.value === 'number' ? String(cell.value) : '', cell.notes ?? ''].filter(Boolean).join(' — ')
        if (!words) continue
        out.push({
          kind: 'cell',
          id: `${p.id}|${cell.row}|${cell.col}`,
          space: p.id,
          inside: [p.id, ...canvasOfPiece(p.id)],
          fields: [
            { text: typeof cell.value === 'string' || typeof cell.value === 'number' ? String(cell.value) : '', w: 1.5 },
            { text: cell.notes ?? '', w: 1 },
          ],
          line: () => `cell in ${ids.short('piece', p.id)}: ${names.get(cell.row) ?? '(gone)'} × ${names.get(cell.col) ?? '(gone)'} = ${q(words, 120)}`,
        })
      }
    }
  }
  for (const x of ws.documents) {
    const body = ws.bodies?.[x.id]
    out.push({
      kind: 'document',
      id: x.id,
      space: 'documents',
      inside: ['documents'],
      fields: [
        { text: x.title, w: 3 },
        { text: body ? pageText(x, body) : (x.excerpt ?? ''), w: 1 },
        { text: [x.topic, x.name].filter(Boolean).join(' '), w: 0.5 },
      ],
      line: () => `${ids.short('document', x.id)} ${x.kind} ${q(x.title, 80)} · by ${x.name}`,
    })
  }
  for (const t of ws.threads) {
    const msgs = ws.messages?.[t.id]
    const text = msgs ? msgs.map((m) => `${m.name}: ${m.text}`).join('\n') : [t.lastName && `${t.lastName}:`, t.lastText].filter(Boolean).join(' ')
    out.push({
      kind: 'comment',
      id: t.id,
      space: t.planeId === 'canvas' ? 'canvas:main' : t.planeId,
      inside: [t.planeId, ...canvasOfPiece(t.planeId), ...(t.on === 'card' ? planesIn(t.targetId) : [])],
      fields: [{ text, w: 2 }],
      line: () => `${ids.short('thread', t.id)} comments on ${targetName(ids, d, t.on, t.targetId)} (${count(t.count, 'message')}${t.resolved ? ', resolved' : ''})`,
    })
  }
  indexes.set(ws, { ids, list: out })
  return out
}

function targetName(ids: Ids, d: Derived, on: string, id: string): string {
  if (on === 'card') return d.cards.get(id) ? `${ids.short('card', id)} ${q(d.cards.get(id)!.title, 40)}` : 'a card that is gone'
  if (on === 'plane') return d.pieces.get(id) ? `${ids.short('piece', id)} ${q(d.nameById(id), 40)}` : 'a piece that is gone'
  if (on === 'task') return d.tasks.get(id) ? `${ids.short('task', id)} ${q(d.tasks.get(id)!.title, 40)}` : 'a task that is gone'
  if (on === 'label') return d.labels.get(id) ? `${ids.short('text', id)} ${q(d.labels.get(id)!.text, 40)}` : 'text that is gone'
  if (on === 'link') return d.edges.get(id) ? `${ids.short('link', id)} link` : 'a link that is gone'
  return id
}

function spaceName(ws: ReadWs, ids: Ids, d: Derived, space: string): string {
  if (space === 'documents') return 'documents'
  if (space.startsWith('canvas:')) {
    const c = ws.canvases.find((x) => x.id === space.slice(7))
    return `on canvas ${ids.short('canvas', space.slice(7))} ${q(c?.name ?? space.slice(7), 40)}`
  }
  const p = d.pieces.get(space)
  return p ? `in ${ids.short('piece', p.id)} ${KIND_NAME[kindOfPiece(p)]} ${q(d.pieceName(p), 40)}` : 'elsewhere'
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function search(ws: ReadWs, ids: Ids, a: SearchArgs): ToolResult {
  ws = clean(ws)
  ids.sync(ws)
  const d = derive(ws)
  const words = (a.query ?? '').toLowerCase().split(/\s+/).map((w) => w.replace(/^["'#@]+|["',.;:!?]+$/g, '')).filter(Boolean)
  if (!words.length) return { text: 'search needs words: search({ query: "pricing" }).' }
  const kinds = new Set(a.kinds?.length ? a.kinds.flatMap((k) => (k === 'card' ? ['customer', 'problem', 'competitor', 'idea', 'feature', 'package'] : [k])) : SEARCH_KINDS)
  let scope: string | undefined
  if (a.scope && a.scope !== 'everywhere') {
    const r = resolve(ws, ids, a.scope, ['piece', 'canvas'], undefined, 'piece or canvas')
    if (!('id' in r)) return { text: unclear(a.scope, r) }
    scope = r.kind === 'canvas' ? `canvas:${r.id}` : r.id
  }
  const phrase = words.join(' ')
  const scored = (all: boolean) =>
    index(ws, ids).flatMap((e) => {
      if (!kinds.has(e.kind) || (scope && !e.inside.includes(scope))) return []
      const low = e.fields.map((f) => ({ text: f.text.toLowerCase(), w: f.w, raw: f.text }))
      let score = 0
      let hits = 0
      for (const w of words) {
        const best = Math.max(0, ...low.filter((f) => f.text.includes(w)).map((f) => f.w))
        if (best) hits++
        score += best
      }
      if (all ? hits < words.length : hits === 0) return []
      const first = low[0]?.text ?? ''
      if (first === phrase) score += 3
      else if (words.length > 1 && first.includes(phrase)) score += 2
      return [{ e, score, low }]
    })
  let found = scored(true)
  let note = ''
  if (!found.length && words.length > 1) {
    found = scored(false)
    if (found.length) note = 'Nothing has every word; these have some of them.'
  }
  found.sort((x, y) => y.score - x.score)
  if (!found.length) return { text: `Nothing matches "${oneLine(a.query, 60)}"${scope ? ' there' : ''}. Try fewer or other words, kinds, or scope everywhere.` }
  const pg = pageOf(found, a.page, a.limit ?? 30)
  const re = new RegExp(words.map(escape).join('|'), 'gi')
  const groups = new Map<string, string[]>()
  for (const { e, low } of pg.items) {
    // A snippet from the first field that matched past the title, when the title alone doesn't show the words.
    const titleHit = matchesIn(e.fields[0]?.text ?? '', re, 1).length > 0
    const other = low.slice(1).find((f) => f.raw && words.some((w) => f.text.includes(w)))
    const line = `- ${e.line()}${other && (!titleHit || e.kind === 'document' || e.kind === 'comment') ? ` — ${snippet(other.raw, re)}` : ''}`
    const g = spaceName(ws, ids, d, e.space)
    groups.set(g, [...(groups.get(g) ?? []), line])
  }
  const body = [...groups].flatMap(([g, l]) => [`## ${g}`, ...l]).join('\n')
  const more = pageLine(found.length, pg, 'Results', 'Narrow with kinds (card, task, text, cell, document, comment…) or scope (a plane, deck or canvas).')
  return finish({ text: [`search "${oneLine(a.query, 80)}": ${count(found.length, 'match', 'matches')}${note ? `. ${note}` : ''}`, wrap('workspace', body), ...(more ? [more] : [])].join('\n'), more })
}

// ---- query

export const QUERY_KINDS = ['card', 'task', 'text', 'piece', 'document', 'comment'] as const
export const CARD_KINDS = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package'] as const
export const TEXT_KINDS = ['heading', 'paragraph', 'sticky', 'section', 'title'] as const
export const PIECE_KINDS = ['plane', 'matrix', 'table', 'deck', 'timeline', 'documents', 'document'] as const
export const DOC_KINDS = ['markdown', 'image', 'pdf', 'report'] as const
export const ALL_STATUSES = ['hypothesis', 'testing', 'validated', 'invalidated', 'idea', 'planned', 'building', 'shipped'] as const
export const PRIORITIES = ['P1', 'P2', 'P3'] as const
export const THREAD_ON = ['card', 'label', 'link', 'plane', 'task'] as const

export type QueryArgs = {
  kind?: (typeof QUERY_KINDS)[number]
  type?: string | string[]
  status?: string | string[]
  tag?: string | string[]
  region?: string | string[]
  plane?: string
  deck?: string
  column?: string
  priority?: string | string[]
  assignee?: string
  has_evidence?: boolean
  no_evidence?: boolean
  contradicting?: boolean
  linked_to?: string
  for?: string
  due_before?: string
  due_after?: string
  overdue?: boolean
  on_canvas?: string
  title?: string
  // Comments: open or resolved, on what kind of thing, started or last written by whom.
  resolved?: boolean
  on?: string
  by?: string
  page?: number
  limit?: number
}

const list = (v: string | string[] | undefined) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => String(x).trim().replace(/^#/, '')).filter(Boolean))
const DAY = /^\d{4}-\d{2}-\d{2}$/

// Which filters each kind reads; another one given is refused, never ignored (a silent 0 reads as an answer).
const FILTERS: Record<(typeof QUERY_KINDS)[number], string[]> = {
  card: ['type', 'status', 'tag', 'region', 'plane', 'priority', 'has_evidence', 'no_evidence', 'contradicting', 'linked_to', 'for', 'on_canvas', 'title'],
  task: ['type', 'tag', 'plane', 'deck', 'column', 'priority', 'assignee', 'linked_to', 'for', 'due_before', 'due_after', 'overdue', 'on_canvas', 'title'],
  text: ['type', 'plane', 'on_canvas', 'title'],
  piece: ['type', 'plane', 'on_canvas', 'title'],
  document: ['type', 'title'],
  comment: ['resolved', 'on', 'by', 'plane', 'for', 'title'],
}
const PAGING = ['kind', 'page', 'limit']

export function query(ws: ReadWs, ids: Ids, a: QueryArgs): ToolResult {
  ws = clean(ws)
  ids.sync(ws)
  const d = derive(ws)
  const kind = a.kind ?? (a.deck || a.column || a.assignee || a.due_before || a.due_after || a.overdue ? 'task' : a.resolved !== undefined || a.on || a.by ? 'comment' : 'card')
  const fail = (s: string): ToolResult => ({ text: s })
  if (!QUERY_KINDS.includes(kind)) return fail(`query: kind "${oneLine(String(kind), 30)}" isn't one; use ${QUERY_KINDS.join(', ')}.`)
  const given = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined && !PAGING.includes(k))
  const foreign = given.filter((k) => !FILTERS[kind].includes(k))
  if (foreign.length) return fail(`query: ${foreign.join(', ')} ${foreign.length > 1 ? "don't" : "doesn't"} apply to ${kind}s; for ${kind}s use ${FILTERS[kind].join(', ')}.`)
  // Values checked against what there is.
  const bad = (what: string, got: string[], allowed: readonly string[]) => {
    const wrong = got.filter((g) => !allowed.includes(g))
    return wrong.length ? `query: ${what} ${wrong.map((w) => `"${oneLine(w, 30)}"`).join(', ')} isn't one; use ${allowed.join(', ')}.` : ''
  }
  const types = list(a.type).map((t) => t.toLowerCase())
  const statuses = list(a.status).map((t) => t.toLowerCase())
  const tags = list(a.tag)
  const prios = list(a.priority).map((x) => x.toUpperCase())
  const typeList = kind === 'card' || kind === 'task' ? CARD_KINDS : kind === 'text' ? TEXT_KINDS : kind === 'piece' ? PIECE_KINDS : DOC_KINDS
  const refusal =
    bad('type', types, typeList) ||
    bad('status', statuses, ALL_STATUSES) ||
    bad('priority', prios, PRIORITIES) ||
    bad('on', list(a.on), THREAD_ON) ||
    (a.due_before && !DAY.test(a.due_before) ? `query: due_before "${oneLine(a.due_before, 30)}" isn't a day; write YYYY-MM-DD (today is ${d.today}).` : '') ||
    (a.due_after && !DAY.test(a.due_after) ? `query: due_after "${oneLine(a.due_after, 30)}" isn't a day; write YYYY-MM-DD (today is ${d.today}).` : '')
  if (refusal) return fail(refusal)
  if (tags.length && kind === 'card') {
    const known = [...new Set(ws.cards.flatMap((c) => c.tags ?? []))].sort()
    const r = bad('tag', tags, known)
    if (r) return fail(r)
  }
  const said: string[] = []
  const one = (ref: string | undefined, kinds: IdKind[], what: string, accept?: (k: IdKind, id: string) => boolean): { id?: string; err?: string } => {
    if (!ref) return {}
    const r = resolve(ws, ids, ref, kinds, accept, what)
    if (!('id' in r)) return { err: unclear(ref, r) }
    said.push(`${what} ${r.short}`)
    return { id: r.id }
  }
  const pieceOf = (k: string) => (_: IdKind, id: string) => d.pieces.get(id)?.kind === k
  const plane = one(a.plane, ['piece'], 'plane', pieceOf('plane'))
  if (plane.err) return fail(plane.err)
  const canvas = one(a.on_canvas, ['canvas'], 'canvas')
  if (canvas.err) return fail(canvas.err)
  const linked = one(a.linked_to, ['card'], 'card')
  if (linked.err) return fail(linked.err)
  const forC = one(a.for, ['card'], kind === 'card' ? 'customer' : 'card', kind === 'card' ? (_, id) => d.cards.get(id)?.type === 'customer' : undefined)
  if (forC.err) return fail(forC.err)
  const words = a.title?.toLowerCase().trim()
  const onCanvas = (pieceId: string) => {
    const p = d.pieces.get(pieceId)
    return !!p && (p.canvases ?? [canvasOf(p)]).includes(canvas.id!)
  }
  const notes: string[] = []
  let lines: string[] = []
  let what = ''
  if (kind === 'card') {
    const regions = list(a.region)
    if (regions.length) notes.push(`Region: competitors only; a place counts inside the bigger ones (Germany is in DACH, EU, Europe, Global), and a Europe-wide or global competitor counts for Germany.`)
    const cards = ws.cards.filter((c) => {
      if (types.length && !types.includes(c.type)) return false
      if (statuses.length && !statuses.includes(statusOf(c) ?? '')) return false
      if (tags.length && !(c.tags ?? []).some((t) => tags.includes(t))) return false
      if (regions.length && !(c.type === 'competitor' && inRegions(c.regions, regions))) return false
      if (plane.id && !isOnPlane(c, plane.id)) return false
      if (canvas.id && !(d.planesOf.get(c.id) ?? []).some(onCanvas)) return false
      if (prios.length && !prios.includes(c.priority ?? '')) return false
      const proof = d.facts.get(c.id)?.proof
      if (a.has_evidence && !proof) return false
      if (a.no_evidence && proof) return false
      if (a.contradicting && !d.facts.get(c.id)?.clash) return false
      if (linked.id && !(d.linksOf.get(c.id) ?? []).some((e) => e.fromId === linked.id || e.toId === linked.id)) return false
      if (forC.id && !(c.id === forC.id || (d.linksOf.get(c.id) ?? []).some((e) => e.kind === FOR && e.fromId === c.id && e.toId === forC.id))) return false
      if (words && !c.title.toLowerCase().includes(words)) return false
      return true
    })
    lines = cards.map((c) => cardLine(ws, ids, c, { planes: true }))
    what = 'cards'
  } else if (kind === 'task') {
    const deck = one(a.deck, ['piece'], 'deck', pieceOf('kanban'))
    if (deck.err) return fail(deck.err)
    const deckP = deck.id ? d.pieces.get(deck.id) : undefined
    if (deckP?.kanban?.holds === 'cards') return fail(`${ids.short('piece', deckP.id)} holds cards, not tasks: view(${ids.short('piece', deckP.id)}) shows them, or query cards.`)
    if (a.column) {
      const cols = deck.id ? (deckP?.kanban?.cols ?? []) : ws.pieces.flatMap((p) => p.kanban?.cols ?? [])
      const r = bad('column', [a.column.toLowerCase()], [...new Set(cols.flatMap((c) => [c.name.toLowerCase()]))])
      if (r && !cols.some((c) => c.id === a.column)) return fail(r)
    }
    let who: string | undefined
    if (a.assignee) {
      if (a.assignee === 'nobody') who = ''
      else {
        const r = resolvePerson(ws, ids, a.assignee)
        if (!('id' in r)) return fail(unclear(a.assignee, r))
        who = r.id
        said.push(`given to ${r.short}`)
      }
    }
    // A deck shows what it shows (D-255): stuck to a plane, only that plane's tasks; the others are skipped and said.
    const shown = deckP ? new Set(shownTasks(ws, d, deckP).map((t) => t.id)) : undefined
    let hidden = 0
    const tasks = ws.tasks.filter((t) => {
      const p = d.pieces.get(t.pieceId)
      if (!p) return false
      if (deck.id && t.pieceId !== deck.id) return false
      if (a.column) {
        const col = p.kanban?.cols.find((c) => c.id === t.col)
        if (!col || (col.id !== a.column && col.name.toLowerCase() !== a.column.toLowerCase())) return false
      }
      if (who !== undefined && (t.assignee ?? '') !== who) return false
      if (prios.length && !prios.includes(t.priority ?? '')) return false
      const finished = !!d.doneCols.get(t.pieceId)?.has(t.col)
      if (a.overdue && !(t.due && !finished && t.due < d.today)) return false
      if (a.due_before && !(t.due && t.due < a.due_before)) return false
      if (a.due_after && !(t.due && t.due > a.due_after)) return false
      if (tags.length && !(t.labels ?? []).some((l) => tags.includes(l))) return false
      const c = t.cardId ? d.cards.get(t.cardId) : undefined
      if (types.length && !(c && types.includes(c.type))) return false
      if (forC.id && t.cardId !== forC.id) return false
      if (linked.id && t.cardId !== linked.id) return false
      if (plane.id && !(p.stuckTo === plane.id || (c && isOnPlane(c, plane.id)))) return false
      if (canvas.id && !onCanvas(t.pieceId)) return false
      if (words && !t.title.toLowerCase().includes(words)) return false
      if (shown && !shown.has(t.id)) return (hidden++, false)
      return true
    })
    if (hidden && deckP?.stuckTo) notes.push(`${count(hidden, 'task')} in ${ids.short('piece', deckP.id)} skipped: it's stuck to ${ids.short('piece', deckP.stuckTo)} and shows only that plane's tasks (for its cards or no card).`)
    tasks.sort((x, y) => (x.due ?? '9999').localeCompare(y.due ?? '9999') || x.createdAt - y.createdAt)
    lines = tasks.map((t) => taskLine(ws, ids, t, { where: true }))
    what = 'tasks'
  } else if (kind === 'text') {
    const labels = ws.labels.filter((l) => {
      if (types.length && !types.includes(kindOf(l))) return false
      if (plane.id && l.pieceId !== plane.id) return false
      if (canvas.id && !(l.pieceId === 'canvas' ? canvasOf(l) === canvas.id : onCanvas(l.pieceId))) return false
      if (words && !l.text.toLowerCase().includes(words)) return false
      return true
    })
    lines = labels.map((l) => `${textLine(ws, ids, l, 100)} · on ${l.pieceId === 'canvas' ? `canvas ${ids.short('canvas', canvasOf(l))}` : d.pieces.has(l.pieceId) ? ids.short('piece', l.pieceId) : 'a plane that is gone'}`)
    what = 'texts'
  } else if (kind === 'piece') {
    const kinds = types.map((t) => (t === 'deck' ? 'kanban' : t))
    const pieces = d.pieceOrder.filter((p) => (!kinds.length || kinds.includes(p.kind)) && (!canvas.id || onCanvas(p.id)) && (!plane.id || p.stuckTo === plane.id) && (!words || d.pieceName(p).toLowerCase().includes(words)))
    lines = pieces.map((p) => pieceLine(ws, ids, p))
    what = 'pieces'
  } else if (kind === 'document') {
    const docs = ws.documents.filter((x) => (!types.length || types.includes(x.kind)) && (!words || x.title.toLowerCase().includes(words)))
    lines = docs.map((x) => `${ids.short('document', x.id)} · ${x.kind} · ${q(x.title, 80)} · by ${oneLine(x.name, 40)}`)
    what = 'documents'
  } else {
    let by: string | undefined
    if (a.by) {
      const r = resolvePerson(ws, ids, a.by)
      if (!('id' in r)) return fail(unclear(a.by, r))
      by = r.id
      said.push(`by ${r.short}`)
    }
    const on = list(a.on)
    const threads = [...ws.threads]
      .filter((t) => {
        if (a.resolved !== undefined && !!t.resolved !== a.resolved) return false
        if (on.length && !on.includes(t.on)) return false
        if (by && t.uid !== by && t.lastUid !== by && !(ws.messages?.[t.id] ?? []).some((m) => m.uid === by)) return false
        if (plane.id && t.planeId !== plane.id && !(t.on === 'card' && d.cards.get(t.targetId) && isOnPlane(d.cards.get(t.targetId)!, plane.id))) return false
        if (forC.id && t.targetId !== forC.id) return false
        if (words && !`${t.lastText ?? ''} ${(ws.messages?.[t.id] ?? []).map((m) => m.text).join(' ')}`.toLowerCase().includes(words)) return false
        return true
      })
      .sort((x, y) => y.lastAt - x.lastAt)
    lines = threads.map((t) => threadLine(ids, d, t))
    what = 'comment threads'
  }
  const filters = [types.length && `type ${types.join('/')}`, statuses.length && `status ${statuses.join('/')}`, tags.length && `tag ${tags.join('/')}`, prios.length && `priority ${prios.join('/')}`, a.region && `region ${list(a.region).join('/')}`, ...said, a.column && `column ${a.column}`, a.overdue && 'overdue', a.due_before && `due before ${a.due_before}`, a.due_after && `due after ${a.due_after}`, a.has_evidence && 'with evidence', a.no_evidence && 'without evidence', a.contradicting && 'status and evidence disagree', a.resolved !== undefined && (a.resolved ? 'resolved' : 'open'), a.on && `on ${list(a.on).join('/')}`, words && `title has "${oneLine(words, 60)}"`].filter(Boolean)
  const pg = pageOf(lines, a.page, a.limit ?? 50)
  const more = pageLine(lines.length, pg, what[0].toUpperCase() + what.slice(1), 'Add a filter to narrow, or get(ids) for detail.')
  return finish({ text: [`query ${what}${filters.length ? ` where ${filters.join(', ')}` : ''}: ${lines.length} (today ${d.today})`, ...notes, wrap('workspace', pg.items.join('\n') || '(none)'), ...(more ? [more] : [])].join('\n'), more })
}

// A comment thread in a line: what it's on, open or resolved, how many messages, the last one.
export function threadLine(ids: Ids, d: Derived, t: Derived['threads'] extends Map<string, infer T> ? T : never): string {
  return `${ids.short('thread', t.id)} on ${targetName(ids, d, t.on, t.targetId)} · ${t.resolved ? 'resolved' : 'open'} · ${count(t.count, 'message')}${t.lastText ? ` · last ${oneLine(t.lastName ?? '?', 30)} ${dayOf(t.lastAt)}: ${q(t.lastText, 80)}` : ''}`
}

// ---- get

export type GetArgs = { ids: string[] | string; detail?: 'concise' | 'full' }

export function get(ws: ReadWs, ids: Ids, a: GetArgs): ToolResult {
  ws = clean(ws)
  ids.sync(ws)
  const refs = (Array.isArray(a.ids) ? a.ids : [a.ids]).slice(0, 40)
  const full = a.detail !== 'concise'
  const out: string[] = []
  for (const ref of refs) {
    const r = resolve(ws, ids, ref)
    if (!('id' in r)) {
      out.push(unclear(ref, r))
      continue
    }
    const { author, text } = describe(ws, ids, r.kind, r.id, full && refs.length <= 12)
    out.push(wrap(author, text))
  }
  return finish({ text: out.join('\n\n') })
}

export function describe(ws: ReadWs, ids: Ids, kind: IdKind, id: string, full: boolean): { author: string; text: string } {
  ws = clean(ws)
  const d = derive(ws)
  switch (kind) {
    case 'card':
      return { author: nameOf(d, ws.times?.[id]?.by) === 'nobody' ? 'workspace' : nameOf(d, ws.times?.[id]?.by), text: cardText(ws, ids, d, d.cards.get(id)!, full) }
    case 'piece':
      return { author: 'workspace', text: pieceText(ws, ids, d, d.pieces.get(id)!, full) }
    case 'task': {
      const t = d.tasks.get(id)!
      return { author: nameOf(d, t.uid), text: taskText(ws, ids, d, t, full) }
    }
    case 'text': {
      const l = d.labels.get(id)!
      const k = kindOf(l)
      const lines = [`## ${textLine(ws, ids, l, 120)}`, `on ${l.pieceId === 'canvas' ? `canvas ${ids.short('canvas', canvasOf(l))}` : `${ids.short('piece', l.pieceId)} ${q(d.nameById(l.pieceId), 40)}`}`]
      if (full && (k === 'paragraph' || k === 'sticky')) lines.push('text:', l.text)
      if (k === 'section') {
        const others = l.pieceId === 'canvas' ? piecesShown(canvasOf(l), ws.pieces, ws.spots).map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h })) : cardBoxes(d.onPlane.get(l.pieceId) ?? [])
        const held = sectionHolds(l, ws.labels.filter((x) => x.pieceId === l.pieceId), others)
        const named = held.map((h) => (d.cards.has(h) ? ids.short('card', h) : d.pieces.has(h) ? ids.short('piece', h) : ids.short('text', h)))
        lines.push(`holds ${held.length}: ${named.slice(0, 60).join(', ')}${named.length > 60 ? ' …' : ''}`)
      }
      if (l.createdAt) lines.push(`made ${dayOf(l.createdAt)}${l.author ? ` by ${l.author}` : ''}`)
      return { author: l.author ?? nameOf(d, l.uid).replace(/^nobody$/, 'workspace'), text: lines.join('\n') }
    }
    case 'evidence': {
      const v = d.evidenceById.get(id)!
      const c = d.cards.get(v.nodeId)
      return { author: 'workspace', text: [`## ${ids.short('evidence', v.id)} evidence (${v.stance}, ${v.kind}) on ${c ? `${ids.short('card', c.id)} ${q(c.title)}` : 'a card that is gone'}`, v.text, ...(v.source ? [`source: ${v.source}`] : []), ...(v.url ? [`link: ${v.url}`] : []), ...(v.date ? [`learned ${v.date}`] : [])].join('\n') }
    }
    case 'feature': {
      const f = d.featuresById.get(id)!
      const c = d.cards.get(f.competitorId)
      const ours = ws.comparisons.filter((m) => m.competitorFeatureId === f.id).map((m) => (d.cards.get(m.featureId) ? `${ids.short('card', m.featureId)} ${q(d.cards.get(m.featureId)!.title, 40)}` : null)).filter(Boolean)
      return { author: 'workspace', text: [`## ${ids.short('feature', f.id)} competitor feature ${q(f.name)} of ${c ? `${ids.short('card', c.id)} ${q(c.title, 40)}` : '?'}`, [f.category && `category ${f.category}`, f.availability].filter(Boolean).join(' · '), ...(f.description ? [f.description] : []), ...(f.url ? [`seen at ${f.url}`] : []), ...(ours.length ? [`≈ our ${ours.join(', ')}`] : [])].filter(Boolean).join('\n') }
    }
    case 'document': {
      const x = d.docs.get(id)!
      return { author: x.name, text: [`## ${ids.short('document', x.id)} ${x.kind} ${q(x.title, 120)}`, `by ${x.name} · ${x.shared ? 'shared' : 'private'} · added ${dayOf(x.createdAt)}${x.words ? ` · ${x.words} words` : ''}${x.pages ? ` · ${x.pages} pages` : ''}`, ...(x.excerpt ? [`starts: ${oneLine(x.excerpt, full ? 400 : 120)}`] : []), `read it: read_document(${ids.short('document', x.id)})${ws.bodies?.[x.id] ? '' : ' (its text is not loaded here)'}`].join('\n') }
    }
    case 'canvas': {
      const c = ws.canvases.find((x) => x.id === id)!
      const pieces = piecesShown(c.id, ws.pieces, ws.spots)
      return { author: 'workspace', text: [`## ${ids.short('canvas', c.id)} canvas ${q(c.name)}`, `${count(pieces.length, 'piece')}:`, ...pieces.slice(0, 60).map((p) => `- ${pieceLine(ws, ids, p)}`)].join('\n') }
    }
    case 'thread': {
      const t = d.threads.get(id)!
      const msgs = ws.messages?.[t.id]
      const lines = [`## ${ids.short('thread', t.id)} comments on ${targetName(ids, d, t.on, t.targetId)}`, `started by ${t.name} ${dayOf(t.createdAt)} · ${count(t.count, 'message')}${t.resolved ? ' · resolved' : ''}`]
      if (msgs) lines.push(...msgs.slice(-30).map((m) => `${timeOf(m.createdAt)} ${m.name}: ${oneLine(m.text, full ? 1000 : 160)}`))
      else if (t.lastText) lines.push(`last: ${t.lastName ?? '?'}: ${oneLine(t.lastText, 300)} (the other messages aren't loaded here)`)
      return { author: t.name, text: lines.join('\n') }
    }
    case 'person': {
      const m = ws.members?.find((x) => x.uid === id)
      const given = ws.tasks.filter((t) => t.assignee === id)
      const open = given.filter((t) => !d.doneCols.get(t.pieceId)?.has(t.col))
      return { author: 'workspace', text: [`## ${ids.short('person', id)} ${nameOf(d, id)}${m?.email ? ` <${m.email}>` : ''}`, `role ${ws.workspace?.roles?.[id] ?? 'not a member now'} · ${count(given.length, 'task')} given to them, ${open.length} open`, ...(full ? open.slice(0, 20).map((t) => `- ${taskLine(ws, ids, t, { where: true })}`) : [])].join('\n') }
    }
    case 'link': {
      const e = d.edges.get(id)!
      const end = (x: string) => (d.cards.get(x) ? `${ids.short('card', x)} ${d.cards.get(x)!.type} ${q(d.cards.get(x)!.title, 50)}` : 'a card that is gone')
      return { author: 'workspace', text: `## ${ids.short('link', e.id)} link: ${end(e.fromId)} —${e.kind}→ ${end(e.toId)}${e.label ? ` · label ${q(e.label)}` : ''}` }
    }
  }
}

function cardText(ws: ReadWs, ids: Ids, d: Derived, c: Card, full: boolean): string {
  const lines = [`## ${cardLine(ws, ids, c, { links: false, tags: false, planes: false, max: 200 })}`]
  const planes = d.planesOf.get(c.id) ?? []
  lines.push(`on ${planes.map((p, i) => `${ids.short('piece', p)} ${q(d.nameById(p), 40)}${i === 0 ? ' (home)' : ''}`).join(', ') || 'no plane'}`)
  if (c.tags?.length) lines.push(`tags ${c.tags.map((t) => `#${t}`).join(' ')}`)
  if (c.type === 'competitor') {
    const prof = [c.regions?.length && `regions ${c.regions.join(', ')}`, c.description && `does: ${c.description}`, c.audience && `for: ${c.audience}`, c.pricing && `pricing: ${c.pricing}`, c.url && `site: ${c.url}`].filter(Boolean)
    lines.push(...(prof as string[]))
  }
  if (c.type === 'feature' || c.type === 'package') {
    const sure = confidenceFor(c, ws.cards, ws.edges)
    if (sure) lines.push(`confidence ${sure.level} (${sure.why})`)
  }
  if (c.criteria?.length) lines.push(`judged on: ${c.criteria.map((x) => q(x.text, 60)).join(', ')}`)
  if (c.notes) lines.push(full ? `notes:\n${c.notes}` : `notes: ${oneLine(c.notes, 160)}`)
  const ev = d.evidenceOf.get(c.id) ?? []
  if (ev.length) {
    lines.push(`evidence (${ev.length}):`)
    for (const v of full ? ev : ev.slice(0, 3)) lines.push(`- ${ids.short('evidence', v.id)} ${v.stance === 'supports' ? '+ supports' : '− contradicts'} · ${v.kind} · ${q(v.text, full ? 300 : 100)}${v.source ? ` · ${oneLine(v.source, 60)}` : ''}${v.date ? ` · ${v.date}` : ''}`)
    if (!full && ev.length > 3) lines.push(`… ${ev.length - 3} more`)
  }
  const links = d.linksOf.get(c.id) ?? []
  if (links.length) {
    lines.push(`links (${links.length}):`)
    const end = (x: string) => (d.cards.get(x) ? `${ids.short('card', x)} ${d.cards.get(x)!.type} ${q(d.cards.get(x)!.title, 50)}` : 'a card that is gone')
    for (const e of full ? links.slice(0, 80) : links.slice(0, 8))
      lines.push(e.fromId === c.id ? `- → ${e.kind} ${end(e.toId)}${e.label ? ` (${q(e.label, 40)})` : ''} [${ids.short('link', e.id)}]` : `- ← ${e.kind} from ${end(e.fromId)}${e.label ? ` (${q(e.label, 40)})` : ''} [${ids.short('link', e.id)}]`)
    if (links.length > (full ? 80 : 8)) lines.push(`… ${links.length - (full ? 80 : 8)} more: neighbours(${ids.short('card', c.id)})`)
  }
  const parent = d.folds.parentOf.get(c.id)
  if (parent) lines.push(`part of ${ids.short('card', parent)} ${q(d.cards.get(parent)?.title, 50)}`)
  const kids = [...d.folds.parentOf].filter(([, p]) => p === c.id).map(([k]) => k)
  if (kids.length) lines.push(`parts: ${kids.map((k) => `${ids.short('card', k)} ${q(d.cards.get(k)?.title, 40)}`).join(', ')}${c.folded ? ' (folded into it)' : ''}`)
  const pk = d.packagesOf.get(c.id) ?? []
  if (pk.length) lines.push(`in package ${pk.map((p) => `${ids.short('card', p)} ${q(d.cards.get(p)?.title, 40)}`).join(', ')}`)
  if (c.type === 'package') {
    const tree = packageTree(c, ws.cards, ws.edges)
    lines.push(`holds (${tree.length}):`, ...tree.slice(0, full ? 60 : 10).map((r) => `${'  '.repeat(r.depth + 1)}- ${ids.short('card', r.card.id)} ${r.card.type} ${q(r.card.title, 50)}`))
  }
  if (c.type === 'competitor') {
    const feats = d.featuresOf.get(c.id) ?? []
    if (feats.length) {
      lines.push(`their features (${feats.length}):`)
      for (const g of byCategory(feats))
        for (const f of g.items) {
          const ours = ws.comparisons.filter((m) => m.competitorFeatureId === f.id).map((m) => ids.short('card', m.featureId))
          lines.push(`- ${ids.short('feature', f.id)} ${q(f.name, 50)}${g.cat ? ` · ${g.cat}` : ''}${f.availability ? ` · ${f.availability}` : ''}${ours.length ? ` · ≈ our ${ours.join(', ')}` : ''}`)
        }
    }
  }
  if (c.type === 'feature') {
    const theirs = ws.comparisons.filter((m) => m.featureId === c.id)
    for (const m of theirs) {
      const f = m.competitorFeatureId ? d.featuresById.get(m.competitorFeatureId) : undefined
      const scores = m.criteria ? Object.entries(m.criteria).map(([k, v]) => `${c.criteria?.find((x) => x.id === k)?.text ?? k}: ${v}`).join(', ') : ''
      lines.push(`vs ${ids.short('card', m.competitorId)} ${q(d.cards.get(m.competitorId)?.title, 30)}: ${f ? `≈ theirs ${ids.short('feature', f.id)} ${q(f.name, 40)}` : 'no match'}${scores ? ` · ${scores}` : ''}`)
    }
  }
  const tasks = d.tasksOf.get(c.id) ?? []
  if (tasks.length) lines.push(`tasks (${tasks.length}):`, ...tasks.slice(0, full ? 30 : 5).map((t) => `- ${taskLine(ws, ids, t, { where: true, card: 'none' })}`))
  if (full) {
    const lenses = ws.pieces.filter((p) => (p.kind === 'matrix' && p.matrix && [...entriesOf(p.matrix.rows, ws.cards), ...entriesOf(p.matrix.cols, ws.cards)].some((e) => e.card?.id === c.id)) || (p.kind === 'table' && p.table && tableRows(p.table as TableSetup, ws.cards).some((r) => r.card?.id === c.id)))
    if (lenses.length) lines.push(`shown in: ${lenses.map((p) => `${ids.short('piece', p.id)} ${KIND_NAME[kindOfPiece(p)]} ${q(d.pieceName(p), 40)}`).join(', ')}`)
  }
  const threads = d.threadsOn.get(c.id) ?? []
  if (threads.length) lines.push(`comments: ${threads.map((t) => `${ids.short('thread', t.id)} (${count(t.count, 'message')}${t.resolved ? ', resolved' : ''}${t.lastText ? `, last ${t.lastName ?? ''}: ${q(t.lastText, 60)}` : ''})`).join(' · ')}`)
  return lines.join('\n')
}

function pieceText(ws: ReadWs, ids: Ids, d: Derived, p: P, full: boolean): string {
  const kind = kindOfPiece(p)
  const lines = [`## ${ids.short('piece', p.id)} ${KIND_NAME[kind]} ${q(d.pieceName(p), 80)}`, pieceSays(ws, ids, p)]
  lines.push(`on canvas ${(p.canvases ?? [canvasOf(p)]).map((c) => ids.short('canvas', c)).join(', ')}${p.open ? ' · unframed (laid on the canvas)' : ''}`)
  if (p.stuckTo && d.pieces.get(p.stuckTo)) lines.push(`stuck to ${ids.short('piece', p.stuckTo)} ${q(d.nameById(p.stuckTo), 40)}`)
  const stuck = ws.pieces.filter((x) => x.stuckTo === p.id)
  if (stuck.length) lines.push(`stuck to it: ${stuck.map((x) => `${ids.short('piece', x.id)} ${KIND_NAME[kindOfPiece(x)]} ${q(d.pieceName(x), 30)}`).join(', ')}`)
  if (kind === 'matrix' && p.matrix) {
    const m = p.matrix as MatrixSetup
    for (const [side, ax] of [['rows', m.rows], ['columns', m.cols]] as const) {
      const typed = ax.items.filter((i) => !i.cardId).map((i) => q(i.name, 30))
      lines.push(`${side}: ${nounOf(ax)}${ax.type ? ` = every ${ax.type}${ax.plane ? ` on ${ids.short('piece', ax.plane)}` : ''}` : ''}${ax.items.some((i) => i.cardId) ? ` + cards ${ax.items.filter((i) => i.cardId).map((i) => ids.short('card', i.cardId!)).join(', ')}` : ''}${typed.length ? ` + typed ${typed.join(', ')}` : ''}${ax.hide?.length ? ` (taken out: ${ax.hide.map((h) => ids.short('card', h)).join(', ')})` : ''}${ax.unfold ? ' · unfolds features into their criteria' : ''}`)
    }
    lines.push(`cells: ${m.cell}${m.cell === 'scale' ? ` (${m.steps.map((s) => `${s.glyph} ${s.label}`).join(', ')})` : ''}${m.unit ? ` in ${m.unit}` : ''}${m.notRelevant ? ' · may be not relevant (—)' : ''}${m.confidence ? ' · how sure (~ ?)' : ''}${m.reading ? ` · totals at ${m.totalsAt ?? 'head'}` : ''}`)
  }
  if (kind === 'table' && p.table) {
    const t = p.table as TableSetup
    lines.push(`rows: ${t.manual ? 'only typed by hand' : t.rows.rules.length ? t.rows.rules.map((r) => ruleWords(ids, d, r)).join(' and ') : 'every card'}${t.rows.items.length ? ` + ${count(t.rows.items.length, 'row')} added by hand` : ''}${t.rows.hide?.length ? ` (${t.rows.hide.length} taken out)` : ''}`)
    lines.push(`columns: name, ${t.cols.map((c) => (c.field ? `${c.field} (card field)` : `${colName(c)} (${c.kind ?? 'text'}${c.unit ? `, ${c.unit}` : ''}${c.kind === 'scale' && c.steps ? `: ${c.steps.map((s) => s.label).join('/')}` : ''})`)).join(', ')}`)
    if (t.sort) lines.push(`sorted by ${t.sort.col === 'name' ? 'name' : colName(t.cols.find((c) => c.id === t.sort!.col) ?? { id: '' })}${t.sort.desc ? ', high first' : ''}`)
    if (t.pageSize) lines.push(`${t.pageSize} rows a page`)
  }
  if (kind === 'kanban') {
    const k = p.kanban as KanbanSetup | undefined
    if (k?.holds === 'cards') lines.push(`holds cards from: ${k.source?.rules.length ? k.source.rules.map((r) => ruleWords(ids, d, r)).join(' and ') : 'every card'}; columns by ${k.colField ?? 'status'}${k.rowField ? `, rows by ${k.rowField}` : ''}${k.names?.length ? `; named boxes: ${k.names.map((n) => `${n.col}×${n.row} "${n.name}"`).join(', ')}` : ''}`)
    else {
      lines.push(`columns: ${(k?.cols ?? []).map((c, i) => `${String(i + 1).padStart(2, '0')} ${c.name}${c.done ? ' (finished)' : ''}${c.limit ? ` (limit ${c.limit})` : ''}`).join(', ')}${k?.rows ? ` · lanes by ${k.rows}` : ''}`)
      if (full) {
        const tasks = shownTasks(ws, d, p)
        const people = new Map<string, number>()
        for (const t of tasks) people.set(t.assignee ?? '', (people.get(t.assignee ?? '') ?? 0) + 1)
        lines.push(`given to: ${[...people].map(([u, n]) => `${u ? `${ids.short('person', u)} ${nameOf(d, u)}` : 'nobody'} ${n}`).join(', ') || 'nobody'} · view(${ids.short('piece', p.id)}) lists the tasks`)
      }
    }
  }
  if (kind === 'timeline') lines.push(`rows by ${p.timeline?.rows ?? 'kanban'} · view(${ids.short('piece', p.id)}) lists the tasks by day`)
  const threads = d.threadsOn.get(p.id) ?? []
  if (threads.length) lines.push(`comments: ${threads.map((t) => `${ids.short('thread', t.id)} (${count(t.count, 'message')})`).join(', ')}`)
  if (full) lines.push(`made ${dayOf(p.createdAt)} · changed ${dayOf(p.updatedAt)}`)
  return lines.join('\n')
}

function taskText(ws: ReadWs, ids: Ids, d: Derived, t: Task, full: boolean): string {
  const deck = d.pieces.get(t.pieceId)
  const col = deck?.kanban?.cols.find((c) => c.id === t.col)
  const lines = [
    `## ${ids.short('task', t.id)} task ${q(t.title, 200)}`,
    `in ${deck ? `${ids.short('piece', deck.id)} deck ${q(d.pieceName(deck), 40)}` : 'a deck that is gone'} · column ${col?.name ?? t.col}${col?.done ? ' (finished)' : ''}`,
    `given to ${t.assignee ? `${ids.short('person', t.assignee)} ${t.assigneeName ?? nameOf(d, t.assignee)}` : 'nobody'}${t.givenBy && t.givenAt ? ` (by ${nameOf(d, t.givenBy)}, ${dayOf(t.givenAt)})` : ''}`,
  ]
  const finished = !!col?.done
  if (t.start || t.due) lines.push([t.start && `starts ${t.start}`, t.due && `due ${t.due}${t.due < d.today && !finished ? ' (overdue)' : ''}`].filter(Boolean).join(' · '))
  if (t.cardId) {
    const c = d.cards.get(t.cardId)
    lines.push(c ? `for ${cardLine(ws, ids, c, { links: false, tags: false })}` : 'for a card that is gone')
  }
  if (t.priority) lines.push(`priority ${t.priority}`)
  if (t.labels?.length) lines.push(`labels ${t.labels.map((l) => `#${l}`).join(' ')}`)
  if (t.checks?.length) lines.push(`checklist ${t.checks.filter((x) => x.done).length}/${t.checks.length}:`, ...t.checks.map((x) => `- [${x.done ? 'x' : ' '}] ${oneLine(x.text, 120)}`))
  if (t.notes) lines.push(full ? `notes:\n${t.notes}` : `notes: ${oneLine(t.notes, 160)}`)
  if (t.learned) lines.push(t.learned === 'skip' ? 'what it taught: declined' : `logged what it taught: ${d.evidenceById.has(t.learned) ? ids.short('evidence', t.learned) : 'evidence that is gone'}`)
  const threads = d.threadsOn.get(t.id) ?? []
  if (threads.length) lines.push(`comments: ${threads.map((x) => `${ids.short('thread', x.id)} (${count(x.count, 'message')})`).join(', ')}`)
  if (full) lines.push(`made by ${nameOf(d, t.uid)} ${dayOf(t.createdAt)} · changed ${dayOf(t.updatedAt)}`)
  return lines.join('\n')
}

// ---- neighbours

export type NeighboursArgs = { id: string; kinds?: string[]; depth?: number; limit?: number }
export const NEIGHBOUR_KINDS = ['links', 'for', 'parts', 'packages', 'tasks', 'places'] as const

export function neighbours(ws: ReadWs, ids: Ids, a: NeighboursArgs): ToolResult {
  ws = clean(ws)
  ids.sync(ws)
  const d = derive(ws)
  const r = resolve(ws, ids, a.id, ['card', 'task', 'piece'], undefined, 'card, task or piece')
  if (!('id' in r)) return { text: unclear(a.id, r) }
  const kinds = new Set(a.kinds?.length ? a.kinds : NEIGHBOUR_KINDS)
  const depth = Math.min(3, Math.max(1, a.depth ?? 1))
  type Step = { kind: IdKind; id: string; via: string }
  const next = (kind: IdKind, id: string, first: boolean): Step[] => {
    const out: Step[] = []
    if (kind === 'card') {
      for (const e of d.linksOf.get(id) ?? []) {
        const other = e.fromId === id ? e.toId : e.fromId
        if (!d.cards.has(other)) continue
        const group = e.kind === FOR ? 'for' : e.kind === 'part-of' ? 'parts' : 'links'
        if (!kinds.has(group) && !kinds.has(e.kind)) continue
        out.push({ kind: 'card', id: other, via: e.fromId === id ? `→ ${e.kind}` : `← ${e.kind}` })
      }
      if (kinds.has('packages')) {
        for (const p of d.packagesOf.get(id) ?? []) out.push({ kind: 'card', id: p, via: 'in package' })
        for (const m of d.cards.get(id)?.memberIds ?? []) if (d.cards.has(m)) out.push({ kind: 'card', id: m, via: 'package holds' })
      }
      if (kinds.has('tasks')) for (const t of d.tasksOf.get(id) ?? []) out.push({ kind: 'task', id: t.id, via: 'task for it' })
      if (kinds.has('places')) for (const p of d.planesOf.get(id) ?? []) out.push({ kind: 'piece', id: p, via: 'on plane' })
    } else if (kind === 'task') {
      const t = d.tasks.get(id)!
      if (kinds.has('tasks') && t.cardId && d.cards.has(t.cardId)) out.push({ kind: 'card', id: t.cardId, via: 'its card' })
      if (kinds.has('places') && d.pieces.has(t.pieceId)) out.push({ kind: 'piece', id: t.pieceId, via: 'its deck' })
    } else if (kind === 'piece') {
      const p = d.pieces.get(id)!
      // What a piece holds only from the piece asked about: a plane reached through one card isn't every card on it.
      if (first && kinds.has('places') && p.kind === 'plane') for (const c of d.onPlane.get(id) ?? []) out.push({ kind: 'card', id: c.id, via: 'on it' })
      if (first && kinds.has('tasks') && p.kind === 'kanban') for (const t of shownTasks(ws, d, p)) out.push({ kind: 'task', id: t.id, via: 'in it' })
      if (p.stuckTo && d.pieces.has(p.stuckTo)) out.push({ kind: 'piece', id: p.stuckTo, via: 'stuck to' })
      for (const x of ws.pieces) if (x.stuckTo === id) out.push({ kind: 'piece', id: x.id, via: 'stuck to it' })
    }
    return out
  }
  const seen = new Set([`${r.kind}:${r.id}`])
  const levels: { step: Step; from: string }[][] = []
  let front: { kind: IdKind; id: string }[] = [{ kind: r.kind, id: r.id }]
  for (let i = 0; i < depth && front.length; i++) {
    const level: { step: Step; from: string }[] = []
    for (const f of front)
      for (const s of next(f.kind, f.id, i === 0)) {
        const key = `${s.kind}:${s.id}`
        if (seen.has(key)) continue
        seen.add(key)
        level.push({ step: s, from: ids.short(f.kind, f.id) })
      }
    levels.push(level)
    front = level.map((l) => l.step)
  }
  const label = (s: Step) =>
    s.kind === 'card' ? cardLine(ws, ids, d.cards.get(s.id)!, { links: false, planes: false, tags: false }) : s.kind === 'task' ? taskLine(ws, ids, d.tasks.get(s.id)!) : pieceLine(ws, ids, d.pieces.get(s.id)!)
  const lines: string[] = []
  const max = a.limit ?? 120
  let shown = 0
  let total = 0
  levels.forEach((level, i) => {
    total += level.length
    if (!level.length) return
    lines.push(`## depth ${i + 1} (${level.length})`)
    for (const { step, from } of level) {
      if (shown >= max) continue
      lines.push(`- ${i ? `${from} ` : ''}${step.via}: ${label(step)}`)
      shown++
    }
  })
  const head = r.kind === 'card' ? cardLine(ws, ids, d.cards.get(r.id)!, { links: false }) : r.kind === 'task' ? taskLine(ws, ids, d.tasks.get(r.id)!) : pieceLine(ws, ids, d.pieces.get(r.id)!)
  const more = total > shown ? `Showing ${shown} of ${total}. Narrow with kinds (${NEIGHBOUR_KINDS.join(', ')}, or a link kind like solves) or depth 1.` : undefined
  return finish({ text: [`neighbours of ${r.short} (depth ${depth}${a.kinds?.length ? `, ${a.kinds.join('/')}` : ''}): ${total}`, wrap('workspace', [head, ...lines].join('\n') || '(none)'), ...(more ? [more] : [])].join('\n'), more })
}

// ---- whats_new

export type WhatsNewArgs = { since: number | string; page?: number; limit?: number }

export function whatsNew(ws: ReadWs, ids: Ids, a: WhatsNewArgs): ToolResult {
  ws = clean(ws)
  ids.sync(ws)
  const d = derive(ws)
  const since = typeof a.since === 'number' ? a.since : Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(String(a.since)) ? `${a.since}T00:00:00Z` : String(a.since))
  if (!Number.isFinite(since)) return { text: `whats_new needs a time: a day (2026-10-28), an ISO time or ms; got "${a.since}".` }
  type Item = { group: string; where: string; at: number; line: string }
  const items: Item[] = []
  // `by`: who made it (said only when it's new); `changedBy`: who changed it last, when that's known.
  const add = (group: string, where: string, created: number | undefined, updated: number | undefined, line: string, by?: string, changedBy?: string) => {
    const isNew = (created ?? 0) > since
    const changed = !isNew && (updated ?? 0) > since
    if (!isNew && !changed) return
    items.push({ group, where, at: Math.max(created ?? 0, updated ?? 0), line: `${isNew ? 'new' : 'changed'} ${timeOf(Math.max(created ?? 0, updated ?? 0))}${isNew && by ? ` by ${by}` : !isNew && changedBy ? ` by ${changedBy}` : ''} · ${line}` })
  }
  const where = (pieceId: string | undefined) => (pieceId && d.pieces.get(pieceId) ? `${ids.short('piece', pieceId)} ${q(d.nameById(pieceId), 40)}` : 'the canvas')
  for (const c of ws.cards) {
    const t = ws.times?.[c.id] ?? (c.createdAt || c.updatedAt ? { createdAt: c.createdAt, updatedAt: c.updatedAt, by: undefined } : undefined)
    if (t) add('cards', where(c.pieceId), t.createdAt, t.updatedAt, cardLine(ws, ids, c, { links: false, planes: false }), t.by ? nameOf(d, t.by) : undefined)
  }
  for (const p of ws.pieces) add('pieces', `canvas ${ids.short('canvas', canvasOf(p))}`, p.createdAt, p.updatedAt, pieceLine(ws, ids, p))
  for (const l of ws.labels) add('text', where(l.pieceId === 'canvas' ? undefined : l.pieceId), l.createdAt, undefined, textLine(ws, ids, l, 80), l.author ?? (l.uid ? nameOf(d, l.uid) : undefined))
  for (const t of ws.tasks) add('tasks', where(t.pieceId), t.createdAt, t.updatedAt, taskLine(ws, ids, t), nameOf(d, t.uid))
  for (const v of ws.evidence) add('evidence', where(d.cards.get(v.nodeId)?.pieceId), v.createdAt, undefined, `${ids.short('evidence', v.id)} ${v.stance} on ${ids.short('card', v.nodeId)}: ${q(v.text, 80)}`)
  for (const f of ws.competitorFeatures) add('competitor features', where(d.cards.get(f.competitorId)?.pieceId), f.createdAt, undefined, `${ids.short('feature', f.id)} ${q(f.name, 60)} of ${ids.short('card', f.competitorId)}`)
  for (const x of ws.documents) add('documents', 'documents', x.createdAt, x.updatedAt, `${ids.short('document', x.id)} ${x.kind} ${q(x.title, 60)}`, x.name)
  for (const t of ws.threads) add('comments', where(t.planeId === 'canvas' ? undefined : t.planeId), t.createdAt, t.lastAt, `${ids.short('thread', t.id)} on ${targetName(ids, d, t.on, t.targetId)}${t.lastText ? `: last ${t.lastName ?? ''} ${q(t.lastText, 60)}` : ''}`, t.name, t.lastName)
  const cellsBy = new Map<string, number>()
  for (const c of ws.cells) if ((c.updatedAt ?? 0) > since) cellsBy.set(c.matrixId, (cellsBy.get(c.matrixId) ?? 0) + 1)
  for (const [m, n] of cellsBy) if (d.pieces.has(m)) items.push({ group: 'cells', where: where(m), at: since + 1, line: `${count(n, 'cell')} filled or changed` })
  for (const p of ws.places) if (p.createdAt > since && d.cards.has(p.cardId)) items.push({ group: 'cards brought to planes', where: where(p.planeId), at: p.createdAt, line: `${timeOf(p.createdAt)} · ${ids.short('card', p.cardId)} ${q(d.cards.get(p.cardId)!.title, 50)}` })
  items.sort((x, y) => y.at - x.at)
  const timed = !!ws.times || ws.cards.some((c) => c.createdAt || c.updatedAt)
  if (!items.length) return { text: `Nothing new since ${timeOf(since)} in what the snapshot carries.${timed ? '' : ' (Cards don\'t carry their times here; edits to cards show only through their tasks, evidence and comments.)'}` }
  const pg = pageOf(items, a.page, a.limit ?? 60)
  const groups = new Map<string, string[]>()
  for (const it of pg.items) {
    const k = `${it.group} · ${it.where}`
    groups.set(k, [...(groups.get(k) ?? []), `- ${it.line}`])
  }
  const body = [...groups].flatMap(([k, l]) => [`## ${k}`, ...l]).join('\n')
  const more = pageLine(items.length, pg, 'Changes', 'Or ask from a later time.')
  const note = timed ? ' Who changed a card is not known yet (the change log comes later).' : " Cards don't carry their own times here: a card's edits show through its tasks, evidence and comments (the change log comes later)."
  return finish({ text: [`whats_new since ${timeOf(since)}: ${count(items.length, 'change')}.${note}`, wrap('workspace', body), ...(more ? [more] : [])].join('\n'), more })
}

// ---- where_am_i

export type WhereView = Pick<View, 'canvas' | 'focus' | 'selection' | 'piece' | 'tasks' | 'panel' | 'beside' | 'side'> & { arrived?: boolean }

export function whereAmI(ws: ReadWs, ids: Ids, v: WhereView): ToolResult {
  ws = clean(ws)
  ids.sync(ws)
  const d = derive(ws)
  const out: string[] = ['## Where the person is now']
  const c = ws.canvases.find((x) => x.id === v.canvas)
  out.push(`canvas: ${ids.short('canvas', v.canvas)} ${q(c?.name ?? v.canvas, 40)}`)
  const focus = v.focus ? d.pieces.get(v.focus) : undefined
  out.push(focus ? `in focus: ${pieceLine(ws, ids, focus)}${v.arrived === false ? ' (still arriving)' : ''}` : 'in focus: nothing (the whole canvas)')
  if (v.beside.length) out.push(`beside it: ${v.beside.map((b) => (d.pieces.get(b) ? pieceLine(ws, ids, d.pieces.get(b)!) : b)).join(' · ')}`)
  if (v.side) {
    const tab = d.pieces.get(v.side.tab)
    out.push(`tasks side view: ${tab ? `${ids.short('piece', tab.id)} ${q(d.pieceName(tab), 40)}` : v.side.tab}${v.side.days ? ' with days' : ''}${v.side.linked && d.pieces.get(v.side.linked) ? ` · linked to ${ids.short('piece', v.side.linked)}` : ''}`)
  }
  const picked = [...v.selection, ...(v.piece ? [v.piece] : []), ...v.tasks]
  const full = picked.length <= 3
  const details: string[] = []
  if (picked.length) {
    out.push(`selected (${picked.length}): ${picked.slice(0, 40).map((id) => { const r = resolve(ws, ids, id); return 'id' in r ? r.short : id }).join(', ')}${picked.length > 3 ? ' (concise below)' : ' (in full below)'}`)
    for (const id of picked.slice(0, 12)) {
      const r = resolve(ws, ids, id)
      if (!('id' in r)) continue
      details.push(wrap(r.kind === 'task' ? nameOf(d, d.tasks.get(r.id)!.uid) : 'workspace', describe(ws, ids, r.kind, r.id, full).text))
    }
    if (picked.length > 12) details.push(`… and ${picked.length - 12} more selected`)
  } else out.push('selected: nothing')
  if (v.panel) {
    const id = 'card' in v.panel ? v.panel.card : v.panel.task
    const r = resolve(ws, ids, id, ['card', 'task'])
    if ('id' in r) out.push(`panel open: ${r.short}${picked.includes(id) ? ' (selected, below)' : ''}`)
    if ('id' in r && !picked.includes(id)) details.push(wrap('workspace', describe(ws, ids, r.kind, r.id, true).text))
  }
  return finish({ text: [...out, ...details].join('\n') })
}

// ---- The tools as a list (S12/S13 build the model's tool definitions from it)

// `args`: a JSON Schema object (properties, enums, required), ready to become a tool's parameters.
export type JsonSchema = { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties: false }
export type ReadTool = { name: string; summary: string; args: JsonSchema; run: (ws: ReadWs, ids: Ids, args: never) => ToolResult }

const ID_NOTE = 'Ids are short and typed (c card, p piece, x text, t task, d document, k canvas, u person, e link, v evidence, f competitor feature, m comment thread); a title or name works too, and an unclear one returns candidates.'

const str = (description: string) => ({ type: 'string', description })
const strs = (description: string, values?: readonly string[]) => ({
  anyOf: [values ? { type: 'string', enum: [...values] } : { type: 'string' }, { type: 'array', items: values ? { type: 'string', enum: [...values] } : { type: 'string' } }],
  description,
})
const bool = (description: string) => ({ type: 'boolean', description })
const int = (description: string, minimum = 1, maximum?: number) => ({ type: 'integer', minimum, ...(maximum ? { maximum } : {}), description })
const day = (description: string) => ({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description })
const obj = (properties: Record<string, unknown>, required: string[] = []): JsonSchema => ({ type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false })
const paging = { page: int('which page, from 1'), limit: int('how many a page', 1, 500) }

export const READ_TOOLS: ReadTool[] = [
  {
    name: 'search',
    summary: `Words over every title, field, note, evidence, task, text, matrix/table cell, document and comment; results grouped by where they are, with short ids and a snippet. ${ID_NOTE}`,
    args: obj({ query: str('the words; every word must be there (else some of them)'), kinds: { type: 'array', items: { type: 'string', enum: [...SEARCH_KINDS] }, description: 'only these kinds' }, scope: str('a plane, deck, matrix, table or canvas (id or name), or "everywhere"'), ...paging }, ['query']),
    run: search as ReadTool['run'],
  },
  {
    name: 'query',
    summary: `Typed filter, one line each. kind card (default): type, status, tag, region, plane, priority, has_evidence, no_evidence, contradicting, linked_to, for (a customer), on_canvas, title. kind task: deck (what the deck shows), column, assignee, priority, due_before/after, overdue, type (of its card), for/linked_to (its card), tag (labels), plane, on_canvas, title. kind comment: resolved, on, by, plane, for, title. kind text/piece/document: type, plane, on_canvas, title. A filter that doesn't fit the kind, or a value that isn't one, is refused with the allowed list. ${ID_NOTE}`,
    args: obj({
      kind: { type: 'string', enum: [...QUERY_KINDS] },
      type: strs("a card's type (cards, and tasks by their card), a text's kind, a piece's kind or a document's kind", [...new Set([...CARD_KINDS, ...TEXT_KINDS, ...PIECE_KINDS, ...DOC_KINDS])]),
      status: strs('a card status', ALL_STATUSES),
      tag: strs("a card's tag, a task's label (no #)"),
      region: strs("a competitor's region (Germany counts inside DACH, EU, Europe, Global)"),
      plane: str('a plane (id or name)'),
      deck: str('a deck (id or name)'),
      column: str("a deck column's name"),
      priority: strs('P1–P3', PRIORITIES),
      assignee: str('a person (name, email, "me") or "nobody"'),
      has_evidence: bool('only cards with evidence'),
      no_evidence: bool('only cards without evidence'),
      contradicting: bool("only cards whose status and evidence disagree (`!`)"),
      linked_to: str('a card it is linked to (tasks: its card)'),
      for: str('a customer it is tagged for (tasks, comments: its card)'),
      due_before: day('due before this day'),
      due_after: day('due after this day'),
      overdue: bool('past due and not finished'),
      on_canvas: str('a canvas (id or name)'),
      title: str('words the title holds'),
      resolved: bool('comments: resolved (true) or open (false)'),
      on: strs('comments: on what', THREAD_ON),
      by: str('comments: someone who wrote in it'),
      ...paging,
    }),
    run: query as ReadTool['run'],
  },
  {
    name: 'get',
    summary: `Everything about items: fields, status and evidence, links both ways, parts, packages, tasks, planes it's on, comments; a piece's setup in words; a task's every field. ${ID_NOTE}`,
    args: obj({ ids: { type: 'array', items: { type: 'string' }, maxItems: 40, description: 'short ids, real ids or titles' }, detail: { type: 'string', enum: ['concise', 'full'] } }, ['ids']),
    run: get as ReadTool['run'],
  },
  {
    name: 'view',
    summary: 'A piece as markdown: a plane by sections and headings with its cards, text and links; a matrix or table as a table; a deck as columns; a timeline by days; documents as a list; a document as text. Paged.',
    args: obj({ piece: str('a piece (id or name)'), page: int('which page (rows, lines)'), col_page: int("a matrix's columns, 8 a page") }, ['piece']),
    run: view as ReadTool['run'],
  },
  {
    name: 'neighbours',
    summary: "What's around a card, task or piece, up to depth 3: links (by kind), for, parts, packages, tasks, planes.",
    args: obj({ id: str('a card, task or piece'), kinds: { type: 'array', items: { type: 'string' }, description: `${NEIGHBOUR_KINDS.join(', ')}, or a link kind (solves, competes-with, inspired-by, part-of, depends-on, contradicts, relates, for)` }, depth: int('how far, 1–3', 1, 3), limit: int('most shown', 1, 500) }, ['id']),
    run: neighbours as ReadTool['run'],
  },
  {
    name: 'read_document',
    summary: "A document's text by lines or a section by its heading; with no range, the contents and the start.",
    args: obj({ id: str('a document (id or title)'), range: str('lines "40-120", or "page 2"'), from: int('first line'), to: int('last line'), section: str('a heading') }, ['id']),
    run: readDocument as ReadTool['run'],
  },
  {
    name: 'whats_new',
    summary: 'What was made or changed since a time, grouped by kind and where, by whom when known.',
    args: obj({ since: { anyOf: [{ type: 'string', description: 'a day (2026-10-28) or an ISO time' }, { type: 'number', description: 'ms since 1970' }] }, ...paging }, ['since']),
    run: whatsNew as ReadTool['run'],
  },
]

export type { ViewArgs, ReadDocArgs }
