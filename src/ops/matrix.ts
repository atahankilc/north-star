// Matrix ops (S7, D-312; docs/specs/agent-actions.md §11): a matrix's setup from typed arguments the model can fill
// without knowing how it's stored (create_piece's `matrix`), and update_matrix (a template, the cells' kind, steps,
// unit, options, totals, an axis's type, plane, name, unfolding and which cards are shown open). Entries and cells are
// src/ops/lens.ts' (shared with tables). Every setup written is checked against what clean.ts (firestore.rules) takes.
import { CARD_TYPES, isOnPlane, type CardType } from '../model/cards'
import { SCALES } from '../model/scales'
import { CELL_KINDS, TONES, TOTALS_AS, TOTALS_AT, type Tone } from '../model/shapes'
import { GLYPH_MAX, LABEL_MAX, MAX_ENTRIES, MAX_STEPS, NAME_MAX, TEMPLATES, entriesOf, type Axis, type AxisItem, type MatrixSetup, type Step } from '../model/matrix'
import { candidates, findNamed } from '../model/lens'
import type { Piece } from '../data/model'
import { DELETE, type OpCtx, type Plan } from './types'
import { a, find, refuse } from './util'

type P = Piece & { id: string }

export const MATRIX_TEMPLATES = TEMPLATES.map((t) => t.key)
export const SCALE_KEYS = SCALES.map((s) => s.key)

// An entry's short id (as the setup's own, matrix.ts' newId: 6–8 characters).
export const shortId = (ctx: OpCtx) => ctx.newId().slice(-8)

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

// A setup (or part of one) as the editors give it, in the shape the rules keep: undefined fields gone, and the lists
// that are left out when empty (`hide`, `open`) left out (clean.ts would drop them; validate would refuse the write).
export function tidy<T>(v: T): T {
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk)
    if (!x || typeof x !== 'object') return x
    return Object.fromEntries(Object.entries(x).flatMap(([k, y]) => ((k === 'hide' || k === 'open') && Array.isArray(y) && !y.length ? [] : [[k, walk(y)]])))
  }
  return walk(clone(v)) as T
}

export function lensIn(ctx: OpCtx, op: string, id: unknown, kind?: 'matrix' | 'table'): P {
  const p = find(ctx.ws.pieces as P[], op, id, 'piece')
  if (p.kind !== 'matrix' && p.kind !== 'table') refuse(op, `${p.id} is ${a(String(p.kind === 'kanban' ? 'deck' : p.kind))}, not a matrix or a table`, 'use the id of a matrix or a table')
  if (kind && p.kind !== kind) refuse(op, `${p.id} is a ${p.kind}, not a ${kind}`, `use the id of a ${kind}`)
  if (p.kind === 'matrix' && !p.matrix) refuse(op, `matrix ${p.id} has no setup yet`, 'give it one: update_matrix with a template')
  if (p.kind === 'table' && !p.table) refuse(op, `table ${p.id} has no setup yet`, 'give it one: update_table with a template')
  return p
}

// A plane by id or name.
export function planeRef(ctx: OpCtx, op: string, ref: unknown): string {
  if (typeof ref !== 'string' || !ref.trim()) refuse(op, 'which plane?', 'give a plane by id or name')
  const planes = (ctx.ws.pieces as P[]).filter((p) => p.kind === 'plane' || !p.kind)
  const f = findNamed(planes, ref, (p) => [p.id], (p) => [p.name ?? ''])
  if ('it' in f) return f.it.id
  const list = ('many' in f ? f.many : planes).map((p) => `${p.name || '(unnamed)'} [${p.id}]`)
  refuse(op, 'many' in f ? `"${ref}" names more than one plane` : `there is no plane ${ref}`, `name one of: ${candidates(list)}`)
}

// ---- Steps: a scale by its key, or steps by their labels (glyph and tone optional).

export type StepSpec = string | { label: string; glyph?: string; tone?: Tone; id?: string }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

