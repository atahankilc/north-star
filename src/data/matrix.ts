// A matrix (D-204): a piece on the canvas (`kind: 'matrix'`) that crosses two lists and fills the cells between them.
// Generic on purpose: the old features × competitors matrix (D-133, D-136) is one setup of it, not the only one.
//
// Each axis (rows, columns) is a list: every card of one type (on any plane, or one plane's), new ones joining by
// themselves, and entries added by hand, each a card or just a typed name. A card's row reads its live title.
// The cells hold one kind of value for the whole matrix: a scale of named steps (○ ◐ ● ★, ✓ ✕, 1–5…, editable), a
// number or a short text; each cell may also carry a note, and, when the matrix allows them, `not relevant` (—, left out
// of the readings) and how sure it is (~ inferred, ? a guess). The totals sum up each row and column (D-212).
//
// The setup lives on the piece (`matrix`); the cells in `cells/{matrixId}_{row}_{col}`, so a cell can't be made twice.
// A row or column is keyed by its card's id, or by its typed entry's own id.
//
// An axis may unfold its cards into what they're made of (D-249): a feature into what it's judged on (its `criteria`,
// D-133). Each is a row (or column) of its own under the card, `card~criterion`, its cells ordinary cells; the card's
// own cells then read from them (rollUp), folded as one small square each. Shown open or folded per card, shared.
import { collection, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { CARD_TYPES, type AnyType, type Card, type CardType } from './cards'
import { db } from './firebase'
import { tracked } from './history'
import { pieceRef } from './pieces'

export type AxisItem = { id: string; name?: string; cardType?: AnyType; cardId?: string }

export type Axis = {
  // Every card of this type joins by itself; `plane`: only those on that plane.
  type?: CardType
  plane?: string
  // Cards of `type` taken out.
  hide?: string[]
  // Added by hand, after the type's cards.
  items: AxisItem[]
  // What one of them is, said in the corner (`features`, `criteria`); the type's name when unset.
  noun?: string
  // Its cards unfolded into what they're made of (D-249), and the cards shown open (the rest folded).
  unfold?: Unfold
  open?: string[]
}

// What a card can unfold into; only a feature's criteria for now (later its parts, a competitor's features).
export const UNFOLDS = ['criteria'] as const
export type Unfold = (typeof UNFOLDS)[number]

export const TONES = ['dim', 'fg', 'cyan', 'yellow', 'magenta', 'green', 'blue'] as const
export type Tone = (typeof TONES)[number]
export const TONE_VAR: Record<Tone, string> = {
  dim: 'var(--fg-dim)',
  fg: 'var(--fg)',
  cyan: 'var(--accent-cyan)',
  yellow: 'var(--accent-yellow)',
  magenta: 'var(--accent-magenta)',
  green: 'var(--accent-green)',
  blue: 'var(--accent-blue)',
}

// Low to high: the order keys 1–9 pick them in and the readings stack them in.
export type Step = { id: string; glyph: string; label: string; tone: Tone }

export const CELL_KINDS = ['scale', 'number', 'text'] as const
export type CellKind = (typeof CELL_KINDS)[number]

export type MatrixSetup = {
  rows: Axis
  cols: Axis
  cell: CellKind
  // The scale's steps (kept when the cells turn to numbers or text, so turning back finds them).
  steps: Step[]
  unit?: string
  notRelevant?: boolean
  confidence?: boolean
  // The totals (D-212): each row and column summed up, in its head, at its end or both (the head when unset); as
  // squares, a number or a line of the steps' shares (squares when unset).
  reading?: boolean
  totalsAt?: TotalsAt
  totalsAs?: TotalsAs
  // A scale's cells as their steps' glyphs instead of squares filled to the step (D-212).
  marks?: boolean
}

export const TOTALS_AT = ['head', 'end', 'both'] as const
export type TotalsAt = (typeof TOTALS_AT)[number]
export const TOTALS_AS = ['squares', 'number', 'bar'] as const
export type TotalsAs = (typeof TOTALS_AS)[number]

export const CONFIDENCES = ['documented', 'inferred', 'guess'] as const
export type Confidence = (typeof CONFIDENCES)[number]
// `documented` needs no mark (D-136).
export const CONFIDENCE_MARK: Record<Confidence, string> = { documented: '', inferred: '~', guess: '?' }

export type Cell = {
  matrixId: string
  row: string
  col: string
  // A step's id, a number or a text, as the matrix's cells say. A value of another kind (the kind changed) is kept but
  // not shown, so turning back finds it.
  value?: string | number
  notes?: string
  notRelevant?: boolean
  confidence?: Confidence
  updatedAt: number
}

// firestore.rules' validMatrix and validCell allow these.
export const MAX_ENTRIES = 200
export const MAX_STEPS = 9
export const NAME_MAX = 200
export const TEXT_MAX = 200
export const NOTES_MAX = 20000
export const GLYPH_MAX = 4
export const LABEL_MAX = 40

export const newId = () => Math.random().toString(36).slice(2, 8)

const step = (glyph: string, label: string, tone: Tone): Step => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), glyph, label, tone })

