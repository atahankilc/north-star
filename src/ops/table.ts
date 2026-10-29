// Table ops (S7, D-312; docs/specs/agent-actions.md §12): a table's setup from typed arguments (create_piece's `table`:
// rules, cards and names by hand, columns) and update_table (a template, its rules, only-by-hand, sort, page size).
// Rows, columns and cells are src/ops/lens.ts' (shared with matrices).
import { CARD_TYPES } from '../model/cards'
import { FIELDS, OWN_KINDS, COL_W, type Field, type OwnKind } from '../model/shapes'
import { MAX_ITEMS, MAX_RULES, MAX_VALUES, RULE_FIELDS, STATUSES, type Rule, type RuleField, type Source, type SourceItem } from '../model/source'
import { COL_NAME_MAX, MAX_COLS, NAME_COL, TEMPLATES, colName, type Column, type TableSetup } from '../model/table'
import { candidates, findCol } from '../model/lens'
import type { Piece } from '../data/model'
import { DELETE, type OpCtx, type Plan } from './types'
import { find, refuse } from './util'
import { planeRef, shortId, stepsFrom, tidy, type StepSpec } from './matrix'

type P = Piece & { id: string }

export const TABLE_TEMPLATES = TEMPLATES.map((t) => t.key)
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

// ---- Rules

export type RuleSpec = { field: RuleField; not?: boolean; values: string[] }

export function rulesFrom(ctx: OpCtx, op: string, v: unknown): Rule[] {
  if (!Array.isArray(v)) refuse(op, 'rules are a list', 'give [{ field, not, values }]')
  if (v.length > MAX_RULES) refuse(op, `at most ${MAX_RULES} rules`, 'use fewer rules')
  return v.map((x: unknown) => {
    const r = x as RuleSpec
    if (!r || !(RULE_FIELDS as readonly unknown[]).includes(r.field)) refuse(op, `${String(r?.field)} isn't a rule's field`, `use one of ${RULE_FIELDS.join(', ')}`)
    const raw = typeof (r.values as unknown) === 'string' ? [r.values as unknown as string] : r.values
    if (!Array.isArray(raw) || !raw.every((s) => typeof s === 'string')) refuse(op, `the ${r.field} rule's values are a list of text`, 'give values: ["…"]')
    if (raw.length > MAX_VALUES) refuse(op, `a rule takes at most ${MAX_VALUES} values`, 'use fewer values')
    let values = raw.map((s) => s.slice(0, 200))
    if (r.field === 'plane') values = values.map((p) => planeRef(ctx, op, p))
    if (r.field === 'type') for (const t of values) if (!(CARD_TYPES as readonly string[]).includes(t)) refuse(op, `${t} isn't a card type`, `use ${CARD_TYPES.join(', ')}`)
    if (r.field === 'status') for (const s of values) if (!STATUSES.includes(s)) refuse(op, `${s} isn't a status`, `use ${STATUSES.join(', ')}`)
    if (r.field === 'title') values = values.slice(0, 1)
    return { field: r.field, ...(r.not ? { not: true } : {}), values }
  })
}

// ---- Columns

export type ColumnSpec = { field?: Field; name?: string; kind?: OwnKind; unit?: string; scale?: string; steps?: StepSpec[]; width?: number; id?: string }

const clampW = (w: number) => Math.round(Math.min(COL_W.max, Math.max(COL_W.min, w)))

export function columnFrom(ctx: OpCtx, op: string, v: unknown): Column {
  if (!v || typeof v !== 'object' || Array.isArray(v)) refuse(op, 'a column is an object', 'give { field } for a card field, or { name, kind } for its own')
  const c = v as ColumnSpec
  const id = typeof c.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(c.id) ? c.id : shortId(ctx)
  const width = c.width === undefined ? {} : typeof c.width === 'number' && Number.isFinite(c.width) ? { width: clampW(c.width) } : refuse(op, 'width is a number', `give px (${COL_W.min}–${COL_W.max})`)
  if (c.field !== undefined) {
    if (!(FIELDS as readonly unknown[]).includes(c.field)) refuse(op, `${String(c.field)} isn't a card field`, `use one of ${FIELDS.join(', ')}`)
    if (c.kind !== undefined) refuse(op, 'a card field column shows the field; it has no kind', 'leave kind out, or leave field out for a column of its own')
    return { id, field: c.field, ...(typeof c.name === 'string' && c.name.trim() ? { name: c.name.trim().slice(0, COL_NAME_MAX) } : {}), ...width }
  }
  if (!(OWN_KINDS as readonly unknown[]).includes(c.kind)) refuse(op, `a column of its own needs a kind (${OWN_KINDS.join(', ')})`, 'give kind, or field for a card field')
  if (typeof c.name !== 'string' || !c.name.trim()) refuse(op, 'a column of its own needs a name', 'give name')
  if ((c.scale !== undefined || c.steps !== undefined) && c.kind !== 'scale') refuse(op, 'only a scale column has steps', 'say kind: scale, or leave steps out')
  if (c.unit !== undefined && c.kind !== 'number') refuse(op, 'only a number column has a unit', 'say kind: number, or leave unit out')
  const steps = c.kind === 'scale' ? { steps: stepsFrom(op, c.steps ?? c.scale ?? 'level') } : {}
  return { id, name: c.name.trim().slice(0, COL_NAME_MAX), kind: c.kind!, ...steps, ...(c.unit?.trim() ? { unit: c.unit.trim().slice(0, 20) } : {}), ...width }
}

