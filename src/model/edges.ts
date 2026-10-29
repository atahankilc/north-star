// What a link is, without Firebase (S3, D-312); data/edges.ts re-exports it and keeps the writes.
import type { AnyType } from './cards'

// A customer tag (D-044): item → customer.
export const FOR = 'for'

export type EdgeKind = 'relates' | 'depends-on' | 'contradicts' | 'part-of' | 'inspired-by' | 'solves' | 'competes-with' | typeof FOR | (string & {})

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

export const linked = (edges: Edge[], a: string, b: string) => edges.some((e) => (e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a))

// The links a card's deletion takes with it.
export const edgesOn = (edges: Edge[], ids: Set<string>) => edges.filter((e) => ids.has(e.fromId) || ids.has(e.toId))
