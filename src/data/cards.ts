// Cards on a plane (D-187): customers, problems, competitors, ideas, features and packages, each in its own collection
// (D-037, D-040), at home on one plane (`pieceId`) at x/y in that plane's px (its top-left corner); other planes it's on
// keep its spot there in `places` (D-281, places.ts). A competitor keeps its title as `name`.
import { collection, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { absent, discardNew, snapshotWith, tracked } from './history'
import { GRID, snap } from '../model/grid'
import { edgeRef, edgesOn, type Edge } from './edges'
import { CANVAS } from './labels'
import { canvasField } from './canvases'

// What a card is (its types, fields, the doc → card conversion) lives in src/model/cards.ts, without Firebase (S3).
export { CARD_TYPES, ALL_TYPES, CARD_COLLECTION, CARD, TITLE_MAX, VALIDATIONS, FEATURE_PRIORITIES, FEATURE_STATUSES, FEATURE_IMPACTS, FEATURE_EFFORTS, isOnPlane, toCards, cardDoc } from '../model/cards'
export type { CardType, AnyType, Validation, CardFields, Card } from '../model/cards'
import { CARD, CARD_COLLECTION, TITLE_MAX, titleField, type AnyType, type Card, type CardFields, type CardType } from '../model/cards'

const ref = (wid: string, type: AnyType, id?: string) =>
  id ? doc(collection(db(), 'workspaces', wid, CARD_COLLECTION[type]), id) : doc(collection(db(), 'workspaces', wid, CARD_COLLECTION[type]))

// A card on a plane besides its home (D-281): fixed by the two, so a card is on a plane once.
export const placeRef = (wid: string, plane: string, cardId: string) => doc(collection(db(), 'workspaces', wid, 'places'), `${plane}_${cardId}`)

// Where a card's spot on the plane it's shown on is stored: the card itself on its home, its place elsewhere.
export const spotRef = (wid: string, card: Card) => (card.on ? placeRef(wid, card.on, card.id) : ref(wid, card.type, card.id))
// A place has no `updatedAt`.
const stamp = (card: Card, now: number) => (card.on ? {} : { updatedAt: now })

// For undo's labels: `an idea`, `a feature`.
const one = (type: AnyType) => `${type === 'idea' ? 'an' : 'a'} ${type}`

const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  a.x < b.x + CARD.w + GRID && b.x < a.x + CARD.w + GRID && a.y < b.y + CARD.h + GRID && b.y < a.y + CARD.h + GRID

// A new card centred on `at` (plane px), on the grid, moved right past any card it would cover: one undo step.
export async function addCard(wid: string, pieceId: string, type: CardType, at: [number, number], others: Card[]) {
  const r = ref(wid, type)
  const spot = { x: snap(at[0] - CARD.w / 2), y: snap(at[1] - CARD.h / 2) }
  for (let hit = others.find((o) => overlaps(spot, o)); hit; hit = others.find((o) => overlaps(spot, o))) spot.x = hit.x + CARD.w + GRID
  const now = Date.now()
  // Keyed as its title is, so the title typed next (`fresh`) joins this step.
  await tracked(`add ${one(type)}`, [r], () => setDoc(r, { [titleField(type)]: '', pieceId, ...spot, createdAt: now, updatedAt: now }), { before: absent([r]), key: `card-title:${r.id}` })
  return r.id
}

// The end of a drag: one undo step from where it started.
export async function moveCard(wid: string, card: Card, to: [number, number]) {
  const r = spotRef(wid, card)
  const before = await snapshotWith(r, { x: card.x, y: card.y })
  return tracked(`move ${one(card.type)}`, [r], () => updateDoc(r, { x: to[0], y: to[1], ...stamp(card, Date.now()) }), { before })
}

// Several at once, one undo step: a folded feature carries its parts (D-164).
export async function moveCards(wid: string, moves: { card: Card; to: [number, number] }[]) {
  const refs = moves.map((m) => spotRef(wid, m.card))
  const before = (await Promise.all(moves.map((m, i) => snapshotWith(refs[i], { x: m.card.x, y: m.card.y })))).flat()
  return tracked(`move ${moves.length > 1 ? `${moves.length} cards` : one(moves[0].card.type)}`, refs, () => {
    const batch = writeBatch(db())
    const now = Date.now()
    moves.forEach((m, i) => batch.update(refs[i], { x: m.to[0], y: m.to[1], ...stamp(m.card, now) }))
    return batch.commit()
  }, { before })
}

// Typing merges into one undo step.
// `fresh`: the first title of a card just made, one undo step with its making however long it took to type.
export function retitleCard(wid: string, card: Card, title: string, fresh = false) {
  const r = ref(wid, card.type, card.id)
  return tracked(`rename ${one(card.type)}`, [r], () => updateDoc(r, { [titleField(card.type)]: title.slice(0, TITLE_MAX), updatedAt: Date.now() }), {
    key: `card-title:${card.id}`,
    mergeAlways: fresh,
  })
}

// A card just made, let go before it had a title: gone, with its step (D-250).
export const discardCard = (wid: string, card: Pick<Card, 'id' | 'type'>) => discardNew(ref(wid, card.type, card.id), `card-title:${card.id}`)

// Fields from its panel (D-219): `undefined` clears one. `notes` is stored as a competitor's `notes`, any other card's
// `body`. Typing in one field merges into one undo step.
export function updateCard(wid: string, card: Card, fields: Partial<CardFields>, what = 'edit') {
  const r = ref(wid, card.type, card.id)
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k === 'notes' && card.type !== 'competitor' ? 'body' : k] = v === undefined ? deleteField() : v
  const keys = Object.keys(fields).sort().join(',')
  return tracked(`${what} ${one(card.type)}`, [r], () => updateDoc(r, data), { key: `card:${card.id}:${keys}` })
}

