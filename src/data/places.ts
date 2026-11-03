// One card on many planes (D-281, docs/specs/shared-cards.md): the plane a card was made on is its home (`pieceId`, its
// x/y on the card); every other plane it's on is a `places/{planeId}_{cardId}` doc with its spot there and whether it's
// folded there. Title, fields, links, tasks and comments stay the card's, one for every plane. The home is never shown:
// taking a card off it while it's on another plane moves the home there.
import type { Card } from './cards'
import type { Edge } from './edges'
import { elsewhere } from '../model/placement'
import { present, serverHas, runUiWith, startUiWith } from '../ops/firestore'
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
  const { value, applied } = startUiWith(wid, `${move ? 'move' : 'bring'} cards here`, (ctx) => {
    const made = placeOnPlan(ctx, { cards: picked.map((c) => c.id), plane, at, move, layout }, all)
    return made.list.length ? { plans: [made.plan], value: { ids: made.list.map((c) => c.id), box: made.box } } : null
  }, { ids: [] as string[], box: null as ReturnType<typeof placeOnPlan>['box'] })
  return { ...value, written: serverHas(applied) }
}

// Cards taken off `plane`, staying on the others they're on, one undo step. A card on no other plane isn't touched
// (that's a delete). Returns how many came off. An op (S4: take_off); the places are read from the workspace.
export function takeOff(wid: string, plane: string, list: Card[], _places: Place[]) {
  return runUiWith(wid, 'take cards off this plane', (ctx) => {
    const made = takeOffPlan(ctx, { cards: list.map((c) => c.id), plane })
    return made.n ? { plans: [made.plan], value: made.n } : null
  }, 0)
}

// Delete on a plane (the user, D-281): cards also on another plane come off this one, the others are deleted with their
// links (and what else hangs off them), text too; one undo step. Returns the cards taken off. An op (S4: delete with a
// plane); what goes with them is read from the workspace.
export function removeHere(wid: string, plane: string, list: Card[], _all: { edges: Edge[]; places: Place[] }, labels: { id: string }[] = []) {
  return runUiWith(wid, 'delete that', (ctx) => {
    const plan = deleteThings(ctx, { ids: present(ctx, [...list.map((c) => c.id), ...labels.map((l) => l.id)]), plane })
    return { plans: [plan], value: list.filter((c) => elsewhere(c, ctx.ws.places, plane).length) }
  }, [] as Card[])
}

// A plane's delete (its cards also on another plane stay there, their home moving; its places going) is an op now (S6:
// src/ops/pieces.ts' pieceCascade, through pieces.ts' deletePiece).
