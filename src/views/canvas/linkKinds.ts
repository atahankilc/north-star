// What a link says, and how the board draws it (D-108): four groups by meaning, each with its own colour, and a line
// pattern per kind inside the group. Shared by the board, the link bar, the LINKS filter and the panel's link list.
import { FOR, type EdgeKind } from '../../data/model'

export type LinkGroup = 'solves' | 'clashes' | 'draws' | 'plain'

type KindStyle = { label: string; group: LinkGroup; dash?: [number, number] }

export const LINK_KINDS: Record<string, KindStyle> = {
  solves: { label: 'solves', group: 'solves' },
  'part-of': { label: 'part of', group: 'solves', dash: [0.18, 0.1] },
  'competes-with': { label: 'competes', group: 'clashes' },
  contradicts: { label: 'contradicts', group: 'clashes', dash: [0.06, 0.06] },
  'inspired-by': { label: 'inspired by', group: 'draws', dash: [0.03, 0.07] },
  'depends-on': { label: 'depends on', group: 'draws', dash: [0.18, 0.1] },
  relates: { label: 'relates', group: 'plain' },
  [FOR]: { label: 'for', group: 'plain', dash: [0.03, 0.07] },
}

// In the order the kind pickers list them.
export const EDGE_KINDS: EdgeKind[] = ['relates', 'solves', 'part-of', 'competes-with', 'contradicts', 'inspired-by', 'depends-on', FOR]

export const LINK_GROUPS: { key: LinkGroup; label: string }[] = [
  { key: 'solves', label: 'solves · part of' },
  { key: 'clashes', label: 'competes · contradicts' },
  { key: 'draws', label: 'inspired by · depends on' },
  { key: 'plain', label: 'relates · for' },
]

// For the DOM (follows the theme by itself); WebGL uses `palette.link[group]`.
export const LINK_TONE: Record<LinkGroup, string> = {
  solves: 'var(--link-solves)',
  clashes: 'var(--link-clashes)',
  draws: 'var(--link-draws)',
  plain: 'var(--link-plain)',
}

export function linkStyle(kind: string): KindStyle {
  return LINK_KINDS[kind] ?? { label: kind, group: 'plain' }
}