// Scales to start from; every step can be renamed, recoloured, added or taken out after.
export const SCALES: { key: string; name: string; steps: Step[] }[] = [
  { key: 'coverage', name: 'coverage', steps: [step('○', 'none', 'dim'), step('◐', 'partial', 'yellow'), step('●', 'full', 'cyan'), step('★', 'better', 'magenta')] },
  { key: 'yes-no', name: 'yes / no', steps: [step('✕', 'no', 'dim'), step('✓', 'yes', 'green')] },
  { key: 'level', name: 'low → high', steps: [step('▁', 'low', 'dim'), step('▄', 'medium', 'yellow'), step('█', 'high', 'magenta')] },
  {
    key: 'five',
    name: '1 – 5',
    steps: [step('1', 'one', 'dim'), step('2', 'two', 'dim'), step('3', 'three', 'yellow'), step('4', 'four', 'cyan'), step('5', 'five', 'magenta')],
  },
]

const axis = (type?: CardType, noun?: string, names: string[] = []): Axis => ({
  ...(type ? { type } : {}),
  ...(noun ? { noun } : {}),
  items: names.map((name) => ({ id: newId(), name })),
})

// Setups to start from (D-204). The first is the old matrix (D-133, D-136); the last a blank table of names.
export const TEMPLATES: { key: string; name: string; hint: string; setup: () => MatrixSetup }[] = [
  {
    key: 'compare',
    name: 'features × competitors',
    hint: 'how well each competitor covers each feature',
    setup: () => ({ rows: { ...axis('feature'), unfold: 'criteria' }, cols: axis('competitor'), cell: 'scale', steps: SCALES[0].steps, notRelevant: true, confidence: true, reading: true }),
  },
  {
    key: 'pain',
    name: 'problems × customers',
    hint: 'how much each problem hurts each customer',
    setup: () => ({ rows: axis('problem'), cols: axis('customer'), cell: 'scale', steps: SCALES[2].steps, notRelevant: true, reading: true }),
  },
  {
    key: 'score',
    name: 'ideas × criteria',
    hint: 'each idea scored 1–5 on what matters',
    setup: () => ({ rows: axis('idea'), cols: axis(undefined, 'criteria', ['impact', 'effort', 'confidence']), cell: 'scale', steps: SCALES[3].steps, reading: true }),
  },
  {
    key: 'blank',
    name: 'blank',
    hint: 'rows and columns you name',
    setup: () => ({ rows: axis(undefined, 'rows', ['row 1', 'row 2']), cols: axis(undefined, 'columns', ['column 1', 'column 2']), cell: 'scale', steps: SCALES[1].steps, reading: true }),
  },
]

export const emptySetup = (): MatrixSetup => TEMPLATES[TEMPLATES.length - 1].setup()

