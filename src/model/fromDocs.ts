// Firestore docs → the workspace's items, without Firebase or React (S3, D-312): the one conversion the live listeners
// (data/workspaceData.ts' `useWorkspaceData`, a step per memo) and the ops' `project` (src/ops/project.ts, all at once)
// both run, so a preview can never draw something the real write wouldn't.
//
// Every doc here is `{ ...data, id }`, as hooks.ts' useQuery gives it. What a step leaves out is not the app's (a card,
// label or thread without its space, a canvas without a name, a place or spot whose two ends aren't both there).
import { ALL_TYPES, CARD_COLLECTION, toCards, type AnyType, type Card, type CardDoc } from './cards'
import { canvasList, canvasOf, type Canvas, type Spot } from './canvases'
import type { WithId } from '../data/hooks'
import type { Piece, Thread } from '../data/model'
import type { Label } from './labels'
import type { Place } from '../data/places'
import type { WorkspaceData } from '../data/workspaceData'

// A raw doc with its id.
export type RawDoc = Record<string, unknown> & { id: string }

// The workspace's collections the listeners read, by their Firestore names (documents are read apart: who may see one
// depends on who's signed in, documents.ts' useDocuments).
export const WS_COLLECTIONS = [
  'canvases',
  'pieceSpots',
  'pieces',
  'customers',
  'problems',
  'competitors',
  'ideas',
  'features',
  'packages',
  'labels',
  'cells',
  'evidence',
  'competitorFeatures',
  'comparisons',
  'edges',
  'threads',
  'tasks',
  'places',
] as const
export type WsCollection = (typeof WS_COLLECTIONS)[number]
export type Docs = Record<WsCollection, RawDoc[]>

// The card type a card collection holds.
export const TYPE_OF_COLLECTION = Object.fromEntries(ALL_TYPES.map((t) => [CARD_COLLECTION[t], t])) as Record<string, AnyType>

// ---- One step each (the hook memoises them one by one).

export const canvasesFrom = (docs: RawDoc[]): Canvas[] => canvasList(docs as unknown as WithId<Omit<Canvas, 'id'>>[])

// Spots whose piece and canvas are both there.
export function spotsFrom(docs: RawDoc[], pieces: { id: string }[], canvases: Canvas[]): Spot[] {
  const ids = new Set(pieces.map((p) => p.id))
  const names = new Set(canvases.map((c) => c.id))
  return (docs as unknown as Spot[]).filter((s) => ids.has(s.pieceId) && names.has(s.canvasId))
}

// A piece on more than its own canvas (D-302's session 3) with them: the same object while it and they are the same.
const withCanvases = new WeakMap<object, { key: string; piece: WithId<Piece> }>()
function onCanvases(p: WithId<Piece>, canvases: string[]): WithId<Piece> {
  const key = canvases.join(' ')
  const was = withCanvases.get(p)
  if (was?.key === key) return was.piece
  const piece = { ...p, canvases }
  withCanvases.set(p, { key, piece })
  return piece
}

// Each piece says the canvases it's on when that's more than its own; the others stay the same objects.
export function piecesFrom(docs: RawDoc[], spots: Spot[]): WithId<Piece>[] {
  const pieces = docs as unknown as WithId<Piece>[]
  if (!spots.length) return pieces
  const on = new Map<string, Spot[]>()
  for (const s of spots) on.set(s.pieceId, [...(on.get(s.pieceId) ?? []), s])
  return pieces.map((p) => {
    const ss = on.get(p.id)?.filter((s) => s.canvasId !== canvasOf(p))
    return ss?.length ? onCanvases(p, [canvasOf(p), ...ss.sort((a, b) => a.createdAt - b.createdAt).map((s) => s.canvasId)]) : p
  })
}

// Every card collection's docs as cards, in the chain's order (customers … features, packages).
export function cardsFrom(byType: Record<AnyType, RawDoc[]>): Card[] {
  return [
    ...toCards('customer', byType.customer as CardDoc[]),
    ...toCards('problem', byType.problem as CardDoc[]),
    ...toCards('competitor', byType.competitor as CardDoc[]),
    ...toCards('idea', byType.idea as CardDoc[]),
    ...toCards('feature', byType.feature as CardDoc[]),
    ...toCards('package', byType.package as CardDoc[]),
  ]
}

// Text always has a space (`pieceId`); a doc without one isn't the app's.
export const labelsFrom = (docs: RawDoc[]): Label[] => (docs as unknown as Label[]).filter((l) => l.pieceId)

// Comment threads each have a space (`planeId`); one without is skipped.
export const threadsFrom = (docs: RawDoc[]): WithId<Thread>[] => (docs as unknown as WithId<Thread>[]).filter((t) => t.planeId)

// Places whose plane and card are both there.
export function placesFrom(docs: RawDoc[], pieces: WithId<Piece>[], cards: Card[]): Place[] {
  const planes = new Set(pieces.filter((p) => p.kind === 'plane').map((p) => p.id))
  const ids = new Set(cards.map((c) => c.id))
  return (docs as unknown as Place[]).filter((p) => planes.has(p.planeId) && ids.has(p.cardId))
}

// A card on more than its home (D-281) with its planes: the same object while it and its planes are the same.
const withPlanes = new WeakMap<Card, { key: string; card: Card }>()
function planesOn(c: Card, planes: string[]): Card {
  const key = planes.join(' ')
  const was = withPlanes.get(c)
  if (was?.key === key) return was.card
  const card = { ...c, planes }
  withPlanes.set(c, { key, card })
  return card
}

// Each card says the planes it's on when that's more than its home (D-281); the others stay the same objects.
export function placedFrom(cards: Card[], places: Place[]): Card[] {
  if (!places.length) return cards
  const on = new Map<string, Place[]>()
  for (const p of places) on.set(p.cardId, [...(on.get(p.cardId) ?? []), p])
  return cards.map((c) => {
    const ps = on.get(c.id)?.filter((p) => p.planeId !== c.pieceId)
    return ps?.length ? planesOn(c, [c.pieceId, ...ps.sort((a, b) => a.createdAt - b.createdAt).map((p) => p.planeId)]) : c
  })
}

// ---- All at once (the ops' project, tests): the same steps in the hook's order. `documents` pass through as given.
export function fromDocs(docs: Docs, documents: WorkspaceData['documents'] = []): WorkspaceData {
  const canvases = canvasesFrom(docs.canvases)
  const spots = spotsFrom(docs.pieceSpots, docs.pieces, canvases)
  const pieces = piecesFrom(docs.pieces, spots)
  const cards = cardsFrom(Object.fromEntries(ALL_TYPES.map((t) => [t, docs[CARD_COLLECTION[t] as WsCollection]])) as Record<AnyType, RawDoc[]>)
  // Places are checked against the pieces as stored (the hook's `pieces.data`), not the ones with canvases.
  const places = placesFrom(docs.places, docs.pieces as unknown as WithId<Piece>[], cards)
  return {
    canvases,
    spots,
    pieces,
    cards: placedFrom(cards, places),
    labels: labelsFrom(docs.labels),
    threads: threadsFrom(docs.threads),
    cells: docs.cells as unknown as WorkspaceData['cells'],
    evidence: docs.evidence as unknown as WorkspaceData['evidence'],
    competitorFeatures: docs.competitorFeatures as unknown as WorkspaceData['competitorFeatures'],
    comparisons: docs.comparisons as unknown as WorkspaceData['comparisons'],
    edges: docs.edges as unknown as WorkspaceData['edges'],
    documents,
    tasks: docs.tasks as unknown as WorkspaceData['tasks'],
    places,
  }
}
