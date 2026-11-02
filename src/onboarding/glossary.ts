// The app's own words, explained where the onboarding uses them (D-355): a lesson's body marks the first time each
// one comes up on a page, coloured, its meaning on hover or focus. Plain words, one short line each. Pure: vitest
// checks it. Add a word here when a lesson starts leaning on it.

export type Term = { id: string; forms: readonly string[]; meaning: string }

export const TERMS: readonly Term[] = [
  { id: 'workspace', forms: ['workspace', 'workspaces'], meaning: 'One startup: its canvases, cards, tasks and the people working on it.' },
  { id: 'canvas', forms: ['canvas', 'canvases'], meaning: 'The big open space of a workspace, where every piece sits. You pan and zoom round it.' },
  { id: 'piece', forms: ['piece', 'pieces'], meaning: 'Anything placed on the canvas: a plane, a deck, a matrix, a table, a timeline, documents.' },
  { id: 'plane', forms: ['plane', 'planes'], meaning: 'A piece that holds cards and their links: a board to lay out one part of your thinking.' },
  { id: 'card', forms: ['card', 'cards'], meaning: 'One thing you know or believe: a customer, a problem, a competitor, an idea or a feature.' },
  { id: 'link', forms: ['link', 'links'], meaning: 'A line from one card to another that says how they relate: solves, competes with, part of…' },
  { id: 'deck', forms: ['deck', 'decks'], meaning: 'A piece with columns of tasks (or cards), like a kanban board: to do, doing, done.' },
  { id: 'task', forms: ['task', 'tasks'], meaning: 'A piece of work on a deck: who does it, by when, and the card it is for.' },
  { id: 'timeline', forms: ['timeline', 'timelines'], meaning: "A piece showing a deck's tasks on a strip of days." },
  { id: 'matrix', forms: ['matrix', 'matrices'], meaning: 'A piece that scores rows against columns, like features against competitors.' },
  { id: 'package', forms: ['package', 'packages'], meaning: 'Several cards grouped into one, so they move, fold and get rated together.' },
  { id: 'section', forms: ['section', 'sections'], meaning: 'A named frame drawn round things to group them; it carries what is inside it.' },
  { id: 'focus', forms: ['focus'], meaning: 'Going inside one piece so it fills the screen. Esc comes back out.' },
  { id: 'edit mode', forms: ['edit mode'], meaning: 'The mode in which pieces can be moved, resized, renamed or deleted. Pressed on and off.' },
  { id: 'console', forms: ['console', 'consoles'], meaning: "The small bar of buttons on a piece's bottom edge, shown when you point at it." },
  { id: 'dock', forms: ['dock', 'docks'], meaning: "The bar at the foot of the screen while you're in a focus: that piece's tools." },
  { id: 'side view', forms: ['side view'], meaning: 'Decks and days opened on the right of the screen, beside whatever you are looking at.' },
  { id: 'evidence', forms: ['evidence'], meaning: 'What backs a card or goes against it: an interview, a number, a source, with its date.' },
  { id: 'thread', forms: ['thread', 'threads'], meaning: 'A conversation of comments on one thing: a plane, a card, a text or a task.' },
]

// A body as plain runs and terms: only a term's first use in the text is marked, so a page never turns into a field of
// colour. Longest forms first (`edit mode` before `edit`); whole words only, any case.
export type TermBit = { text: string; term?: Term }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const FORMS = TERMS.flatMap((t) => t.forms.map((f) => ({ f, t }))).sort((a, b) => b.f.length - a.f.length)
const BY_FORM = new Map(FORMS.map(({ f, t }) => [f, t]))
const RE = new RegExp(`(?<![\\p{L}\\p{N}'’-])(${FORMS.map(({ f }) => escape(f)).join('|')})(?![\\p{L}\\p{N}'’-])`, 'giu')

export function terms(text: string, seen: Set<string> = new Set()): TermBit[] {
  const out: TermBit[] = []
  let at = 0
  for (const m of text.matchAll(RE)) {
    const t = BY_FORM.get(m[0].toLowerCase())
    if (!t || seen.has(t.id)) continue
    seen.add(t.id)
    if (m.index > at) out.push({ text: text.slice(at, m.index) })
    out.push({ text: m[0], term: t })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ text: text.slice(at) })
  return out
}