// One row or column as shown: its key (the card's id or the entry's), its name, and the card or entry behind it. An
// unfolding card's `subs` are the keys of what it unfolds into (shown or not); one of those has its `parent` (the card's
// key), its `sub` (the criterion) and its place among them, `n`.
export type Entry = {
  key: string
  name: string
  card?: Card
  item?: AxisItem
  auto: boolean
  subs?: string[]
  parent?: string
  sub?: { id: string; text: string }
  n?: number
}

// The key of what a card unfolds into: `card~criterion`.
export const SUB = '~'
export const subKey = (card: string, sub: string) => `${card}${SUB}${sub}`
export const isSubKey = (key: string) => key.includes(SUB)

const byTitle = (a: Card, b: Card) => (a.title ? (b.title ? a.title.localeCompare(b.title) : -1) : b.title ? 1 : 0)

// The axis's rows: the type's cards by title (unnamed last), then what was added by hand. A card added by hand that the
// type already brings is shown once; a card that's gone is left out (its cells stay, and come back with ⌘Z).
export function entriesOf(a: Axis, cards: Card[]): Entry[] {
  const hidden = new Set(a.hide ?? [])
  const auto = a.type ? cards.filter((c) => c.type === a.type && (!a.plane || c.pieceId === a.plane) && !hidden.has(c.id)).sort(byTitle) : []
  const seen = new Set(auto.map((c) => c.id))
  const byId = new Map(cards.map((c) => [c.id, c]))
  const out: Entry[] = auto.map((c) => ({ key: c.id, name: c.title, card: c, auto: true }))
  for (const item of a.items) {
    if (item.cardId) {
      const c = byId.get(item.cardId)
      if (!c || seen.has(c.id)) continue
      seen.add(c.id)
      out.push({ key: c.id, name: c.title, card: c, item, auto: false })
    } else out.push({ key: item.id, name: item.name ?? '', item, auto: false })
  }
  if (a.unfold !== 'criteria') return out
  const open = new Set(a.open ?? [])
  return out.flatMap((e) => {
    const list = e.card?.type === 'feature' ? (e.card.criteria ?? []) : []
    if (!list.length) return [e]
    const subs = list.map((c) => subKey(e.key, c.id))
    const head = { ...e, subs }
    if (!open.has(e.key)) return [head]
    return [head, ...list.map((c, i): Entry => ({ key: subs[i], name: c.text, card: e.card, auto: false, parent: e.key, sub: c, n: i + 1 }))]
  })
}

// The entries that stand for themselves in a total across them: not what a card unfolded into (it's in the card's).
export const tops = (list: Entry[]) => list.filter((e) => !e.parent)

// What one row or column is called in the corner: `features`, `criteria`.
export const nounOf = (a: Axis) => a.noun || (a.type ? `${a.type}s` : 'names')
// One of them, on the `+` at the axis's end: `feature`, else `row` / `column`.
export const oneOf = (a: Axis, which: 'rows' | 'cols') => a.type ?? (which === 'rows' ? 'row' : 'column')

export const cellKey = (matrixId: string, row: string, col: string) => `${matrixId}_${row}_${col}`
const cellsCol = (wid: string) => collection(db(), 'workspaces', wid, 'cells')
export const cellRef = (wid: string, id: string) => doc(cellsCol(wid), id)

// What a cell shows, as its matrix's cells say: a step, a number, a text, or nothing.
export function readCell(setup: MatrixSetup, cell: Cell | undefined): { step?: Step; number?: number; text?: string } {
  const v = cell?.value
  if (v === undefined) return {}
  if (setup.cell === 'scale') return typeof v === 'string' ? { step: setup.steps.find((s) => s.id === v) } : {}
  if (setup.cell === 'number') return typeof v === 'number' ? { number: v } : {}
  return typeof v === 'string' && v ? { text: v } : {}
}

export const relevant = (cell: Cell | undefined) => !cell?.notRelevant