export function stepsFrom(op: string, v: unknown): Step[] {
  if (typeof v === 'string') {
    const sc = SCALES.find((s) => s.key === v || s.name === v)
    if (!sc) refuse(op, `there is no scale ${v}`, `use one of ${SCALE_KEYS.join(', ')}, or give steps as a list of labels, low to high`)
    return clone(sc.steps)
  }
  if (!Array.isArray(v) || !v.length) refuse(op, 'steps are a scale key or a list of labels', `give a scale (${SCALE_KEYS.join(', ')}) or 2–${MAX_STEPS} labels, low to high`)
  if (v.length > MAX_STEPS) refuse(op, `a scale has at most ${MAX_STEPS} steps, not ${v.length}`, 'use fewer steps')
  const seen = new Set<string>()
  return v.map((x: unknown, i: number) => {
    const s = (typeof x === 'string' ? { label: x } : x) as { label?: unknown; glyph?: unknown; tone?: unknown; id?: unknown }
    if (!s || typeof s.label !== 'string' || !s.label.trim()) refuse(op, `step ${i + 1} has no label`, 'give each step a label')
    if (s.tone !== undefined && !(TONES as readonly unknown[]).includes(s.tone)) refuse(op, `${String(s.tone)} isn't a tone`, `use one of ${TONES.join(', ')}`)
    const label = s.label.trim().slice(0, LABEL_MAX)
    let id = typeof s.id === 'string' && s.id ? s.id.slice(0, 40) : slug(label) || `s${i + 1}`
    while (seen.has(id)) id = `${id}-${i + 1}`
    seen.add(id)
    const glyph = (typeof s.glyph === 'string' && s.glyph ? s.glyph : String(i + 1)).slice(0, GLYPH_MAX)
    return { id, glyph, label, tone: (s.tone as Tone) ?? (i === 0 ? 'dim' : i === v.length - 1 ? 'magenta' : 'yellow') }
  })
}

// ---- An axis from typed arguments

export type AxisSpec = {
  // Every card of this type joins by itself (one plane's with `plane`).
  type?: CardType
  plane?: string
  // Cards added by hand (any type), and typed names.
  cards?: string[]
  names?: string[]
  // What one of them is called in the corner.
  noun?: string
  // A feature axis: each feature unfolds into what it's judged on (its criteria).
  unfold?: boolean
}

export function axisFrom(ctx: OpCtx, op: string, spec: unknown, which: 'rows' | 'cols'): Axis {
  const side = which === 'rows' ? 'rows' : 'columns'
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) refuse(op, `${side} is an object`, 'give { type, plane, cards, names, noun, unfold }')
  const s = spec as AxisSpec
  if (s.type !== undefined && !(CARD_TYPES as readonly string[]).includes(s.type)) refuse(op, `${String(s.type)} isn't a card type`, `use one of ${CARD_TYPES.join(', ')}`)
  if (s.plane !== undefined && !s.type) refuse(op, `${side}: a plane narrows a type's cards`, 'give type too, or leave plane out')
  const items: AxisItem[] = []
  for (const c of s.cards ?? []) {
    const card = ctx.ws.cards.find((x) => x.id === c)
    if (!card) refuse(op, `${side}: there is no card ${String(c)}`, 'use the id of an existing card (search for it)')
    if (card.type === 'package') refuse(op, `${side}: a package can't be a row or column`, 'add its cards instead')
    // One its type brings already (on any plane, or on the plane given).
    if (card.type === s.type && (s.plane === undefined || isOnPlane(card, planeRef(ctx, op, s.plane)))) continue
    items.push({ id: shortId(ctx), cardType: card.type, cardId: card.id })
  }
  for (const n of s.names ?? []) {
    if (typeof n !== 'string') refuse(op, `${side}: names are text`, 'give names as strings')
    items.push({ id: shortId(ctx), name: n.slice(0, NAME_MAX) })
  }
  if (!s.type && !items.length) refuse(op, `${side} would be empty`, 'give a card type (every card of it joins), cards or names')
  if (items.length > MAX_ENTRIES) refuse(op, `${side}: at most ${MAX_ENTRIES} added by hand`, 'use a type instead of listing the cards')
  if (s.unfold && s.type !== 'feature') refuse(op, `${side}: only features unfold (into what they're judged on)`, 'say type: feature, or leave unfold out')
  return {
    ...(s.type ? { type: s.type } : {}),
    ...(s.plane !== undefined ? { plane: planeRef(ctx, op, s.plane) } : {}),
    items,
    ...(typeof s.noun === 'string' && s.noun.trim() ? { noun: s.noun.trim().slice(0, 40) } : {}),
    ...(s.unfold ? { unfold: 'criteria' as const } : {}),
  }
}

