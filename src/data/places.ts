// One card on many planes (D-281, docs/specs/shared-cards.md): the plane a card was made on is its home (`pieceId`, its
// x/y on the card); every other plane it's on is a `places/{planeId}_{cardId}` doc with its spot there and whether it's
// folded there. Title, fields, links, tasks and comments stay the card's, one for every plane. The home is never shown:
// taking a card off it while it's on another plane moves the home there.
import { writeBatch, type DocumentData, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { placeRef, type Card } from './cards'
import type { Edge } from './edges'
import { elsewhere } from '../model/placement'
import { applyUi, forFirestore, present, refOf, sayRefused, serverHas, uiCtx } from '../ops/firestore'
import { placeOnPlan, takeOffPlan } from '../ops/places'
import { deleteThings, rehome as rehomeOp } from '../ops/cards'
import type { OpCtx } from '../ops/types'

// What a place is and where cards land live in src/model/placement.ts, without Firebase (S4).
export { cardsOn, cardsByPlane, planeOf, elsewhere, planesOf, onPlane, withParts, landing } from '../model/placement'
export type { Place } from '../model/placement'
import type { Place } from '../model/placement'

type Op = { ref: DocumentReference; data: DocumentData | null; set?: boolean }

// Every batch issued at once (they apply to the local cache at once, so tracked()'s "after" sees them all; awaiting
// each in turn recorded "after" before the later batches of a write of > 450 docs landed).
function commit(ops: Op[]) {
  return () => {
    const commits: Promise<void>[] = []
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(db())
      for (const o of ops.slice(i, i + 450)) {
        if (!o.data) batch.delete(o.ref)
        else if (o.set) batch.set(o.ref, o.data)
        else batch.update(o.ref, o.data)
      }
      commits.push(batch.commit())
    }
    return Promise.all(commits)
  }
}


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

// Moving a card's home to another plane it's on (the earliest it came to), as ops' rehome writes it: its spot and fold
// there become the card's, that place goes. Null when it's on no other plane (`except` left out too).
function rehome(wid: string, card: Card, places: Place[], except: string): Op[] | null {
  const ctx = { ws: { places }, now: Date.now() } as unknown as OpCtx
  const writes = rehomeOp(ctx, card, except)
  return writes && writes.map((w) => ({ ref: refOf(wid, w), data: w.del ? null : forFirestore(w.patch ?? {}) }))
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

// A plane's delete (pieces.ts): its cards also on another plane stay there (their home moves, D-281); its places go.
// The ops for those; `stay` the cards kept.
export function planeGoes(wid: string, plane: string, cards: Card[], places: Place[]) {
  const stay = new Set<string>()
  const ops: Op[] = []
  for (const c of cards) {
    if (c.pieceId !== plane) continue
    const o = rehome(wid, c, places, plane)
    if (o) (stay.add(c.id), ops.push(...o))
  }
  for (const p of places) if (p.planeId === plane) ops.push({ ref: placeRef(wid, plane, p.cardId), data: null })
  return { stay, ops }
}

export const runOps = commit
