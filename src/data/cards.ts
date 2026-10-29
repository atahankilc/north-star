// Cards on a plane (D-187): customers, problems, competitors, ideas, features and packages, each in its own collection
// (D-037, D-040), at home on one plane (`pieceId`) at x/y in that plane's px (its top-left corner); other planes it's on
// keep its spot there in `places` (D-281, places.ts). A competitor keeps its title as `name`.
import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'
import { discardNew } from './history'
import type { Edge } from './edges'
import { applyUi, forgetRecent, present, runUi, sayRefused, serverHas, uiCtx } from '../ops/firestore'
import { createCard, createPackage, deleteThings, duplicatePlan, updateCard as updateCardOp } from '../ops/cards'

// What a card is (its types, fields, the doc → card conversion) lives in src/model/cards.ts, without Firebase (S3).
export { CARD_TYPES, ALL_TYPES, CARD_COLLECTION, CARD, TITLE_MAX, VALIDATIONS, FEATURE_PRIORITIES, FEATURE_STATUSES, FEATURE_IMPACTS, FEATURE_EFFORTS, isOnPlane, toCards, cardDoc } from '../model/cards'
export type { CardType, AnyType, Validation, CardFields, Card } from '../model/cards'
import { CARD, CARD_COLLECTION, type AnyType, type Card, type CardFields, type CardType } from '../model/cards'

const ref = (wid: string, type: AnyType, id?: string) =>
  id ? doc(collection(db(), 'workspaces', wid, CARD_COLLECTION[type]), id) : doc(collection(db(), 'workspaces', wid, CARD_COLLECTION[type]))

// A card on a plane besides its home (D-281): fixed by the two, so a card is on a plane once.
export const placeRef = (wid: string, plane: string, cardId: string) => doc(collection(db(), 'workspaces', wid, 'places'), `${plane}_${cardId}`)

// Where a card's spot on the plane it's shown on is stored: the card itself on its home, its place elsewhere.
export const spotRef = (wid: string, card: Card) => (card.on ? placeRef(wid, card.on, card.id) : ref(wid, card.type, card.id))
// For undo's labels: `an idea`, `a feature`.
const one = (type: AnyType) => `${type === 'idea' ? 'an' : 'a'} ${type}`

// Every write below is an op (S4, D-312: src/ops/cards.ts) applied as one undo step; the functions keep their old
// signatures, labels, undo keys and promises (resolved once the server has the write).

// A new card centred on `at` (plane px), on the grid, moved right past any card it would cover: one undo step.
export async function addCard(wid: string, pieceId: string, type: CardType, at: [number, number], others: Card[]) {
  // No card made (no workspace shown, or refused): '' (callers select it, which selects nothing).
  const ctx = uiCtx(wid)
  if (!ctx) return ''
  let plan
  try {
    plan = createCard(ctx, { type, plane: pieceId, where: { at, avoid: others } })
  } catch (e) {
    sayRefused(e, `add ${one(type)}`)
    return ''
  }
  const id = plan.ids.$new
  // Keyed as its title is, so the title typed next (`fresh`) joins this step.
  await serverHas(applyUi(wid, ctx, [plan], { key: `card-title:${id}` }))
  return id
}

// The end of a drag: one undo step from where it started.
export async function moveCard(wid: string, card: Card, to: [number, number]) {
  return runUi(wid, (ctx) => [updateCardOp(ctx, { card: card.id, plane: card.on, x: to[0], y: to[1] })], { label: `move ${one(card.type)}` })
}

// Several at once, one undo step: a folded feature carries its parts (D-164).
export async function moveCards(wid: string, moves: { card: Card; to: [number, number] }[]) {
  const label = `move ${moves.length > 1 ? `${moves.length} cards` : one(moves[0].card.type)}`
  return runUi(wid, (ctx) => moves.map((m) => updateCardOp(ctx, { card: m.card.id, plane: m.card.on, x: m.to[0], y: m.to[1] })), { label })
}

// Typing merges into one undo step.
// `fresh`: the first title of a card just made, one undo step with its making however long it took to type.
export function retitleCard(wid: string, card: Card, title: string, fresh = false) {
  return runUi(wid, (ctx) => [updateCardOp(ctx, { card: card.id, title })], { label: `rename ${one(card.type)}`, key: `card-title:${card.id}`, mergeAlways: fresh })
}

// A card just made, let go before it had a title: gone, with its step (D-250).
export const discardCard = (wid: string, card: Pick<Card, 'id' | 'type'>) => {
  // The UI's overlay may still replay its making.
  forgetRecent()
  return discardNew(ref(wid, card.type, card.id), `card-title:${card.id}`)
}