// A row's or a column's cells read together, the ones left out (—) aside: how many of each step, the numbers' average, or
// how many are written.
export type Reading = { counts: number[]; filled: number; of: number; avg?: number }
export function readingOf(setup: MatrixSetup, cells: (Cell | undefined)[]): Reading {
  const counted = setup.notRelevant ? cells.filter(relevant) : cells
  const counts = setup.steps.map(() => 0)
  const numbers: number[] = []
  let filled = 0
  for (const c of counted) {
    const r = readCell(setup, c)
    if (r.step) counts[setup.steps.indexOf(r.step)]++
    if (r.number !== undefined) numbers.push(r.number)
    if (r.step || r.number !== undefined || r.text) filled++
  }
  return { counts, filled, of: counted.length, avg: numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : undefined }
}

// A card's cell read from what it unfolds into (D-249), the ones left out (—) and unset aside: a scale's the step at the
// average of theirs, rounded down (one `none` among `full`s isn't full); numbers' average; words aren't summed.
export function rollUp(setup: MatrixSetup, cells: (Cell | undefined)[]): string | number | undefined {
  const counted = setup.notRelevant ? cells.filter(relevant) : cells
  const read = counted.map((c) => readCell(setup, c))
  if (setup.cell === 'scale') {
    const at = read.flatMap((r) => (r.step ? [setup.steps.indexOf(r.step)] : []))
    return at.length ? setup.steps[Math.floor(at.reduce((a, b) => a + b, 0) / at.length)]?.id : undefined
  }
  if (setup.cell === 'number') {
    const n = read.flatMap((r) => (r.number !== undefined ? [r.number] : []))
    return n.length ? n.reduce((a, b) => a + b, 0) / n.length : undefined
  }
  return undefined
}

// A cell as shown: a card's that unfolds reads from its parts (`parts`, each shown the same way), and `rolled` once any of
// them is set; till then its own value shows (as D-133's unscored cells kept theirs). Its note, `—` and how sure stay its own.
export type Shown = Cell & { parts?: (Shown | undefined)[]; rolled?: boolean }
type Side = Pick<Entry, 'key' | 'subs'>
export function cellView(matrixId: string, setup: MatrixSetup, at: (row: string, col: string) => Cell | undefined, row: Side, col: Side): Shown | undefined {
  const own = at(row.key, col.key)
  const parts = row.subs
    ? row.subs.map((k) => cellView(matrixId, setup, at, { key: k }, col))
    : col.subs
      ? col.subs.map((k) => cellView(matrixId, setup, at, row, { key: k }))
      : undefined
  if (!parts) return own
  const v = rollUp(setup, parts)
  const base: Cell = own ?? { matrixId, row: row.key, col: col.key, updatedAt: 0 }
  return { ...base, value: v ?? own?.value, parts, rolled: v !== undefined }
}

// A step that meets what it's judged on: the scale's upper half (full and better of none → better; yes; high; 4 and 5).
export const meets = (setup: MatrixSetup, step: Step | undefined) => !!step && setup.steps.indexOf(step) >= Math.ceil(setup.steps.length / 2)

// What nobody meets (D-133's white space): scored somewhere across, and nowhere in the upper half. Scales only.
export function isOpen(setup: MatrixSetup, cells: (Cell | undefined)[]) {
  if (setup.cell !== 'scale') return false
  const steps = (setup.notRelevant ? cells.filter(relevant) : cells).map((c) => readCell(setup, c).step).filter(Boolean)
  return steps.length > 0 && !steps.some((s) => meets(setup, s))
}

// ---- Writes. Each is one undo step; typing in a field merges into one.

// A card on an unfolding axis shown open or folded (D-249), for everyone.
export function setOpen(wid: string, id: string, setup: MatrixSetup, which: 'rows' | 'cols', keys: string[], open: boolean) {
  const a = setup[which]
  const now = new Set(a.open ?? [])
  for (const k of keys) open ? now.add(k) : now.delete(k)
  return setPart(wid, id, which, { ...a, open: now.size ? [...now] : undefined })
}

// The whole setup at once (a template).
export function setSetup(wid: string, id: string, setup: MatrixSetup, name?: string) {
  const ref = pieceRef(wid, id)
  return tracked('set up a matrix', [ref], () => updateDoc(ref, { matrix: clean(setup), ...(name ? { name } : {}), updatedAt: Date.now() }))
}