// A column by id or name, the candidates when it's unclear.
export function colIn(op: string, t: TableSetup, ref: unknown, nameOk = false): Column | typeof NAME_COL {
  if (typeof ref !== 'string' || !ref) refuse(op, 'which column?', `name one of: ${candidates(t.cols.map(colName))}`)
  const f = findCol(t, ref)
  if ('it' in f) {
    if (f.it === NAME_COL && !nameOk) refuse(op, "the name column is the rows' names", "rename a row with axis_update (a card's title: update_card)")
    return f.it
  }
  const list = ('many' in f ? (f.many as Column[]) : t.cols).map((c) => `${colName(c)} [${c.id}]`)
  refuse(op, 'many' in f ? `"${ref}" names more than one column` : `there is no column ${ref}`, `use a column's id, or one of: ${candidates(list)}`)
}

// ---- create_piece's `table`

export type TableSpec = {
  template?: string
  rules?: RuleSpec[]
  manual?: boolean
  cards?: string[]
  names?: string[]
  columns?: ColumnSpec[]
  sort?: { col: string; desc?: boolean }
  page_size?: number
}

function sortFrom(op: string, t: TableSetup, v: unknown): TableSetup['sort'] {
  const s = v as { col?: unknown; desc?: unknown }
  if (!s || typeof s !== 'object') refuse(op, 'sort is { col, desc }', 'give the column (its id or name; name for the rows) and desc: true for high to low')
  const c = colIn(op, t, s.col, true)
  return { col: c === NAME_COL ? NAME_COL : c.id, ...(s.desc ? { desc: true } : {}) }
}

function pageFrom(op: string, v: unknown): number {
  if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 1000) refuse(op, 'page_size is a whole number, 1–1000', 'give rows per page, or null for all on one page')
  return v as number
}

export function tableSetupFrom(ctx: OpCtx, op: string, spec: unknown): TableSetup {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) refuse(op, 'table is an object', 'give { template, rules, cards, names, columns, … }')
  const s = spec as TableSpec
  if (s.template !== undefined && !TABLE_TEMPLATES.includes(s.template)) refuse(op, `there is no table template ${String(s.template)}`, `use one of ${TABLE_TEMPLATES.join(', ')}`)
  const t = TEMPLATES.find((x) => x.key === (s.template ?? 'cards'))!
  const setup: TableSetup = clone(t.setup(() => shortId(ctx)))
  if (s.rules !== undefined) setup.rows.rules = rulesFrom(ctx, op, s.rules)
  const items: SourceItem[] = []
  for (const c of s.cards ?? []) {
    const card = ctx.ws.cards.find((x) => x.id === c)
    if (!card) refuse(op, `there is no card ${String(c)}`, 'use the id of an existing card')
    if (card.type === 'package') refuse(op, "a package can't be a row", 'add its cards instead')
    items.push({ id: shortId(ctx), cardType: card.type, cardId: card.id })
  }
  for (const n of s.names ?? []) items.push({ id: shortId(ctx), name: String(n).slice(0, 200) })
  if (s.cards !== undefined || s.names !== undefined) setup.rows.items = items
  if (setup.rows.items.length > MAX_ITEMS) refuse(op, `at most ${MAX_ITEMS} rows by hand`, 'use rules instead')
  // Only names (no template, no rules, no cards): a list of names.
  const manual = s.manual ?? (s.template === undefined && !s.rules?.length && !s.cards?.length && !!s.names?.length ? true : s.template === 'blank' ? true : undefined)
  if (manual) setup.manual = true
  else delete setup.manual
  if (s.columns !== undefined) {
    if (!Array.isArray(s.columns)) refuse(op, 'columns are a list', 'give [{ field } or { name, kind }]')
    if (s.columns.length > MAX_COLS) refuse(op, `at most ${MAX_COLS} columns`, 'use fewer columns')
    setup.cols = s.columns.map((c) => columnFrom(ctx, op, c))
  }
  if (s.sort !== undefined) setup.sort = sortFrom(op, setup, s.sort)
  if (s.page_size !== undefined) setup.pageSize = pageFrom(op, s.page_size)
  return setup
}

