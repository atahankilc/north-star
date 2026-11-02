// The prompt's data (D-222): one entry shape for every list in the prompt family (a menu, the right-click menu, a picker
// laid in place, a Select's options), and the rule that narrows it as you type. Drawn by PromptPanel / PromptList
// (src/ui/patterns), its rows by PromptRow (src/ui/primitives).
import type { ReactNode } from 'react'

// Whether shift or alt was held when a row was picked (D-281: ⇧↵ brings a card and goes on picking, ⌥↵ moves it).
export type How = { shift: boolean; alt: boolean }

export type PromptItem = {
  key: string
  label: ReactNode
  // Picked by a click or Enter; `'keep'` keeps the prompt open.
  onSelect: (how: How) => unknown
  // A row you tick (a filter's): a small box before the label, the prompt stays open.
  checked?: boolean
  // The value it has now (a Select's, the canvas you're on): its label cyan, `✓` at its end.
  current?: boolean
  // Colour of the tick or the glyph (a card's type, a link's kind).
  tone?: string
  // Faint on the right: data about it (`01 LUNCH`, `7 pieces`), never a key (D-344).
  hint?: ReactNode
  // Before the label: what it is (`▦`, a card's `▌`).
  glyph?: ReactNode
  // Its key in the prompt: typed alone, it puts the item first (not shown, D-344).
  letter?: string
  // Red: something that can't be taken lightly.
  danger?: boolean
  // Hangs under the item before it, off a line down from its glyph (go to's places inside a plane, D-201).
  indent?: boolean
  // What it holds folded under it: `▸ N inside` opens it (so does →, ← shuts it) (D-201).
  fold?: { open: boolean; count: number; noun?: string; onToggle: () => void }
  // Folded away under the item before it: shown only while searching (D-200).
  folded?: boolean
  // More words it's found by besides its label (a card's tags, its planes).
  words?: string
  // Shown only before anything is typed: a suggestion listed again further down.
  browse?: boolean
}

// A `# section` line (its `count` at the end of its rule); an empty heading is a plain rule (D-291).
export type PromptHeading = { key: string; heading: string; count?: ReactNode }

export type PromptEntry = PromptItem | PromptHeading

export const isHeading = (e: PromptEntry): e is PromptHeading => 'heading' in e

export const pickable = (entries: PromptEntry[]): PromptItem[] => entries.filter((e): e is PromptItem => !isHeading(e))

const text = (n: ReactNode): string => (typeof n === 'string' || typeof n === 'number' ? String(n) : '')
export const labelText = (i: PromptItem) => text(i.label)

// What a query shows. Nothing typed: everything but what's folded away. Typed: the items whose letter it is first, then
// those whose label (or words) hold it, then what `more` makes from it; no headings, no suggestions.
export function narrow(items: PromptEntry[], typed: string, more?: (typed: string) => PromptEntry[]): PromptEntry[] {
  const q = typed.trim().toLowerCase()
  if (!q) return items.filter((i) => isHeading(i) || !i.folded)
  const all = pickable(items).filter((i) => !i.browse)
  const keyed = q.length === 1 ? all.filter((i) => i.letter === q) : []
  const found = all.filter((i) => !keyed.includes(i) && `${labelText(i)} ${i.words ?? ''}`.toLowerCase().includes(q))
  return [...keyed, ...found, ...(more?.(typed.trim()) ?? [])]
}
