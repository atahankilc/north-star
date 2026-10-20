// What a link says, and how the board draws it (D-108, D-146): each kind its own group, its own colour and a solid
// line (violet solves, sky part of, orange competes, raspberry contradicts, gold inspired by, moss depends on, grey
// relates, near-white for). Customer tags (`for`) and `relates` are hidden by default
// (D-128), `competes` too (D-135): the matrix says the same, and its lines cross the whole board. Shared by the board,
// the link bar, the LINKS filter and the panel's link list.
import { FOR, type EdgeKind } from '../../data/model'

export type LinkGroup = 'solves' | 'part' | 'competes' | 'clashes' | 'draws' | 'depends' | 'plain' | 'for'

type KindStyle = { label: string; group: LinkGroup }

export const LINK_KINDS: Record<string, KindStyle> = {
  solves: { label: 'solves', group: 'solves' },
  'part-of': { label: 'part of', group: 'part' },
  'competes-with': { label: 'competes', group: 'competes' },
  contradicts: { label: 'contradicts', group: 'clashes' },
  'inspired-by': { label: 'inspired by', group: 'draws' },
  'depends-on': { label: 'depends on', group: 'depends' },
  relates: { label: 'relates', group: 'plain' },
  [FOR]: { label: 'for', group: 'for' },
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
  part: 'var(--link-part)',
  competes: 'var(--link-competes)',
  clashes: 'var(--link-clashes)',
  draws: 'var(--link-draws)',
  depends: 'var(--link-depends)',
  plain: 'var(--link-plain)',
  for: 'var(--link-for)',
}

export function linkStyle(kind: string): KindStyle {
  return LINK_KINDS[kind] ?? { label: kind, group: 'plain' }
}
