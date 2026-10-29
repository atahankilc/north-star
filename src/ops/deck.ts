// Deck and timeline setup ops (S8, D-312; docs/specs/agent-actions.md §13, §14): a deck's setup from typed arguments
// (create_piece's `deck`), update_deck (what it holds, which cards and by what, box names, lanes; switching to cards
// with tasks on it moves them first, D-300), its columns (create_deck_column, update_deck_column, move_deck_column,
// delete), and update_timeline (its rows). Every column write reads the deck's columns from the snapshot and changes
// one (R7: the components rewrote the whole array).
//
// The model sees `deck`; the data keeps `kanban` (D-301).
import { KANBAN_TEMPLATES } from '../model/kanbanCards'
import { CARD_FIELDS, type CardField } from '../model/shapes'
import { MAX_ITEMS } from '../model/source'
import { candidates } from '../model/lens'
import { tasksIn } from '../model/tasks'
import { PIECE_NAME_MAX, PIECE_SIZE } from '../model/pieces'
import { MAIN, canvasOf } from '../model/canvases'
import { GRID, snap } from '../model/grid'
import { piecesShown } from '../model/textPlace'
import { nearClearIn } from '../model/pieceMoves'
import type { Piece } from '../data/model'
import type { BoxName, KanbanCol, KanbanSetup, Task, TimelineSetup } from '../data/tasks'
import { DELETE, type OpCtx, type Plan, type Write } from './types'
import { cardIn, find, handleOf, refuse } from './util'
import { rulesFrom, type RuleSpec } from './table'
import { shortId } from './matrix'
import { colsOf, columnIn, deckIn, tasksOf } from './tasks'

type P = Piece & { id: string }

export const KANBAN_COLS_MAX = 12
export const COL_NAME_MAX = 40
export const LIMIT_MAX = 99
export const BOX_NAMES_MAX = 40
export const BOX_NAME_MAX = 40
export const DECK_TEMPLATES = KANBAN_TEMPLATES.map((t) => t.key)
export const LANES = ['assignee', 'card'] as const
// A timeline's rows as the model says them: by deck (stored as none), by who, by card.
export const TIMELINE_ROWS_SAID = ['deck', 'assignee', 'card'] as const

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const deckName = (d: P) => d.name || d.id
const setupOf = (d: P): KanbanSetup => (d.kanban as KanbanSetup | undefined) ?? { cols: [] }
// Holding cards with nothing said: the features-by-status template's (KanbanSetup.tsx' CARDS_START).
const CARDS_START = KANBAN_TEMPLATES.find((t) => t.key === 'features')!.setup() as Required<Pick<KanbanSetup, 'colField' | 'source'>>

// ---- Pieces of a setup, checked

const limitOf = (op: string, v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 1) refuse(op, 'a limit is a number of tasks, 1 or more', `give 1–${LIMIT_MAX}, or null to take it away`)
  return Math.min(LIMIT_MAX, Math.round(v))
}

const colName = (op: string, v: unknown): string => {
  const name = typeof v === 'string' ? v.trim().slice(0, COL_NAME_MAX) : ''
  if (!name) refuse(op, 'a column needs a name', `give it a name (≤ ${COL_NAME_MAX} characters)`)
  return name
}

// A column as the piece keeps it (setKanbanCols' cleaning).
const cleanCol = (c: KanbanCol): KanbanCol => ({ id: c.id, name: c.name.slice(0, COL_NAME_MAX), ...(c.done ? { done: true } : {}), ...(c.limit ? { limit: Math.min(LIMIT_MAX, Math.max(1, Math.round(c.limit))) } : {}) })

const fieldOf = (op: string, what: string, v: unknown): CardField => {
  if (!(CARD_FIELDS as readonly unknown[]).includes(v)) refuse(op, `${String(v)} isn't a field ${what} can come from`, `use one of ${CARD_FIELDS.join(', ')}`)
  return v as CardField
}

export type BoxNameSpec = { col: string; row: string; name?: string; tone?: 'good' | 'bad' }