// One part of the setup: an axis, the cells' kind, the steps, an option.
export function setPart<K extends keyof MatrixSetup>(wid: string, id: string, part: K, value: MatrixSetup[K] | undefined, key?: string) {
  const ref = pieceRef(wid, id)
  return tracked(
    'change a matrix',
    [ref],
    () => updateDoc(ref, { [`matrix.${part}`]: value === undefined ? deleteField() : clean(value), updatedAt: Date.now() }),
    key ? { key: `matrix:${id}:${key}` } : {},
  )
}

// A row or column taken out: an entry added by hand goes with its cells; a card the type brings is hidden (its cells kept,
// so bringing it back finds them).
export function removeEntry(wid: string, id: string, setup: MatrixSetup, which: 'rows' | 'cols', entry: Entry, cells: Cell[]) {
  const a = setup[which]
  const next: Axis = entry.auto
    ? { ...a, hide: [...(a.hide ?? []), entry.key] }
    : { ...a, items: a.items.filter((i) => i !== entry.item) }
  // With what it unfolded into.
  const ofIt = (k: string) => k === entry.key || k.startsWith(entry.key + SUB)
  const gone = entry.auto ? [] : cells.filter((c) => c.matrixId === id && ofIt(which === 'rows' ? c.row : c.col))
  const ref = pieceRef(wid, id)
  const refs = [ref, ...gone.map((c) => cellRef(wid, cellKey(c.matrixId, c.row, c.col)))]
  return tracked(`take out a ${which === 'rows' ? 'row' : 'column'}`, refs, () => {
    const batch = writeBatch(db())
    batch.update(ref, { [`matrix.${which}`]: clean(next), updatedAt: Date.now() })
    for (const r of refs.slice(1)) batch.delete(r)
    return batch.commit()
  })
}

// A typed row or column at the end; its id, to type its name in.
export async function addNamed(wid: string, id: string, setup: MatrixSetup, which: 'rows' | 'cols', name = '') {
  const item: AxisItem = { id: newId(), name }
  await setPart(wid, id, which, { ...setup[which], items: [...setup[which].items, item] })
  return item.id
}

export function addCardEntry(wid: string, id: string, setup: MatrixSetup, which: 'rows' | 'cols', card: Card) {
  const a = setup[which]
  // A hidden card of the axis's type comes back instead.
  if (a.type === card.type && a.hide?.includes(card.id)) return setPart(wid, id, which, { ...a, hide: a.hide.filter((h) => h !== card.id) })
  return setPart(wid, id, which, { ...a, items: [...a.items, { id: newId(), cardType: card.type, cardId: card.id }] })
}

export function renameEntry(wid: string, id: string, setup: MatrixSetup, which: 'rows' | 'cols', itemId: string, name: string) {
  const a = setup[which]
  const items = a.items.map((i) => (i.id === itemId ? { ...i, name: name.slice(0, NAME_MAX) } : i))
  return setPart(wid, id, which, { ...a, items }, `name:${itemId}`)
}

// Creates the cell on first edit; `undefined` clears a field.
export function setCell(wid: string, matrixId: string, row: string, col: string, fields: Partial<Pick<Cell, 'value' | 'notes' | 'notRelevant' | 'confidence'>>) {
  const data: Record<string, unknown> = { matrixId, row, col, updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  const ref = cellRef(wid, cellKey(matrixId, row, col))
  const keys = Object.keys(fields).sort().join(',')
  const typing = 'notes' in fields || typeof fields.value === 'string' || typeof fields.value === 'number'
  return tracked('matrix cell', [ref], () => setDoc(ref, data, { merge: true }), {
    // A cell's first write puts back nothing on undo.
    ...(typing ? { key: `cell:${ref.id}:${keys}` } : {}),
  })
}

// Firestore takes no `undefined`: fields left unset are dropped.
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export const isCardType = (t: string): t is CardType => (CARD_TYPES as readonly string[]).includes(t)
