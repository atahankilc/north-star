// What a link says, and how the board draws it (D-108): four groups by meaning, each with its own colour, and a line
// pattern per kind inside the group. Customer tags (`for`) are a group of their own; they and `relates` are hidden by default (D-128).
// `part of` and `depends on` are groups of their own in the colour of `solves` / `inspired by`, so each can be hidden alone.
// `competes` is its own group too, in the clashes colour, hidden by default (D-135): the matrix says the same, and its
// lines cross the whole board. Shared by the board, the link bar, the LINKS filter and the panel's link list.
import { FOR, type EdgeKind } from '../../data/model'

export type LinkGroup = 'solves' | 'part' | 'competes' | 'clashes' | 'draws' | 'depends' | 'plain' | 'for'

type KindStyle = { label: string; group: LinkGroup; dash?: [number, number] }

export const LINK_KINDS: Record<string, KindStyle> = {
  solves: { label: 'solves', group: 'solves' },
  'part-of': { label: 'part of', group: 'part', dash: [0.18, 0.1] },
  'competes-with': { label: 'competes', group: 'competes' },
  contradicts: { label: 'contradicts', group: 'clashes', dash: [0.06, 0.06] },
  'inspired-by': { label: 'inspired by', group: 'draws', dash: [0.03, 0.07] },
  'depends-on': { label: 'depends on', group: 'depends', dash: [0.18, 0.1] },
  relates: { label: 'relates', group: 'plain' },
  [FOR]: { label: 'for', group: 'for', dash: [0.03, 0.07] },
}

// In the order the kind pickers list them.
export const EDGE_KINDS: EdgeKind[] = ['relates', 'solves', 'part-of', 'competes-with', 'contradicts', 'inspired-by', 'depends-on', FOR]

export const LINK_GROUPS: { key: LinkGroup; label: string }[] = [
  { key: 'solves', label: 'solves' },
  { key: 'part', label: 'part of' },
  { key: 'competes', label: 'competes (competitors)' },
  { key: 'clashes', label: 'contradicts' },
  { key: 'draws', label: 'inspired by' },
  { key: 'depends', label: 'depends on' },
  { key: 'plain', label: 'relates' },
  { key: 'for', label: 'for (customer tags)' },
]

// For the DOM (follows the theme by itself); WebGL uses `palette.link[group]`.
export const LINK_TONE: Record<LinkGroup, string> = {
  solves: 'var(--link-solves)',
  part: 'var(--link-solves)',
  competes: 'var(--link-clashes)',
  clashes: 'var(--link-clashes)',
  draws: 'var(--link-draws)',
  depends: 'var(--link-draws)',
  plain: 'var(--link-plain)',
  for: 'var(--link-plain)',
}

export function linkStyle(kind: string): KindStyle {
  return LINK_KINDS[kind] ?? { label: kind, group: 'plain' }
}
