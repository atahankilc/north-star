// The workspace as docs in memory, for project and validate (S3).
//
// The choice (documented as the S3 brief asks): project works on **docs**, not items. A WorkspaceCtx holds items (what
// the listeners made from the docs), so `toDocs` turns each item back into the doc fields the listeners read: for most
// collections the item *is* the doc (`{ ...data, id }`, hooks.ts), so it's used as it is; a card becomes its doc
// again (`cardDoc`: title ↔ `name` for a competitor, notes ↔ `body`), a piece loses the `canvases` its spots gave it,
// and the implied first canvas (no doc yet) has none. The writes are then played onto those docs with Firestore's
// semantics (`set` replaces, `patch` merges fields and dotted paths, DELETE takes a field away, `del` removes), and the
// result goes through the very converters the listeners run (src/model/fromDocs.ts). So "project equals what apply
// writes" comes down to two things a test checks (tests/unit/ops.test.ts): fromDocs(toDocs(ws)) gives ws back, and
// these write semantics match Firestore's (a fake doc store written independently).
//
// What it can't see: docs the listeners skip (a card without a plane, a place whose plane is gone…) aren't in the
// items, so a write that would bring one back isn't shown. Fields the converters never read (a card's createdAt) aren't
// in the items either, which changes nothing they make. Documents pass through unchanged (who may see one depends on
// who's signed in; their writes come with S4+).
import { cardDoc } from '../model/cards'
import { MAIN } from '../model/canvases'
import { CARD_COLLECTION, type Card } from '../model/cards'
import { WS_COLLECTIONS, type Docs, type RawDoc, type WsCollection } from '../model/fromDocs'
import type { WorkspaceCtx } from '../state/wsStore'
import { isDelete, type Coll, type Write } from './types'

export type DocStore = Map<Coll, Map<string, RawDoc>>

// A piece's doc: without the canvases its spots give it (the same object each time for the same piece).
const pieceDocs = new WeakMap<object, RawDoc>()
function pieceDoc(p: RawDoc): RawDoc {
  if (!('canvases' in p)) return p
  let d = pieceDocs.get(p)
  if (!d) {
    const { canvases: _, ...rest } = p
    d = rest as RawDoc
    pieceDocs.set(p, d)
  }
  return d
}

const cardDocs = new WeakMap<Card, RawDoc>()
function docOfCard(c: Card): RawDoc {
  let d = cardDocs.get(c)
  if (!d) {
    d = cardDoc(c) as unknown as RawDoc
    cardDocs.set(c, d)
  }
  return d
}

// The workspace's items as the docs they came from, by collection, plus the workspace doc.
export function toDocs(ws: WorkspaceCtx): DocStore {
  const store: DocStore = new Map()
  for (const c of WS_COLLECTIONS) store.set(c, new Map())
  const put = (coll: Coll, d: RawDoc) => store.get(coll)!.set(d.id, d)
  // The implied first canvas (canvasList adds it, `createdAt` 0) has no doc.
  for (const c of ws.canvases) if (!(c.id === MAIN && !c.createdAt)) put('canvases', c as unknown as RawDoc)
  for (const s of ws.spots) put('pieceSpots', s as unknown as RawDoc)
  for (const p of ws.pieces) put('pieces', pieceDoc(p as unknown as RawDoc))
  for (const c of ws.cards) put(CARD_COLLECTION[c.type] as WsCollection, docOfCard(c))
  for (const l of ws.labels) put('labels', l as unknown as RawDoc)
  for (const k of ['cells', 'evidence', 'competitorFeatures', 'comparisons', 'edges', 'threads', 'tasks', 'places'] as const)
    for (const d of ws[k] as unknown as RawDoc[]) put(k, d)
  store.set('workspace', new Map([[ws.wid, ws.workspace as unknown as RawDoc]]))
  return store
}

// Firestore lists a collection's docs by id: a store as the listeners would get it.
const byId = (a: RawDoc, b: RawDoc) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
export function docsOf(store: DocStore): Docs {
  return Object.fromEntries(WS_COLLECTIONS.map((c) => [c, [...store.get(c)!.values()].sort(byId)])) as Docs
}

export class WriteError extends Error {}

// A dotted path's value set (or taken away) in a copy of `o`, the copies only along the path.
function setPath(o: Record<string, unknown>, path: string[], v: unknown): Record<string, unknown> {
  const [k, ...rest] = path
  const out = { ...o }
  if (!rest.length) {
    if (isDelete(v)) delete out[k]
    else out[k] = v
    return out
  }
  const inner = out[k]
  // Firestore's update makes the maps along a path (and replaces a value that isn't one).
  if (isDelete(v) && (!inner || typeof inner !== 'object')) return out
  out[k] = setPath(inner && typeof inner === 'object' && !Array.isArray(inner) ? (inner as Record<string, unknown>) : {}, rest, v)
  return out
}

const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && !isDelete(v)

// Firestore's set with merge: maps merged field by field, anything else (arrays too) replaced, DELETE takes a field away.
function mergeInto(was: Record<string, unknown>, fields: Record<string, unknown>): Record<string, unknown> {
  const out = { ...was }
  for (const [k, v] of Object.entries(fields)) {
    if (isDelete(v)) delete out[k]
    else if (isMap(v)) out[k] = mergeInto(isMap(out[k]) ? (out[k] as Record<string, unknown>) : {}, v)
    else out[k] = v
  }
  return out
}

// One write played onto the store, as Firestore would: never changes a doc object in place (an unchanged doc keeps its
// object, so what's drawn from it stays memoised). A patch on a doc that isn't there fails, as Firestore's update does.
export function writeTo(store: DocStore, w: Write) {
  const coll = store.get(w.coll)
  if (!coll) throw new WriteError(`no collection ${w.coll}`)
  if (w.del) {
    // The workspace doc is never deleted by an op.
    coll.delete(w.id)
  } else if (w.set && w.merge) {
    coll.set(w.id, { ...mergeInto(coll.get(w.id) ?? {}, w.set), id: w.id } as RawDoc)
  } else if (w.set) {
    coll.set(w.id, { ...w.set, id: w.id })
  } else if (w.patch) {
    const was = coll.get(w.id)
    if (!was) throw new WriteError(`${w.coll}/${w.id} doesn't exist`)
    let next: Record<string, unknown> = was
    for (const [k, v] of Object.entries(w.patch)) next = setPath(next, k.split('.'), v)
    coll.set(w.id, { ...next, id: w.id } as RawDoc)
  }
}

export const exists = (store: DocStore, coll: Coll, id: string) => !!store.get(coll)?.has(id)
export const docAt = (store: DocStore, coll: Coll, id: string) => store.get(coll)?.get(id)
