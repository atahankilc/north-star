// One card on many planes (D-281, docs/specs/shared-cards.md): the plane a card was made on is its home (`pieceId`, its
// x/y on the card); every other plane it's on is a `places/{planeId}_{cardId}` doc with its spot there and whether it's
// folded there. Title, fields, links, tasks and comments stay the card's, one for every plane. The home is never shown:
// taking a card off it while it's on another plane moves the home there.
import type { Card } from './cards'
import type { Edge } from './edges'
import { elsewhere } from '../model/placement'
import { applyUi, present, sayRefused, serverHas, uiCtx } from '../ops/firestore'
import { placeOnPlan, takeOffPlan } from '../ops/places'
import { deleteThings } from '../ops/cards'

// What a place is and where cards land live in src/model/placement.ts, without Firebase (S4).
export { cardsOn, cardsByPlane, planeOf, elsewhere, planesOf, onPlane, withParts, landing } from '../model/placement'
export type { Place } from '../model/placement'
import type { Place } from '../model/placement'

// Cards (`picked`, with their parts and members) brought to `plane` at `at`, one undo step; `move` takes those at home
// where the first one is off that plane (their home moves here; others are only brought). Laid out as on `layout` (the
// plane they were copied on, ⇧⌘V; else the first one's home). Says at once what's coming and the box it lands in (plane
// px), to select and glide to before the write is confirmed (`written`). An op (S4: src/ops/places.ts' place_on), laid
// out among the lists passed (a card the caller just let go of is left out of them).
export function bringIn(wid: string, plane: string, picked: Card[], all: { cards: Card[]; places: Place[]; edges: Edge[] }, at: [number, number], move = false, layout?: string) {
  const none = { ids: [] as string[], box: null, written: Promise.resolve() }
  const ctx = uiCtx(wid)
  if (!ctx) return none
  let made
  try {
    made = placeOnPlan(ctx, { cards: picked.map((c) => c.id), plane, at, move, layout }, all)
  } catch (e) {
    sayRefused(e, `${move ? 'move' : 'bring'} cards here`)
    return none
  }
  if (!made.list.length) return none
  const written = serverHas(applyUi(wid, ctx, [made.plan]))
  return { ids: made.list.map((c) => c.id), box: made.box, written }
}

// Cards taken off `plane`, staying on the others they're on, one undo step. A card on no other plane isn't touched
// (that's a delete). Returns how many came off. An op (S4: take_off); the places are read from the workspace.
export async function takeOff(wid: string, plane: string, list: Card[], _places: Place[]) {
  const ctx = uiCtx(wid)
  if (!ctx) return 0
  let made
  try {
    made = takeOffPlan(ctx, { cards: list.map((c) => c.id), plane })
  } catch (e) {
    sayRefused(e, 'take cards off this plane')
    return 0
  }
  if (!made.n) return 0
  await serverHas(applyUi(wid, ctx, [made.plan]))
  return made.n
}

// Delete on a plane (the user, D-281): cards also on another plane come off this one, the others are deleted with their
// links (and what else hangs off them), text too; one undo step. Returns the cards taken off. An op (S4: delete with a
// plane); what goes with them is read from the workspace.
export async function removeHere(wid: string, plane: string, list: Card[], _all: { edges: Edge[]; places: Place[] }, labels: { id: string }[] = []) {
  const ctx = uiCtx(wid)
  if (!ctx) return []
  const off = list.filter((c) => elsewhere(c, ctx.ws.places, plane).length)
  let plan
  try {
    plan = deleteThings(ctx, { ids: present(ctx, [...list.map((c) => c.id), ...labels.map((l) => l.id)]), plane })
  } catch (e) {
    sayRefused(e, 'delete that')
    return off
  }
  if (!plan.writes.length) return off
  await serverHas(applyUi(wid, ctx, [plan]))
  return off
}

// A plane's delete (its cards also on another plane stay there, their home moving; its places going) is an op now (S6:
// src/ops/pieces.ts' pieceCascade, through pieces.ts' deletePiece).
