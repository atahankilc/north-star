// What a link is, without Firebase (S3, D-312); data/edges.ts re-exports it and keeps the writes.
import type { AnyType } from './cards'

// A customer tag (D-044): item → customer.
export const FOR = 'for'

// Every kind of link, once (D-394): its words on a line, in a panel and in a menu, and the group its colour
// (`--link-<group>`) and the plane's filter go by; in the filter's and the link bar's order. A kind is named nowhere
// else: the type, the agent's choices and the order it reads them in come from here.
export const LINK_KINDS = [
  { kind: 'solves', label: 'solves', group: 'solves' },
  { kind: 'part-of', label: 'part of', group: 'part' },
  { kind: 'competes-with', label: 'competes', group: 'competes' },
  { kind: 'contradicts', label: 'contradicts', group: 'clashes' },
  { kind: 'inspired-by', label: 'inspired by', group: 'draws' },
  { kind: 'depends-on', label: 'depends on', group: 'depends' },
  { kind: 'relates', label: 'relates', group: 'plain' },
  { kind: FOR, label: 'for', group: 'for' },
] as const
export type KnownKind = (typeof LINK_KINDS)[number]['kind']
export type LinkGroup = (typeof LINK_KINDS)[number]['group']
export type EdgeKind = KnownKind | (string & {})

const BY_KIND = new Map<string, (typeof LINK_KINDS)[number]>(LINK_KINDS.map((k) => [k.kind, k]))
// A kind nobody knows (old data, another app's) reads as its own name and goes with the plain ones.
export const linkLabel = (kind: string): string => BY_KIND.get(kind)?.label ?? kind
export const linkGroup = (kind: string): LinkGroup => BY_KIND.get(kind)?.group ?? 'plain'

// The same kinds in two more orders (tests/unit/sameLists.test.ts holds each to LINK_KINDS): what the agent may pick
// (the plain one first), and how it reads a card's links (the chain's order, then the rest).
export const PICK_ORDER = ['relates', 'solves', 'part-of', 'competes-with', 'contradicts', 'inspired-by', 'depends-on', FOR] as const satisfies readonly KnownKind[]
export const READ_ORDER: readonly KnownKind[] = ['solves', 'competes-with', 'inspired-by', 'part-of', 'depends-on', 'contradicts', 'relates', FOR]

// Always straight: bend points (1.0's D-155) are gone (D-292).
export type Edge = { id: string; fromId: string; fromType: string; toId: string; toType: string; kind: EdgeKind; label?: string }

// The kind a link gets when drawn from one card to another (the old board's defaultKind); changed in its bar.
export function defaultKind(from: AnyType, to: AnyType): EdgeKind {
  if (to === 'customer' && from !== 'customer') return FOR
  if (from === 'idea' && to === 'problem') return 'solves'
  if (from === 'competitor' && (to === 'problem' || to === 'idea')) return 'competes-with'
  if (from === 'feature' && to === 'idea') return 'inspired-by'
  return 'relates'
}