function boxNamesFrom(op: string, v: unknown): BoxName[] {
  if (!Array.isArray(v)) refuse(op, 'names are a list', 'give names: [{ col, row, name, tone }] (col and row: the two fields\' values)')
  if (v.length > BOX_NAMES_MAX) refuse(op, `at most ${BOX_NAMES_MAX} box names`, 'name fewer boxes')
  return v.map((x: unknown) => {
    const b = x as BoxNameSpec
    if (!b || typeof b.col !== 'string' || typeof b.row !== 'string') refuse(op, 'a box name says its col and row', 'give { col, row, name }: the column field\'s value and the row field\'s value (`-` for no value)')
    if (b.tone !== undefined && b.tone !== 'good' && b.tone !== 'bad') refuse(op, `${String(b.tone)} isn't a tone`, "use 'good' or 'bad', or leave it out")
    const name = typeof b.name === 'string' ? b.name.slice(0, BOX_NAME_MAX) : ''
    if (!name.trim() && !b.tone) refuse(op, 'a box name needs a name or a tone', 'give name, tone or both')
    return { col: b.col.slice(0, 40), row: b.row.slice(0, 40), name, ...(b.tone ? { tone: b.tone } : {}) }
  })
}

// Which cards (a deck holding cards): rules, and cards by hand.
function sourceFrom(ctx: OpCtx, op: string, rules: unknown, cards: unknown, was?: KanbanSetup['source']): NonNullable<KanbanSetup['source']> {
  const out = clone(was ?? CARDS_START.source)
  if (rules !== undefined) out.rules = rulesFrom(ctx, op, rules)
  if (cards !== undefined) {
    if (!Array.isArray(cards)) refuse(op, 'cards are a list of card ids', 'give cards: ["…"]')
    if (cards.length > MAX_ITEMS) refuse(op, `at most ${MAX_ITEMS} cards by hand`, 'use rules instead')
    out.items = cards.map((id) => {
      const c = cardIn(ctx, op, id)
      return { id: shortId(ctx), cardType: c.type, cardId: c.id }
    })
  }
  return out
}

// ---- create_piece's typed `deck`

export type DeckSpec = {
  template?: string
  holds?: 'tasks' | 'cards'
  // Its columns (tasks), by name or { name, limit, done }; left out, todo · doing · done.
  columns?: (string | { name: string; limit?: number; done?: boolean })[]
  // The finished column, by name.
  finished?: string
  lanes?: 'assignee' | 'card'
  // Holding cards: which (rules, cards by hand), its columns' field and its rows' field, its boxes' names.
  rules?: RuleSpec[]
  cards?: string[]
  col_field?: CardField
  row_field?: CardField
  names?: BoxNameSpec[]
}

export function deckSetupFrom(ctx: OpCtx, op: string, spec: unknown): KanbanSetup {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) refuse(op, 'deck is an object', 'give deck: { template?, holds?, columns?, … }')
  const s = spec as DeckSpec
  const id = () => shortId(ctx)
  let t: Partial<KanbanSetup> = {}
  if (s.template !== undefined) {
    const tpl = KANBAN_TEMPLATES.find((x) => x.key === s.template)
    if (!tpl) refuse(op, `there is no deck template ${String(s.template)}`, `use one of ${DECK_TEMPLATES.join(', ')}`)
    t = clone(tpl.setup())
  }
  const setup: KanbanSetup = { cols: [{ id: id(), name: 'todo' }, { id: id(), name: 'doing' }, { id: id(), name: 'done', done: true }], ...t }
  if (s.holds !== undefined && s.holds !== 'tasks' && s.holds !== 'cards') refuse(op, `a deck holds tasks or cards, not ${String(s.holds)}`, "say holds: 'tasks' or 'cards'")
  if (s.holds === 'tasks') for (const k of ['holds', 'source', 'colField', 'rowField', 'names'] as const) delete setup[k]
  const cards = s.holds === 'cards' || (s.holds === undefined && setup.holds === 'cards')
  if (s.columns !== undefined) {
    if (!Array.isArray(s.columns) || !s.columns.length) refuse(op, 'columns are a list of names', 'give columns: ["todo", "doing", "done"]')
    if (s.columns.length > KANBAN_COLS_MAX) refuse(op, `a deck has at most ${KANBAN_COLS_MAX} columns`, 'use fewer columns')
    setup.cols = s.columns.map((c) => {
      const x = typeof c === 'string' ? { name: c } : c
      return { id: id(), name: colName(op, x?.name), ...(x.done ? { done: true } : {}), ...(x.limit !== undefined ? { limit: limitOf(op, x.limit) } : {}) }
    })
  }
  if (s.finished !== undefined) {
    const f = columnIn(op, { id: 'new', kanban: setup } as unknown as P, s.finished)
    setup.cols = setup.cols.map((c) => ({ ...c, done: c.id === f.id ? true : undefined })).map(cleanCol)
  }
  if (s.lanes !== undefined) {
    if (!(LANES as readonly unknown[]).includes(s.lanes)) refuse(op, `lanes are by assignee or card, not ${String(s.lanes)}`, "say lanes: 'assignee' or 'card', or leave it out")
    setup.rows = s.lanes
  }
  const cardOnly = (['rules', 'cards', 'col_field', 'row_field', 'names'] as const).filter((k) => s[k] !== undefined)
  if (!cards && cardOnly.length) refuse(op, `${cardOnly.join(', ')} are for a deck holding cards`, "say holds: 'cards' (or template: features or priorities), or leave them out")
  if (cards) {
    setup.holds = 'cards'
    setup.source = sourceFrom(ctx, op, s.rules, s.cards, setup.source)
    setup.colField = s.col_field !== undefined ? fieldOf(op, 'its columns', s.col_field) : (setup.colField ?? CARDS_START.colField)
    if (s.row_field !== undefined) setup.rowField = fieldOf(op, 'its rows', s.row_field)
    if (setup.rowField && setup.rowField === setup.colField) refuse(op, 'its rows and columns come from the same field', 'give row_field another field, or leave it out')
    if (s.names !== undefined) setup.names = boxNamesFrom(op, s.names)
  }
  return setup
}

