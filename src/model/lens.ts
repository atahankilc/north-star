// Finding a matrix's or a table's rows and columns by what people call them (S7, D-312; docs/specs/agent.md §4.4: cells
// "by axis names"): the key a cell is filed under from a card's title, a typed name, a criterion or a column's name, or
// the candidates when it's unclear. Pure: the ops (src/ops/lens.ts) refuse with these lists, the read layer can show
// the same names.
import type { Card } from './cards'
import { entriesOf, type Axis, type Entry, type MatrixSetup } from './matrix'
import { rowsOf, type Row } from './source'
import { colName, NAME_COL, type Column, type TableSetup } from './table'

// Lower case, single spaces, no quotes round it.
export const norm = (s: string) => s.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ').toLowerCase()

export type Found<T> = { it: T } | { many: T[] } | { none: true }

// `ref` as a key (exact) first, then by any of the names (normalised): one, several (ambiguous) or none.
export function findNamed<T>(list: T[], ref: string, keysOf: (t: T) => string[], namesOf: (t: T) => string[]): Found<T> {
  const byKey = list.filter((t) => keysOf(t).includes(ref))
  if (byKey.length === 1) return { it: byKey[0] }
  const n = norm(ref)
  if (!n) return { none: true }
  const byName = list.filter((t) => namesOf(t).some((x) => norm(x) === n))
  if (byName.length === 1) return { it: byName[0] }
  if (byName.length > 1) return { many: byName }
  return { none: true }
}

// ---- Matrix

// Every row (or column) the axis has, each card's criteria unfolded whether shown open or not (a cell on a folded
// criterion is still a cell).
export const axisEntries = (a: Axis, cards: Card[]): Entry[] => {
  const all = entriesOf({ ...a, open: undefined }, cards).filter((e) => e.subs).map((e) => e.key)
  return entriesOf({ ...a, open: all }, cards)
}

// What an entry is called: its name; a criterion also `Card › criterion` (and `Card > criterion`, `Card: criterion`).
export function entryNames(e: Entry, list: Entry[]): string[] {
  if (!e.parent) return [e.name]
  const parent = list.find((x) => x.key === e.parent)?.name ?? ''
  return [e.name, `${parent} › ${e.name}`, `${parent} > ${e.name}`, `${parent}: ${e.name}`]
}

// How an entry is listed among candidates: its name and key.
export const entryLine = (e: Entry, list: Entry[]) => `${entryNames(e, list)[e.parent ? 1 : 0] || '(unnamed)'} [${e.key}]`

// An entry by key, its item's id, a card's id or a name.
export function findEntry(a: Axis, cards: Card[], ref: string): Found<Entry> & { list: Entry[] } {
  const list = axisEntries(a, cards)
  return { ...findNamed(list, ref, (e) => [e.key, ...(e.item ? [e.item.id] : [])], (e) => entryNames(e, list)), list }
}

// A card of the axis's type taken out (hidden), by id or title: it has no row until it's brought back.
export function hiddenCard(a: Axis, cards: Card[], ref: string): Card | undefined {
  if (!a.type || !a.hide?.length) return undefined
  const n = norm(ref)
  return cards.find((c) => a.hide!.includes(c.id) && c.type === a.type && (c.id === ref || (!!n && norm(c.title) === n)))
}

export const matrixAxes = (m: MatrixSetup) => ({ rows: m.rows, cols: m.cols })

// ---- Table

export const tableRows = (t: TableSetup, cards: Card[]): Row[] => rowsOf(t.rows, cards, !t.manual)

export function findRow(t: TableSetup, cards: Card[], ref: string): Found<Row> & { list: Row[] } {
  const list = tableRows(t, cards)
  return { ...findNamed(list, ref, (r) => [r.key, ...(r.item ? [r.item.id] : [])], (r) => [r.name]), list }
}

export const rowLine = (r: Row) => `${r.name || '(unnamed)'} [${r.key}]`

// What a column is called: its name, and its head as the view and the read layer show it (`cost (€)`, `cost €`; a card
// field's `impact (card field)`).
export function colNames(c: Column): string[] {
  const n = colName(c)
  return [n, ...(c.unit ? [`${n} (${c.unit})`, `${n} ${c.unit}`] : []), ...(c.field ? [`${c.field} (card field)`] : [])]
}

// A column by id or name; the name column as NAME_COL (`name`).
export function findCol(t: TableSetup, ref: string): Found<Column | typeof NAME_COL> {
  if (ref === NAME_COL) return { it: NAME_COL }
  const found = findNamed(t.cols, ref, (c) => [c.id], colNames)
  return found
}

export const colLine = (c: Column) => `${colName(c)} [${c.id}]${c.field ? ' (a card field: read-only)' : ''}`

// A list of candidates for a refusal: the first few lines and how many more.
export function candidates(lines: string[], max = 12): string {
  if (!lines.length) return 'there are none'
  return lines.slice(0, max).join(', ') + (lines.length > max ? ` and ${lines.length - max} more` : '')
}

// What changed between two lists of things with ids, when it's one simple change: one added at the end (by ids: the
// rest of a stale list isn't an edit, and an add writes only the new one), one taken out (the rest the same), two side
// by side swapped, or one changed in place. Else null (rewrite the whole list).
export type ListChange<T> = { add: T } | { remove: T } | { move: T; by: -1 | 1 } | { edit: T; was: T } | { same: true }
export function oneChange<T extends { id: string }>(was: T[], next: T[], same: (a: T, b: T) => boolean): ListChange<T> | null {
  if (next.length === was.length + 1 && was.every((x, i) => next[i].id === x.id)) return { add: next[next.length - 1] }
  if (next.length === was.length - 1) {
    const i = was.findIndex((x, j) => next[j]?.id !== x.id)
    const at = i < 0 ? was.length - 1 : i
    const rest = [...was.slice(0, at), ...was.slice(at + 1)]
    if (rest.every((x, j) => next[j].id === x.id && same(x, next[j]))) return { remove: was[at] }
    return null
  }
  if (next.length !== was.length) return null
  const diff = was.map((_, i) => i).filter((i) => was[i].id !== next[i].id || !same(was[i], next[i]))
  if (!diff.length) return { same: true }
  if (diff.length === 1 && was[diff[0]].id === next[diff[0]].id) return { edit: next[diff[0]], was: was[diff[0]] }
  if (diff.length === 2 && diff[1] === diff[0] + 1 && was[diff[0]].id === next[diff[1]].id && was[diff[1]].id === next[diff[0]].id && same(was[diff[0]], next[diff[1]]) && same(was[diff[1]], next[diff[0]]))
    return { move: was[diff[0]], by: 1 }
  return null
}

// The one change an editor made to a list it may hold stale: what someone else added since (ids the editor's list
// lacks) is left out of the comparison, so it isn't read as taken out. Only an add at the end, an edit in place or a
// swap (taking out is never guessed: the editors take things out through their own call). Else null.
export function editorChange<T extends { id: string }>(now: T[], next: T[], same: (a: T, b: T) => boolean): ListChange<T> | null {
  const ids = new Set(next.map((x) => x.id))
  const kept = now.filter((x) => ids.has(x.id))
  const ch = oneChange(kept, next, same)
  return ch && !('remove' in ch) ? ch : null
}
