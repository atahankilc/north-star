// Cards on a plane (D-187): customers, problems, competitors, ideas and features, each in its own collection as before
// (D-037, D-040), now belonging to one plane (`pieceId`) at x/y in that plane's px (its top-left corner). Cards from the
// old board (no `pieceId`) stay where they are and aren't shown. A competitor keeps its title as `name`.
import { collection, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { absent, snapshotWith, tracked } from './history'
import { GRID, snap } from './grid'
import { edgeRef, edgesOn, type Edge } from './edges'

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
  // Its notes (D-219): a competitor's `notes`, every other card's `body`.
  notes?: string
  // A competitor's profile (D-219): what it does, for whom, its price, its site.
  description?: string
  audience?: string
  pricing?: string
  url?: string
  // A feature's must-haves (D-133), which a matrix scores.
  criteria?: { id: string; text: string }[]
  // A feature's parts folded into it as names beside it (D-164, D-225); only `true` is stored.
  folded?: boolean
}

export const VALIDATIONS: Validation[] = ['hypothesis', 'testing', 'validated', 'invalidated']
export const FEATURE_PRIORITIES = ['P1', 'P2', 'P3']
export const FEATURE_STATUSES = ['idea', 'planned', 'building', 'shipped']
export const FEATURE_IMPACTS = ['low', 'medium', 'high']
export const FEATURE_EFFORTS = ['S', 'M', 'L']

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

// Several at once, one undo step: a folded feature carries its parts (D-164).
export async function moveCards(wid: string, moves: { card: Card; to: [number, number] }[]) {
  const refs = moves.map((m) => ref(wid, m.card.type, m.card.id))
  const before = (await Promise.all(moves.map((m, i) => snapshotWith(refs[i], { x: m.card.x, y: m.card.y })))).flat()
  return tracked(`move ${moves.length > 1 ? `${moves.length} cards` : one(moves[0].card.type)}`, refs, () => {
    const batch = writeBatch(db())
    const now = Date.now()
    moves.forEach((m, i) => batch.update(refs[i], { x: m.to[0], y: m.to[1], updatedAt: now }))
    return batch.commit()
  }, { before })
}

// Typing merges into one undo step.
export function retitleCard(wid: string, card: Card, title: string) {
  const r = ref(wid, card.type, card.id)
  return tracked(`rename ${one(card.type)}`, [r], () => updateDoc(r, { [titleField(card.type)]: title.slice(0, TITLE_MAX), updatedAt: Date.now() }), {
    key: `card-title:${card.id}`,
  })
}

// Fields from its panel (D-219): `undefined` clears one. `notes` is stored as a competitor's `notes`, any other card's
// `body`. Typing in one field merges into one undo step.
export function updateCard(wid: string, card: Card, fields: Partial<CardFields>, what = 'edit') {
  const r = ref(wid, card.type, card.id)
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k === 'notes' && card.type !== 'competitor' ? 'body' : k] = v === undefined ? deleteField() : v
  const keys = Object.keys(fields).sort().join(',')
  return tracked(`${what} ${one(card.type)}`, [r], () => updateDoc(r, data), { key: `card:${card.id}:${keys}` })
}

// Several cards and their links, one undo step (D-227: a selection's Delete).
export function deleteCards(wid: string, list: Card[], edges: Edge[] = []) {
  const ids = new Set(list.map((c) => c.id))
  const refs = [...list.map((c) => ref(wid, c.type, c.id)), ...edgesOn(edges, ids).map((e) => edgeRef(wid, e.id))]
  return tracked(`delete ${list.length} cards`, refs, async () => {
    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(db())
      refs.slice(i, i + 450).forEach((r) => batch.delete(r))
      await batch.commit()
    }
  })
}

// The same fields on several cards, one undo step (a selection's tag).
export function updateCards(wid: string, list: { card: Card; fields: Partial<CardFields> }[], what: string) {
  const refs = list.map((x) => ref(wid, x.card.type, x.card.id))
  return tracked(what, refs, () => {
    const batch = writeBatch(db())
    const now = Date.now()
    list.forEach((x, i) => {
      const data: Record<string, unknown> = { updatedAt: now }
      for (const [k, v] of Object.entries(x.fields)) data[k === 'notes' && x.card.type !== 'competitor' ? 'body' : k] = v === undefined ? deleteField() : v
      batch.update(refs[i], data)
    })
    return batch.commit()
  })
}

// Copies of cards on a plane, moved by `by`, with the links between them (D-227: paste, duplicate): one undo step.
// Returns the new cards' ids, in order.
export function copyCards(wid: string, pieceId: string, list: Card[], edges: Edge[], by: [number, number]) {
  const made = new Map(list.map((c) => [c.id, ref(wid, c.type)]))
  const ids = new Set(list.map((c) => c.id))
  const inner = edges.filter((e) => ids.has(e.fromId) && ids.has(e.toId))
  const links = inner.map(() => doc(collection(db(), 'workspaces', wid, 'edges')))
  const now = Date.now()
  const fieldsOf = (c: Card) => {
    const d: Record<string, unknown> = {
      [titleField(c.type)]: c.title,
      pieceId,
      x: c.x + by[0],
      y: c.y + by[1],
      createdAt: now,
      updatedAt: now,
    }
    for (const k of ['tags', 'validation', 'regions', 'priority', 'status', 'impact', 'effort', 'description', 'audience', 'pricing', 'url', 'criteria', 'folded'] as const)
      if (c[k] !== undefined) d[k] = c[k]
    if (c.notes) d[c.type === 'competitor' ? 'notes' : 'body'] = c.notes
    return d
  }
  const refs = [...made.values(), ...links]
  void tracked(list.length > 1 ? `paste ${list.length} cards` : `paste ${one(list[0].type)}`, refs, () => {
    const batch = writeBatch(db())
    list.forEach((c) => batch.set(made.get(c.id)!, fieldsOf(c)))
    inner.forEach((e, i) =>
      batch.set(links[i], { fromId: made.get(e.fromId)!.id, fromType: e.fromType, toId: made.get(e.toId)!.id, toType: e.toType, kind: e.kind, ...(e.label ? { label: e.label } : {}) }),
    )
    return batch.commit()
  }, { before: absent(refs) })
  return list.map((c) => made.get(c.id)!.id)
}

// With its links (D-207): one undo step brings them all back.
export function deleteCard(wid: string, card: Card, edges: Edge[] = []) {
  const refs = [ref(wid, card.type, card.id), ...edgesOn(edges, new Set([card.id])).map((e) => edgeRef(wid, e.id))]
  return tracked(`delete ${one(card.type)}`, refs, () => {
    const batch = writeBatch(db())
    refs.forEach((r) => batch.delete(r))
    return batch.commit()
  })
}

// Docs from any of the five collections, as cards; the old board's (no `pieceId`) are left out.
type CardDoc = { id: string; pieceId?: string; title?: string; name?: string; x?: number; y?: number; body?: string } & CardFields

export function toCards(type: CardType, docs: CardDoc[]): Card[] {
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
            notes: type === 'competitor' ? d.notes : d.body,
            description: d.description,
            audience: d.audience,
            pricing: d.pricing,
            url: d.url,
            criteria: d.criteria,
            folded: d.folded,
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