// ---- update_deck

export type UpdateDeckArgs = {
  id: string
  holds?: 'tasks' | 'cards'
  rules?: RuleSpec[]
  cards?: string[]
  col_field?: CardField
  row_field?: CardField | null
  names?: BoxNameSpec[] | null
  lanes?: 'assignee' | 'card' | null
  // Holding cards, the tasks on it go first (D-300): to a new deck of tasks next to it (its columns), or to this deck
  // (each into the column of the same name, else its first, after what's there).
  tasks_to?: string
  // The UI's patch of the stored setup as its editors give it (undefined takes a field away); instead of the above.
  setup?: Partial<KanbanSetup>
  // The UI's moves of the tasks (KanbanSetup.tsx' moveTo, as it worked them out); with tasks_to a deck.
  moves?: { id: string; pieceId: string; col: string; order: number }[]
  handle?: string
  label?: string
}

export function updateDeck(ctx: OpCtx, args: UpdateDeckArgs): Plan {
  const op = 'update_deck'
  const d = deckIn(ctx, op, args.id)
  const was = setupOf(d)
  const patch: Record<string, unknown> = {}
  const set = (k: string, v: unknown) => (patch[`kanban.${k}`] = v === undefined || v === null ? DELETE : clone(v))
  const said: string[] = []
  const writes: Write[] = []
  const ids: Record<string, string> = {}

  if (args.setup) {
    for (const [k, v] of Object.entries(args.setup)) set(k, k === 'cols' && Array.isArray(v) ? (v as KanbanCol[]).slice(0, KANBAN_COLS_MAX).map(cleanCol) : v)
  }
  if (args.holds !== undefined && args.holds !== 'tasks' && args.holds !== 'cards') refuse(op, `a deck holds tasks or cards, not ${String(args.holds)}`, "say holds: 'tasks' or 'cards'")
  const wasCards = was.holds === 'cards'
  const cards = args.holds === 'cards' || (args.setup && 'holds' in args.setup ? args.setup.holds === 'cards' : args.holds === undefined && wasCards)
  if (args.holds === 'cards' && !wasCards) {
    set('holds', 'cards')
    said.push('hold cards on a deck')
    if (!was.colField && args.col_field === undefined) set('colField', CARDS_START.colField)
    if (!was.source && args.rules === undefined && args.cards === undefined) set('source', CARDS_START.source)
  }
  if (args.holds === 'tasks' && wasCards) (set('holds', undefined), said.push('hold tasks on a deck'))
  const cardOnly = (['rules', 'cards', 'col_field', 'row_field', 'names'] as const).filter((k) => args[k] !== undefined)
  if (!cards && cardOnly.length) refuse(op, `${cardOnly.join(', ')} are for a deck holding cards`, "say holds: 'cards' too, or leave them out")
  if (args.rules !== undefined || args.cards !== undefined) (set('source', sourceFrom(ctx, op, args.rules, args.cards, was.source)), said.push('choose a deck’s cards'))
  if (args.col_field !== undefined) (set('colField', fieldOf(op, 'its columns', args.col_field)), said.push('change a deck’s columns'))
  if (args.row_field !== undefined) {
    const f = args.row_field === null ? null : fieldOf(op, 'its rows', args.row_field)
    if (f && f === (args.col_field ?? was.colField ?? CARDS_START.colField)) refuse(op, 'its rows and columns come from the same field', 'give row_field another field, or null for no rows')
    set('rowField', f)
    said.push(f ? 'a deck’s rows' : 'no rows on a deck')
  }
  if (args.names !== undefined) (set('names', args.names === null ? null : boxNamesFrom(op, args.names)), said.push('name a deck’s boxes'))
  if (args.lanes !== undefined) {
    if (args.lanes !== null && !(LANES as readonly unknown[]).includes(args.lanes)) refuse(op, `lanes are by assignee or card, not ${String(args.lanes)}`, "say lanes: 'assignee', 'card' or null")
    set('rows', args.lanes)
    said.push(args.lanes ? `lanes by ${args.lanes === 'assignee' ? 'who' : 'card'}` : 'no lanes')
  }

  // Its tasks, never hidden (D-300): switching to cards with tasks on it, they go somewhere first.
  const held = tasksOf(ctx, d.id)
  if (args.tasks_to !== undefined || args.moves) {
    if (!cards) refuse(op, `the deck ${deckName(d)} holds tasks: its tasks stay`, 'to move tasks to another deck, use move_task with deck')
    if (!held.length) refuse(op, `the deck ${deckName(d)} has no tasks to move`, 'leave tasks_to out')
    if (args.moves) {
      for (const m of args.moves) {
        const to = deckIn(ctx, op, m.pieceId, true)
        if (to.id === d.id) refuse(op, 'the tasks go to another deck', 'name another deck')
        writes.push({ coll: 'tasks', id: find(held, op, m.id, 'task on that deck').id, patch: { pieceId: to.id, col: columnIn(op, to, m.col).id, order: m.order, updatedAt: ctx.now } })
      }
    } else if (args.tasks_to === 'new_deck') {
      const made = newDeckFor(ctx, d, held)
      writes.push(...made.writes)
      ids[handleOf(args, '$deck')] = made.id
      said.unshift(`move ${tasksWord(held.length)} to a new deck`)
    } else {
      const to = deckIn(ctx, op, args.tasks_to, true)
      if (to.id === d.id) refuse(op, 'the tasks go to another deck', "name another deck, or 'new_deck'")
      writes.push(...movesTo(ctx, d, to, held))
      said.unshift(`move ${tasksWord(held.length)} to ${to.name || 'a deck'}`)
    }
  } else if (cards && !wasCards && held.length)
    refuse(
      op,
      `the deck ${deckName(d)} holds ${tasksWord(held.length)}: switched to cards they would be hidden`,
      "say tasks_to: 'new_deck' (they move to a new deck of tasks next to it, with its columns) or a deck's id or name (each into the column of the same name); or make a new deck for the cards instead (create_piece kind: deck, holds: cards)",
    )

  if (Object.keys(patch).length) writes.unshift({ coll: 'pieces', id: d.id, patch: { ...patch, updatedAt: ctx.now } })
  if (!writes.length) refuse(op, 'nothing to change', 'give holds, rules, cards, col_field, row_field, names or lanes')
  return { op, label: args.label ?? (said.length ? said.join(', ') : 'change a deck'), writes, ids, meta: { kind: 'kanban' } }
}

