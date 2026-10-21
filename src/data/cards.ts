// Cards on a plane (D-187): customers, problems, competitors, ideas and features, each in its own collection as before
// (D-037, D-040), now belonging to one plane (`pieceId`) at x/y in that plane's px (its top-left corner). Cards from the
// old board (no `pieceId`) stay where they are and aren't shown. A competitor keeps its title as `name`.
import { collection, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { absent, snapshotWith, tracked } from './history'
import { GRID, snap } from './grid'

export const CARD_TYPES = ['customer', 'problem', 'competitor', 'idea', 'feature'] as const
export type CardType = (typeof CARD_TYPES)[number]

export const CARD_COLLECTION: Record<CardType, string> = {
  customer: 'customers',
  problem: 'problems',
  competitor: 'competitors',
  idea: 'ideas',
  feature: 'features',
}

// Every card is the same rectangle (D-055): 8 × 4 grid steps, so a snapped card has a mark on each corner.
export const CARD = { w: 8 * GRID, h: 4 * GRID }

// firestore.rules' validCard and validCompetitor allow 200.
export const TITLE_MAX = 200

// What the card shows besides its title (D-152, D-205): set from the side panel, which isn't back yet, so for now only
// read. A customer, problem or idea has a status (D-137); a competitor its regions (D-145); a feature its priority,
// status, impact and effort (D-138); all of them tags (D-056).
export type Validation = 'hypothesis' | 'testing' | 'validated' | 'invalidated'
export type CardFields = {
  tags?: string[]
  validation?: Validation
  regions?: string[]
  priority?: string
  status?: string
  impact?: string
  effort?: string
}

export type Card = { id: string; type: CardType; pieceId: string; title: string; x: number; y: number } & CardFields

const ref = (wid: string, type: CardType, id?: string) =>
  id ? doc(collection(db(), 'workspaces', wid, CARD_COLLECTION[type]), id) : doc(collection(db(), 'workspaces', wid, CARD_COLLECTION[type]))

// For undo's labels: `an idea`, `a feature`.
const one = (type: CardType) => `${type === 'idea' ? 'an' : 'a'} ${type}`

const titleField = (type: CardType) => (type === 'competitor' ? 'name' : 'title')

const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  a.x < b.x + CARD.w + GRID && b.x < a.x + CARD.w + GRID && a.y < b.y + CARD.h + GRID && b.y < a.y + CARD.h + GRID

// A new card centred on `at` (plane px), on the grid, moved right past any card it would cover: one undo step.
export async function addCard(wid: string, pieceId: string, type: CardType, at: [number, number], others: Card[]) {
  const r = ref(wid, type)
  const spot = { x: snap(at[0] - CARD.w / 2), y: snap(at[1] - CARD.h / 2) }
  for (let hit = others.find((o) => overlaps(spot, o)); hit; hit = others.find((o) => overlaps(spot, o))) spot.x = hit.x + CARD.w + GRID
  const now = Date.now()
  await tracked(`add ${one(type)}`, [r], () => setDoc(r, { [titleField(type)]: '', pieceId, ...spot, createdAt: now, updatedAt: now }), { before: absent([r]) })
  return r.id
}

// The end of a drag: one undo step from where it started.
export async function moveCard(wid: string, card: Card, to: [number, number]) {
  const r = ref(wid, card.type, card.id)
  const before = await snapshotWith(r, { x: card.x, y: card.y })
  return tracked(`move ${one(card.type)}`, [r], () => updateDoc(r, { x: to[0], y: to[1], updatedAt: Date.now() }), { before })
}

// Typing merges into one undo step.
export function retitleCard(wid: string, card: Card, title: string) {
  const r = ref(wid, card.type, card.id)
  return tracked(`rename ${one(card.type)}`, [r], () => updateDoc(r, { [titleField(card.type)]: title.slice(0, TITLE_MAX), updatedAt: Date.now() }), {
    key: `card-title:${card.id}`,
  })
}

export function deleteCard(wid: string, card: Card) {
  const r = ref(wid, card.type, card.id)
  return tracked(`delete ${one(card.type)}`, [r], () => deleteDoc(r))
}

// Docs from any of the five collections, as cards; the old board's (no `pieceId`) are left out.
export function toCards(type: CardType, docs: ({ id: string; pieceId?: string; title?: string; name?: string; x?: number; y?: number } & CardFields)[]): Card[] {
  return docs.flatMap((d) =>
    d.pieceId
      ? [
          {
            id: d.id,
            type,
            pieceId: d.pieceId,
            title: (type === 'competitor' ? d.name : d.title) ?? '',
            x: d.x ?? 0,
            y: d.y ?? 0,
            tags: d.tags,
            validation: d.validation,
            regions: d.regions,
            priority: d.priority,
            status: d.status,
            impact: d.impact,
            effort: d.effort,
          },
        ]
      : [],
  )
}

export const cardRef = ref

// The box round a plane's cards, in its px; null when it has none.
export function cardBounds(cards: Card[]) {
  if (!cards.length) return null
  const x0 = Math.min(...cards.map((c) => c.x))
  const y0 = Math.min(...cards.map((c) => c.y))
  const x1 = Math.max(...cards.map((c) => c.x + CARD.w))
  const y1 = Math.max(...cards.map((c) => c.y + CARD.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