// ---- update_table

export type UpdateTableArgs = {
  id: string
  template?: string
  name?: string
  // Replaces the rules (a plane rule set by sticking stays).
  rules?: RuleSpec[]
  manual?: boolean
  sort?: { col: string; desc?: boolean } | null
  page_size?: number | null
  // The rules' cards taken out, all brought back.
  bring_back?: boolean
  // The UI's setup editors: the whole setup or whole parts of it, as stored.
  setup?: TableSetup
  parts?: Partial<Record<keyof TableSetup, unknown>>
  // Only with `ui` (data/table.ts' wrappers; not in the model's schema): the model gives typed fields.
  ui?: boolean
  label?: string
}

export function updateTable(ctx: OpCtx, args: UpdateTableArgs): Plan {
  const op = 'update_table'
  const p = find(ctx.ws.pieces as P[], op, args.id, 'piece')
  if (p.kind !== 'table') refuse(op, `${p.id} isn't a table`, 'use the id of a table (a matrix: update_matrix)')
  if ((args.setup !== undefined || args.parts !== undefined) && !args.ui) refuse(op, "setup and parts are the app's own", 'give the typed fields (template, rules, manual, sort, page_size, …)')
  const patch: Record<string, unknown> = {}
  let label = args.label ?? 'change a table'
  if (args.setup !== undefined || args.template !== undefined) {
    if (args.setup !== undefined && args.template !== undefined) refuse(op, 'setup and template both replace the setup', 'give one of them')
    let whole: TableSetup
    if (args.template !== undefined) {
      const t = TEMPLATES.find((x) => x.key === args.template)
      if (!t) refuse(op, `there is no table template ${String(args.template)}`, `use one of ${TABLE_TEMPLATES.join(', ')}`)
      whole = t.setup(() => shortId(ctx))
    } else whole = args.setup!
    patch.table = tidy(whole)
    label = args.label ?? 'set up a table'
  } else if (!p.table) refuse(op, `table ${p.id} has no setup yet`, 'give it one: template')
  if (args.parts) for (const [k, v] of Object.entries(args.parts)) patch[`table.${k}`] = v === undefined ? DELETE : tidy(v)
  const t = (patch.table as TableSetup | undefined) ?? p.table!
  const set = (k: string, v: unknown) => {
    if (patch.table) {
      if (v === DELETE) delete (patch.table as Record<string, unknown>)[k]
      else (patch.table as Record<string, unknown>)[k] = v
    } else patch[`table.${k}`] = v
  }
  if (args.rules !== undefined) {
    const auto = (t.rows.rules ?? []).filter((r) => r.auto)
    if (patch.table) (patch.table as TableSetup).rows.rules = [...auto, ...rulesFrom(ctx, op, args.rules)]
    else patch['table.rows.rules'] = [...auto, ...rulesFrom(ctx, op, args.rules)]
  }
  if (args.manual !== undefined) set('manual', args.manual ? true : DELETE)
  if (args.sort !== undefined) set('sort', args.sort === null ? DELETE : sortFrom(op, t, args.sort))
  if (args.page_size !== undefined) set('pageSize', args.page_size === null ? DELETE : pageFrom(op, args.page_size))
  if (args.bring_back) {
    if (patch.table) delete (patch.table as TableSetup).rows.hide
    else patch['table.rows.hide'] = DELETE
  }
  if (args.name !== undefined) {
    if (typeof args.name !== 'string') refuse(op, 'name is text', 'give the name as a string')
    if (args.name.trim()) patch.name = args.name.trim().slice(0, 80)
  }
  if (!Object.keys(patch).length) return { op, label, writes: [], ids: {}, meta: { kind: 'table' } }
  return { op, label, writes: [{ coll: 'pieces', id: p.id, patch: { ...patch, updatedAt: ctx.now } }], ids: {}, meta: { kind: 'table' } }
}

export type { Source }