// ---- create_piece's `matrix`: a whole setup from typed arguments

export type MatrixOptions = {
  // The cells: a scale of steps (scale: a key, or steps: labels), a number (unit), or a short text.
  cell?: 'scale' | 'number' | 'text'
  scale?: string
  steps?: StepSpec[]
  unit?: string
  // Allow "doesn't apply" (—, left out of the totals) and marking guesses (~ inferred, ? a guess).
  not_relevant?: boolean
  confidence?: boolean
  // Totals: shown, where (head, end, both) and as what (squares, number, bar).
  totals?: boolean
  totals_at?: (typeof TOTALS_AT)[number]
  totals_as?: (typeof TOTALS_AS)[number]
  // A scale's cells as their glyphs instead of filled squares.
  marks?: boolean
}

export type MatrixSpec = MatrixOptions & {
  template?: string
  rows?: AxisSpec
  cols?: AxisSpec
}

// The options (cell kind, steps, unit, `—`, guesses, totals) as setup fields; null takes one away (update_matrix).
function optionsFrom(op: string, s: MatrixOptions & Record<string, unknown>): Partial<Record<keyof MatrixSetup, unknown>> {
  const out: Partial<Record<keyof MatrixSetup, unknown>> = {}
  const flag = (k: keyof MatrixOptions, field: keyof MatrixSetup) => {
    if (!(k in s)) return
    const v = s[k]
    if (v !== null && typeof v !== 'boolean') refuse(op, `${k} is true or false`, `say ${k}: true or false`)
    out[field] = v ? true : DELETE
  }
  if ('cell' in s) {
    if (!(CELL_KINDS as readonly unknown[]).includes(s.cell)) refuse(op, `${String(s.cell)} isn't a kind of cell`, `use one of ${CELL_KINDS.join(', ')}`)
    out.cell = s.cell
  }
  if (s.scale !== undefined && s.steps !== undefined) refuse(op, 'scale and steps both say what the steps are', 'give one of them')
  if (s.scale !== undefined) out.steps = stepsFrom(op, s.scale)
  if (s.steps !== undefined) out.steps = stepsFrom(op, s.steps)
  if ('unit' in s) {
    if (s.unit !== null && typeof s.unit !== 'string') refuse(op, 'unit is text', 'give the unit (€, h, %…), or null to take it away')
    out.unit = typeof s.unit === 'string' && s.unit.trim() ? s.unit.trim().slice(0, 20) : DELETE
  }
  flag('not_relevant', 'notRelevant')
  flag('confidence', 'confidence')
  flag('totals', 'reading')
  flag('marks', 'marks')
  for (const [k, field, values] of [
    ['totals_at', 'totalsAt', TOTALS_AT],
    ['totals_as', 'totalsAs', TOTALS_AS],
  ] as const) {
    if (!(k in s)) continue
    const v = s[k]
    if (v !== null && !(values as readonly unknown[]).includes(v)) refuse(op, `${String(v)} isn't one of ${k}'s values`, `use one of ${values.join(', ')}`)
    // The first is the default: kept unset.
    out[field] = v === null || v === values[0] ? DELETE : v
  }
  return out
}