// A package of these cards (D-239, the old board's D-141), on their plane: named `Package N`, its top-left at `at`,
// shown unfolded (a frame round them). One undo step; returns its id.
export function addPackage(wid: string, plane: string, members: Card[], at: [number, number], n: number) {
  const r = ref(wid, 'package')
  const now = Date.now()
  void tracked('package these', [r], () =>
    setDoc(r, { title: `Package ${n}`, pieceId: plane, memberIds: members.map((m) => m.id).slice(0, 60), x: snap(at[0]), y: snap(at[1]), createdAt: now, updatedAt: now }),
  { before: absent([r]) })
  return r.id
}

// A package folds its members in (`at`: where its card goes, where its band was) or lays them out again (`null`):
// one undo step (D-239). On the plane it's shown on only (D-281).
export function foldPackage(wid: string, card: Card, at: [number, number] | null) {
  const r = spotRef(wid, card)
  const data = at ? { folded: true, x: at[0], y: at[1], ...stamp(card, Date.now()) } : { folded: deleteField(), ...stamp(card, Date.now()) }
  return tracked(at ? 'fold a package' : 'unfold a package', [r], () => updateDoc(r, data))
}

// A card's parts folded into it (D-225) or laid out again, on the plane it's shown on only (D-281): a fold changes its
// height, which on another plane could put it over its neighbours.
export function foldCard(wid: string, card: Card, folded: boolean) {
  const r = spotRef(wid, card)
  return tracked(folded ? 'fold parts' : 'unfold parts', [r], () => updateDoc(r, { folded: folded || deleteField(), ...stamp(card, Date.now()) }))
}

// The places of cards deleted everywhere (D-281).
const placesOf = (wid: string, places: { planeId: string; cardId: string }[], ids: Set<string>) =>
  places.filter((p) => ids.has(p.cardId)).map((p) => placeRef(wid, p.planeId, p.cardId))

// Several cards and their links, and text with them, one undo step (D-227, D-229: a selection's Delete). Gone from every
// plane they're on.
export function deleteCards(wid: string, list: Card[], edges: Edge[] = [], labels: { id: string }[] = [], places: { planeId: string; cardId: string }[] = []) {
  const ids = new Set(list.map((c) => c.id))
  const refs = [
    ...list.map((c) => ref(wid, c.type, c.id)),
    ...edgesOn(edges, ids).map((e) => edgeRef(wid, e.id)),
    ...placesOf(wid, places, ids),
    ...labels.map((l) => doc(collection(db(), 'workspaces', wid, 'labels'), l.id)),
  ]
  const n = list.length + labels.length
  return tracked(`delete ${n} ${labels.length ? 'things' : 'cards'}`, refs, async () => {
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

// Copies of cards (and text, D-229) on a plane, moved by `by`, with the links between them (D-227: paste, duplicate):
// one undo step. Returns the new ids, cards then text.
export function copyCards(wid: string, pieceId: string, list: Card[], edges: Edge[], by: [number, number], labels: ({ id: string; x: number; y: number } & Record<string, unknown>)[] = []) {
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
    // A package keeps its members: the copies when they were copied with it, else the same cards (D-239).
    if (c.type === 'package') {
      d.memberIds = (c.memberIds ?? []).map((m) => made.get(m)?.id ?? m)
    }
    if (c.notes) d[c.type === 'competitor' ? 'notes' : 'body'] = c.notes
    return d
  }
  const texts = labels.map(() => doc(collection(db(), 'workspaces', wid, 'labels')))
  const refs = [...made.values(), ...links, ...texts]
  const n = list.length + labels.length
  void tracked(n > 1 ? `paste ${n} things` : list.length ? `paste ${one(list[0].type)}` : 'paste text', refs, () => {
    const batch = writeBatch(db())
    list.forEach((c) => batch.set(made.get(c.id)!, fieldsOf(c)))
    labels.forEach((l, i) => {
      const { id: _, canvasId: __, ...rest } = l
      // On the canvas: the one shown (D-302).
      batch.set(texts[i], { ...rest, pieceId, ...(pieceId === CANVAS ? canvasField() : {}), x: l.x + by[0], y: l.y + by[1], createdAt: now })
    })
    inner.forEach((e, i) =>
      batch.set(links[i], { fromId: made.get(e.fromId)!.id, fromType: e.fromType, toId: made.get(e.toId)!.id, toType: e.toType, kind: e.kind, ...(e.label ? { label: e.label } : {}) }),
    )
    return batch.commit()
  }, { before: absent(refs) })
  return [...list.map((c) => made.get(c.id)!.id), ...texts.map((t) => t.id)]
}

// With its links (D-207) and its places on other planes (D-281): one undo step brings them all back.
export function deleteCard(wid: string, card: Card, edges: Edge[] = [], places: { planeId: string; cardId: string }[] = []) {
  const ids = new Set([card.id])
  const refs = [ref(wid, card.type, card.id), ...edgesOn(edges, ids).map((e) => edgeRef(wid, e.id)), ...placesOf(wid, places, ids)]
  return tracked(`delete ${one(card.type)}`, refs, () => {
    const batch = writeBatch(db())
    refs.forEach((r) => batch.delete(r))
    return batch.commit()
  })
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