const tasksWord = (n: number) => `${n} task${n === 1 ? '' : 's'}`

// Each into `to`'s column of the same name, else its first; after what's already in it, in the order they had
// (KanbanSetup.tsx' moveTo).
export function movesTo(ctx: OpCtx, from: P, to: P, held: Task[]): Write[] {
  const cols = colsOf(to)
  const there = (name?: string) => cols.find((c) => c.name.trim().toLowerCase() === name?.trim().toLowerCase()) ?? cols[0]
  const last = new Map(cols.map((c) => [c.id, Math.max(0, ...tasksIn(tasksOf(ctx, to.id), c.id).map((t) => t.order))]))
  const fromCols = colsOf(from)
  const ordered = fromCols.flatMap((c) => tasksIn(held, c.id)).concat(held.filter((t) => !fromCols.some((c) => c.id === t.col)))
  return ordered.map((t) => {
    const col = there(fromCols.find((c) => c.id === t.col)?.name)
    const order = (last.get(col.id) ?? 0) + 1
    last.set(col.id, order)
    return { coll: 'tasks', id: t.id, patch: { pieceId: to.id, col: col.id, order, updatedAt: ctx.now } }
  })
}

// A new deck of tasks next to `d` (its columns, the same ids, so each task keeps its column and order), its tasks moved.
function newDeckFor(ctx: OpCtx, d: P, held: Task[]): { id: string; writes: Write[] } {
  const canvas = canvasOf(d)
  const size = PIECE_SIZE.kanban
  const shown = piecesShown(canvas, ctx.ws.pieces as P[], ctx.ws.spots)
  const at = shown.find((p) => p.id === d.id) ?? d
  const spot = nearClearIn({ x: snap(at.x + at.w + 4 * GRID), y: snap(at.y), ...size }, shown)
  const id = ctx.newId()
  const cols = colsOf(d).length ? colsOf(d).map(cleanCol) : [{ id: shortId(ctx), name: 'todo' }]
  const name = `${d.name || 'deck'} · tasks`.slice(0, PIECE_NAME_MAX)
  const writes: Write[] = [
    { coll: 'pieces', id, set: { kind: 'kanban', ...spot, ...size, name, kanban: { cols }, ...(canvas !== MAIN ? { canvasId: canvas } : {}), createdAt: ctx.now, updatedAt: ctx.now } },
    ...held.map((t): Write => ({ coll: 'tasks', id: t.id, patch: { pieceId: id, ...(cols.some((c) => c.id === t.col) ? {} : { col: cols[0].id }), updatedAt: ctx.now } })),
  ]
  return { id, writes }
}