// Fields with DELETE in them, as a stored object (a new setup leaves them out).
const settled = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== DELETE))

export function matrixSetupFrom(ctx: OpCtx, op: string, spec: unknown): MatrixSetup {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) refuse(op, 'matrix is an object', 'give { template, rows, cols, cell, scale, … }')
  const s = spec as MatrixSpec
  const t = TEMPLATES.find((x) => x.key === (s.template ?? 'blank'))
  if (!t) refuse(op, `there is no matrix template ${String(s.template)}`, `use one of ${MATRIX_TEMPLATES.join(', ')}, or leave it out and give rows and cols`)
  const base = clone(t.setup(() => shortId(ctx)))
  const setup: MatrixSetup = { ...base, ...settled(optionsFrom(op, s as MatrixOptions & Record<string, unknown>)) } as MatrixSetup
  if (s.rows !== undefined) setup.rows = axisFrom(ctx, op, s.rows, 'rows')
  if (s.cols !== undefined) setup.cols = axisFrom(ctx, op, s.cols, 'cols')
  if (setup.cell === 'scale' && !setup.steps?.length) setup.steps = clone(SCALES[1].steps)
  return setup
}

// ---- update_matrix

export type AxisPatch = {
  type?: CardType | null
  plane?: string | null
  noun?: string | null
  unfold?: boolean
  // Cards shown open (their criteria as rows) or folded.
  open?: string[]
  fold?: string[]
  // The cards of its type taken out, all brought back.
  bring_back?: boolean
}

export type UpdateMatrixArgs = MatrixOptions & {
  id: string
  // Start over from a template (its rows, columns and cells; the cells already filled stay, filed under their keys).
  template?: string
  name?: string
  rows?: AxisPatch
  cols?: AxisPatch
  // The UI's setup editors: the whole setup (`setup`, a template picked) or whole parts of it (`parts`), as stored. Only
  // with `ui` (data/matrix.ts' wrappers; not in the model's schema): the model gives typed fields.
  setup?: MatrixSetup
  parts?: Partial<Record<keyof MatrixSetup, unknown>>
  ui?: boolean
  label?: string
}

function axisPatch(ctx: OpCtx, op: string, a: Axis, p: AxisPatch, which: 'rows' | 'cols'): Record<string, unknown> {
  if (!p || typeof p !== 'object' || Array.isArray(p)) refuse(op, `${which} is an object`, 'give { type, plane, noun, unfold, open, fold, bring_back }')
  const out: Record<string, unknown> = {}
  const at = (k: string) => `matrix.${which}.${k}`
  let type = a.type
  if ('type' in p) {
    if (p.type !== null && !(CARD_TYPES as readonly unknown[]).includes(p.type)) refuse(op, `${String(p.type)} isn't a card type`, `use one of ${CARD_TYPES.join(', ')}, or null for names and cards by hand only`)
    type = p.type ?? undefined
    out[at('type')] = p.type ?? DELETE
    // The UI drops what was taken out with the type.
    if (p.type !== a.type) out[at('hide')] = DELETE
    if (!p.type) out[at('plane')] = DELETE
    if (p.type !== 'feature' && a.unfold) ((out[at('unfold')] = DELETE), (out[at('open')] = DELETE))
  }
  if ('plane' in p && p.plane !== undefined) {
    if (p.plane !== null && !type) refuse(op, `${which}: a plane narrows a type's cards`, 'give the axis a type first')
    out[at('plane')] = p.plane === null ? DELETE : planeRef(ctx, op, p.plane)
  }
  if ('noun' in p) out[at('noun')] = typeof p.noun === 'string' && p.noun.trim() ? p.noun.trim().slice(0, 40) : DELETE
  if (p.unfold !== undefined) {
    if (p.unfold && type !== 'feature') refuse(op, `${which}: only features unfold (into what they're judged on)`, 'give the axis type feature first')
    out[at('unfold')] = p.unfold ? 'criteria' : DELETE
    out[at('open')] = DELETE
  }
  if (p.open !== undefined || p.fold !== undefined) {
    const now = new Set(a.open ?? [])
    const keys = entriesOf(a, ctx.ws.cards).filter((e) => e.subs).map((e) => e.key)
    const card = (id: unknown) => {
      if (typeof id !== 'string' || !keys.includes(id)) refuse(op, `${String(id)} isn't a feature on the matrix's ${which} that unfolds`, keys.length ? `use one of: ${candidates(keys)}` : 'unfold the axis first (unfold: true), and judge its features on something')
      return id
    }
    for (const k of p.open ?? []) now.add(card(k))
    for (const k of p.fold ?? []) now.delete(card(k))
    if (p.unfold === undefined) out[at('open')] = now.size ? [...now] : DELETE
  }
  if (p.bring_back) out[at('hide')] = DELETE
  return out
}