// Fields from its panel (D-219): `undefined` clears one. `notes` is stored as a competitor's `notes`, any other card's
// `body`. Typing in one field merges into one undo step.
export function updateCard(wid: string, card: Card, fields: Partial<CardFields>, what = 'edit') {
  const keys = Object.keys(fields).sort().join(',')
  const label = `${what} ${one(card.type)}`
  return runUi(wid, (ctx) => [updateCardOp(ctx, { card: card.id, fields })], { label, key: `card:${card.id}:${keys}` })
}

// A package of these cards (D-239, the old board's D-141), on their plane: named `Package N`, its top-left at `at`,
// shown unfolded (a frame round them). One undo step; returns its id.
export function addPackage(wid: string, plane: string, members: Card[], at: [number, number], n: number) {
  return addPackageOp(wid, plane, members, at, n).id
}

// As addPackage, with the write to wait for (R4): `applied` resolves once it's recorded and issued locally.
export function addPackageOp(wid: string, plane: string, members: Card[], at: [number, number], n: number) {
  // Nothing made (no workspace shown, or refused): id ''.
  const none = { id: '', applied: Promise.resolve(null) }
  const ctx = uiCtx(wid)
  if (!ctx) return none
  try {
    const plan = createPackage(ctx, { cards: members.map((m) => m.id), plane, x: at[0], y: at[1], name: `Package ${n}` })
    return { id: plan.ids.$new, applied: applyUi(wid, ctx, [plan]) }
  } catch (e) {
    sayRefused(e, 'package these')
    return none
  }
}

// A package folds its members in (`at`: where its card goes, where its band was) or lays them out again (`null`):
// one undo step (D-239). On the plane it's shown on only (D-281).
export function foldPackage(wid: string, card: Card, at: [number, number] | null) {
  return runUi(wid, (ctx) => [updateCardOp(ctx, { card: card.id, plane: card.on, folded: !!at, ...(at ? { x: at[0], y: at[1] } : {}) })], { label: at ? 'fold a package' : 'unfold a package' })
}

// A card's parts folded into it (D-225) or laid out again, on the plane it's shown on only (D-281): a fold changes its
// height, which on another plane could put it over its neighbours.
export function foldCard(wid: string, card: Card, folded: boolean) {
  return runUi(wid, (ctx) => [updateCardOp(ctx, { card: card.id, plane: card.on, folded })], { label: folded ? 'fold parts' : 'unfold parts' })
}

// Several cards and their links, and text with them, one undo step (D-227, D-229: a selection's Delete). Gone from every
// plane they're on, with what hangs off them (the op reads it from the workspace: `edges` and `places` are no longer
// needed and kept for the callers).
export function deleteCards(wid: string, list: Card[], _edges: Edge[] = [], labels: { id: string }[] = [], _places: { planeId: string; cardId: string }[] = []) {
  const n = list.length + labels.length
  const label = `delete ${n} ${labels.length ? 'things' : 'cards'}`
  // What a collaborator deleted a moment ago is left out; the rest goes.
  return runUi(wid, (ctx) => [{ ...deleteThings(ctx, { ids: present(ctx, [...list.map((c) => c.id), ...labels.map((l) => l.id)]), everywhere: true }), label }], { label })
}

// The same fields on several cards, one undo step (a selection's tag).
export function updateCards(wid: string, list: { card: Card; fields: Partial<CardFields> }[], what: string) {
  return runUi(wid, (ctx) => list.map((x) => updateCardOp(ctx, { card: x.card.id, fields: x.fields })), { label: what })
}

// Copies of cards (and text, D-229) on a plane, moved by `by`, with the links between them (D-227: paste, duplicate):
// one undo step. Returns the new ids, cards then text.
export function copyCards(wid: string, pieceId: string, list: Card[], edges: Edge[], by: [number, number], labels: ({ id: string; x: number; y: number } & Record<string, unknown>)[] = []) {
  return copyCardsOp(wid, pieceId, list, edges, by, labels).ids
}

// As copyCards, with the write to wait for (R4): `applied` resolves once it's recorded and issued locally.
export function copyCardsOp(wid: string, pieceId: string, list: Card[], edges: Edge[], by: [number, number], labels: ({ id: string; x: number; y: number } & Record<string, unknown>)[] = []) {
  const ctx = uiCtx(wid)
  if (!ctx) return { ids: [] as string[], applied: Promise.resolve(null) }
  const { plan, ids } = duplicatePlan(ctx, { to: pieceId, by, source: { cards: list, edges, labels } })
  return { ids, applied: applyUi(wid, ctx, [plan]) }
}

// With its links (D-207), its places on other planes (D-281) and what hangs off it (evidence, a competitor's features,
// matches): one undo step brings them all back. Read from the workspace; `edges` and `places` are kept for the callers.
export function deleteCard(wid: string, card: Card, _edges: Edge[] = [], _places: { planeId: string; cardId: string }[] = []) {
  return runUi(wid, (ctx) => [deleteThings(ctx, { ids: present(ctx, [card.id]), everywhere: true })], { label: `delete ${one(card.type)}` })
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