// ---- Columns

const colsWrite = (ctx: OpCtx, d: P, cols: KanbanCol[]): Write => ({ coll: 'pieces', id: d.id, patch: { 'kanban.cols': cols.map(cleanCol), updatedAt: ctx.now } })

export type CreateDeckColumnArgs = { deck: string; name: string; limit?: number; done?: boolean; id?: string; handle?: string; label?: string }

// At the end of the deck's columns.
export function createDeckColumn(ctx: OpCtx, args: CreateDeckColumnArgs): Plan {
  const op = 'create_deck_column'
  const d = deckIn(ctx, op, args.deck)
  const cols = colsOf(d)
  if (cols.length >= KANBAN_COLS_MAX) refuse(op, `the deck ${deckName(d)} has ${KANBAN_COLS_MAX} columns, the most it can`, 'take one away first, or rename one')
  const id = typeof args.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(args.id) && !cols.some((c) => c.id === args.id) ? args.id : shortId(ctx)
  const col: KanbanCol = { id, name: colName(op, args.name), ...(args.done ? { done: true } : {}), ...(args.limit !== undefined ? { limit: limitOf(op, args.limit) } : {}) }
  // A column lives on its deck, not as a doc of its own: its id is said in meta, not made (ids lists made docs).
  return { op, label: args.label ?? 'add a column', writes: [colsWrite(ctx, d, [...cols, col])], ids: {}, meta: { kind: 'kanban', ids: [id] } }
}

export type UpdateDeckColumnArgs = { deck: string; column: string; name?: string; limit?: number | null; done?: boolean; label?: string }

export function updateDeckColumn(ctx: OpCtx, args: UpdateDeckColumnArgs): Plan {
  const op = 'update_deck_column'
  const d = deckIn(ctx, op, args.deck)
  const c = columnIn(op, d, args.column)
  const next: KanbanCol = { ...c }
  const said: string[] = []
  if (args.name !== undefined) (next.name = colName(op, args.name), said.push('rename a column'))
  if (args.limit !== undefined) {
    if (args.limit === null) delete next.limit
    else next.limit = limitOf(op, args.limit)
    said.push(args.limit === null ? 'take a column’s limit away' : 'set a column’s limit')
  }
  if (args.done !== undefined) {
    if (typeof args.done !== 'boolean') refuse(op, 'done is true or false', 'say done: true for the finished column')
    if (args.done) next.done = true
    else delete next.done
    said.push(args.done ? 'mark a finished column' : 'unmark a finished column')
  }
  if (!said.length) refuse(op, 'nothing to change', 'give name, limit or done')
  return { op, label: args.label ?? (said.length === 1 ? said[0] : 'change a column'), writes: [colsWrite(ctx, d, colsOf(d).map((x) => (x.id === c.id ? next : x)))], ids: {}, meta: { kind: 'kanban' } }
}

export type MoveDeckColumnArgs = { deck: string; column: string; by: 'left' | 'right'; label?: string }