export function updateMatrix(ctx: OpCtx, args: UpdateMatrixArgs): Plan {
  const op = 'update_matrix'
  const p = find(ctx.ws.pieces as P[], op, args.id, 'piece')
  if (p.kind !== 'matrix') refuse(op, `${p.id} isn't a matrix`, 'use the id of a matrix (a table: update_table)')
  const m = p.matrix
  if ((args.setup !== undefined || args.parts !== undefined) && !args.ui) refuse(op, 'setup and parts are the app\'s own', 'give the typed fields (template, cell, scale, steps, unit, rows, cols, …)')
  const patch: Record<string, unknown> = {}
  let label = args.label ?? 'change a matrix'
  if (args.setup !== undefined || args.template !== undefined) {
    if (args.setup !== undefined && args.template !== undefined) refuse(op, 'setup and template both replace the setup', 'give one of them')
    let whole: MatrixSetup
    if (args.template !== undefined) {
      const t = TEMPLATES.find((x) => x.key === args.template)
      if (!t) refuse(op, `there is no matrix template ${String(args.template)}`, `use one of ${MATRIX_TEMPLATES.join(', ')}`)
      whole = t.setup(() => shortId(ctx))
    } else whole = args.setup!
    patch.matrix = tidy(whole)
    label = args.label ?? 'set up a matrix'
  } else if (!m) refuse(op, `matrix ${p.id} has no setup yet`, 'give it one: template')
  if (args.parts) for (const [k, v] of Object.entries(args.parts)) patch[`matrix.${k}`] = v === undefined || ((k === 'open' || k === 'hide') && Array.isArray(v) && !v.length) ? DELETE : tidy(v)
  const opts = optionsFrom(op, args as MatrixOptions & Record<string, unknown>)
  for (const [k, v] of Object.entries(opts)) {
    if (patch.matrix) (patch.matrix as Record<string, unknown>)[k] = v
    else patch[`matrix.${k}`] = v
  }
  if (patch.matrix) patch.matrix = settled(patch.matrix as Record<string, unknown>)
  for (const which of ['rows', 'cols'] as const) {
    const ap = args[which]
    if (ap === undefined) continue
    if (patch.matrix) refuse(op, `${which} changes the setup being replaced`, 'start over from the template first, then change it in another op')
    Object.assign(patch, axisPatch(ctx, op, m![which], ap, which))
  }
  if (args.name !== undefined) {
    if (typeof args.name !== 'string') refuse(op, 'name is text', 'give the name as a string')
    if (args.name.trim()) patch.name = args.name.trim().slice(0, 80)
  }
  if (!Object.keys(patch).length) return { op, label, writes: [], ids: {}, meta: { kind: 'matrix' } }
  return { op, label, writes: [{ coll: 'pieces', id: p.id, patch: { ...patch, updatedAt: ctx.now } }], ids: {}, meta: { kind: 'matrix' } }
}
