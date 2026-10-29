// What changed between two snapshots of a workspace (S3, agent.md §4.5 point 3): the preview's marks read this map.
// Keyed by id (Firestore ids, `main`, `<plane>_<card>`, `<matrix>_<row>_<col>` never meet across collections).
import { CARD_COLLECTION } from '../model/cards'
import type { WorkspaceCtx } from '../state/wsStore'
import type { Coll } from './types'

export type Change = {
  kind: Coll
  change: 'added' | 'removed' | 'changed' | 'moved'
  // The fields that differ (changed, moved).
  fields?: string[]
  // The item as it was (changed, moved, removed).
  was?: object
}

// Only where it is changed: its spot, or the plane or canvas it's on.
const PLACE_FIELDS = new Set(['x', 'y', 'pieceId', 'canvasId'])

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => same(x, (b as unknown[])[i]))
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined)
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined)
  return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

// The fields of two items that differ (a missing field and an undefined one are the same).
export function changedFields(a: object, b: object): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].filter((k) => !same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])).sort()
}

type Item = { id: string }
function lists(ws: WorkspaceCtx): [Coll, Item[]][] {
  return [
    ['canvases', ws.canvases],
    ['pieceSpots', ws.spots],
    ['pieces', ws.pieces],
    ...([...new Set(ws.cards.map((c) => c.type))].map((t) => [CARD_COLLECTION[t] as Coll, ws.cards.filter((c) => c.type === t)]) as [Coll, Item[]][]),
    ['labels', ws.labels],
    ['cells', ws.cells as unknown as Item[]],
    ['evidence', ws.evidence],
    ['competitorFeatures', ws.competitorFeatures],
    ['comparisons', ws.comparisons],
    ['edges', ws.edges],
    ['threads', ws.threads],
    ['tasks', ws.tasks],
    ['places', ws.places],
    ['workspace', [{ ...ws.workspace, id: ws.wid }]],
  ]
}

function index(ws: WorkspaceCtx) {
  const out = new Map<string, { kind: Coll; item: Item }>()
  for (const [kind, items] of lists(ws)) for (const item of items) out.set(item.id, { kind, item })
  return out
}

export function diff(a: WorkspaceCtx, b: WorkspaceCtx): Map<string, Change> {
  const out = new Map<string, Change>()
  const before = index(a)
  const after = index(b)
  for (const [id, { kind, item }] of after) {
    const was = before.get(id)
    if (!was) out.set(id, { kind, change: 'added' })
    else if (was.item !== item) {
      const fields = changedFields(was.item, item)
      if (fields.length) out.set(id, { kind, change: fields.every((f) => PLACE_FIELDS.has(f)) ? 'moved' : 'changed', fields, was: was.item })
    }
  }
  for (const [id, { kind, item }] of before) if (!after.has(id)) out.set(id, { kind, change: 'removed', was: item })
  return out
}