export function moveDeckColumn(ctx: OpCtx, args: MoveDeckColumnArgs): Plan {
  const op = 'move_deck_column'
  const d = deckIn(ctx, op, args.deck)
  const c = columnIn(op, d, args.column)
  const by = args.by === 'left' ? -1 : args.by === 'right' ? 1 : 0
  if (!by) refuse(op, 'by is left or right', "say by: 'left' or 'right'")
  const cols = colsOf(d).slice()
  const i = cols.findIndex((x) => x.id === c.id)
  const j = i + by
  if (j < 0 || j >= cols.length) refuse(op, `it's the ${by < 0 ? 'first' : 'last'} column already`, `move it ${by < 0 ? 'right' : 'left'}, or leave it`)
  ;[cols[i], cols[j]] = [cols[j], cols[i]]
  return { op, label: args.label ?? 'move a column', writes: [colsWrite(ctx, d, cols)], ids: {}, meta: { kind: 'kanban' } }
}

// A column found by its id alone (delete, rename): on the deck said, else the one deck that has it.
export function columnById(ctx: OpCtx, op: string, id: string, deck?: string): { deck: P; col: KanbanCol } | null {
  if (deck !== undefined) {
    const d = deckIn(ctx, op, deck)
    return { deck: d, col: columnIn(op, d, id) }
  }
  const found = (ctx.ws.pieces as P[]).filter((p) => p.kind === 'kanban').flatMap((p) => colsOf(p).filter((c) => c.id === id).map((col) => ({ deck: p, col })))
  if (found.length > 1) refuse(op, `${id} is a column on ${found.length} decks`, `say which deck: ${candidates(found.map((f) => `${f.deck.name || '(unnamed)'} [${f.deck.id}]`))}`)
  return found[0] ?? null
}

// A column taken away: its tasks go to the end of the one before it (or after, for the first), in their order. The last
// column never goes.
export function deleteColumnPlan(ctx: OpCtx, d: P, col: KanbanCol, op = 'delete'): Plan {
  const cols = colsOf(d)
  const i = cols.findIndex((c) => c.id === col.id)
  if (cols.length < 2) refuse(op, `it's the deck's only column`, 'rename it instead, or add another first')
  const to = cols[i > 0 ? i - 1 : 1].id
  const mine = tasksOf(ctx, d.id)
  const moving = tasksIn(mine, col.id)
  const last = tasksIn(mine, to).at(-1)?.order ?? 0
  const writes: Write[] = [
    { coll: 'pieces', id: d.id, patch: { 'kanban.cols': cols.filter((c) => c.id !== col.id), updatedAt: ctx.now } },
    ...moving.map((t, k): Write => ({ coll: 'tasks', id: t.id, patch: { col: to, order: last + k + 1, updatedAt: ctx.now } })),
  ]
  return { op, label: 'delete a column', writes, ids: {}, meta: { kind: 'kanban' } }
}

// ---- update_timeline

export type UpdateTimelineArgs = {
  id: string
  // Its rows: by deck (none stored), by who a task is given to, by card.
  rows?: (typeof TIMELINE_ROWS_SAID)[number] | 'kanban' | null
  // The UI's patch as setTimeline took it (undefined or [] takes a field away).
  setup?: TimelineSetup
  label?: string
}

export function updateTimeline(ctx: OpCtx, args: UpdateTimelineArgs): Plan {
  const op = 'update_timeline'
  const p = find(ctx.ws.pieces as P[], op, args.id, 'piece')
  if (p.kind !== 'timeline') refuse(op, `${p.id} is ${p.kind === 'kanban' ? 'a deck' : `a ${p.kind ?? 'plane'}`}, not a timeline`, 'give the id of a timeline')
  const patch: Record<string, unknown> = {}
  if (args.setup) for (const [k, v] of Object.entries(args.setup)) patch[`timeline.${k}`] = v === undefined || (Array.isArray(v) && !v.length) ? DELETE : clone(v)
  if (args.rows !== undefined) {
    if (args.rows !== null && !([...TIMELINE_ROWS_SAID, 'kanban'] as readonly unknown[]).includes(args.rows)) refuse(op, `rows are by deck, assignee or card, not ${String(args.rows)}`, "say rows: 'deck', 'assignee' or 'card'")
    patch['timeline.rows'] = args.rows === null || args.rows === 'deck' || args.rows === 'kanban' ? DELETE : args.rows
  }
  if (!Object.keys(patch).length) refuse(op, 'nothing to change', 'give rows')
  return { op, label: args.label ?? 'change a timeline’s rows', writes: [{ coll: 'pieces', id: p.id, patch: { ...patch, updatedAt: ctx.now } }], ids: {}, meta: { kind: 'timeline' } }
}
