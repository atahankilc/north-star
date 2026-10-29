// Place ops (S4, D-312; agent-actions.md §5): the same card on more planes (D-281). place_on brings cards (with their
// parts and members) to a plane, laid out as they are where they come from; take_off takes them off one plane, still on
// the others (a card on no other plane isn't touched: that's a delete).
import type { Card } from '../model/cards'
import { boxOf, landing, onPlane, placeId, withParts } from '../model/placement'
import type { OpCtx, Plan, Write } from './types'
import { cardColl, cardIn, plural } from './util'
import { offPlane } from './cards'

export type PlaceOnArgs = {
  cards: string[]
  plane: string
  // Their home moves here (those at home where the first one is), instead of only being brought.
  move?: boolean
  // Where the group is centred (plane px); the middle of the plane unless said. Moved right past what's there.
  at?: [number, number]
  // Laid out as on this plane (else the first one's home).
  layout?: string
}

// The plan, what comes (with parts and members, not those already there) and the box it lands in (null: nothing comes).
export function placeOnPlan(ctx: OpCtx, args: PlaceOnArgs, among?: { cards: Card[]; places: OpCtx['ws']['places']; edges: OpCtx['ws']['edges'] }) {
  const op = 'place_on'
  const all = among ?? ctx.ws
  const picked = args.cards.map((id) => all.cards.find((c) => c.id === id) ?? cardIn(ctx, op, id))
  const list = withParts(picked, all.cards, all.edges).filter((c) => !onPlane(c, all.places, args.plane))
  const label = `${args.move ? 'move' : 'bring'} ${plural(list.length)} here`
  if (!list.length) return { plan: { op, label, writes: [], ids: {}, meta: { kind: 'place' } } as Plan, list, box: null }
  const piece = ctx.ws.pieces.find((p) => p.id === args.plane)
  const at = args.at ?? [(piece?.w ?? 960) / 2, (piece?.h ?? 600) / 2]
  const spots = landing(list, all.cards, all.places, args.plane, at, args.layout ?? list[0].pieceId)
  const from = list[0].pieceId
  const ids: Record<string, string> = {}
  const writes: Write[] = list.map((c) => {
    const s = spots.get(c.id)!
    if (args.move && c.pieceId === from) return { coll: cardColl(c.type), id: c.id, patch: { pieceId: args.plane, x: s.x, y: s.y, updatedAt: ctx.now } }
    const id = placeId(args.plane, c.id)
    ids[`$place:${id}`] = id
    return { coll: 'places', id, set: { planeId: args.plane, cardId: c.id, type: c.type, x: s.x, y: s.y, ...(s.folded ? { folded: true } : {}), createdAt: ctx.now } }
  })
  return { plan: { op, label, writes, ids, meta: { kind: 'place' } } as Plan, list, box: boxOf([...spots.values()]) }
}

export const placeOn = (ctx: OpCtx, args: PlaceOnArgs): Plan => placeOnPlan(ctx, args).plan

export type TakeOffArgs = { cards: string[]; plane: string }

// The plan and how many come off.
export function takeOffPlan(ctx: OpCtx, args: TakeOffArgs): { plan: Plan; n: number } {
  const writes: Write[] = []
  let n = 0
  for (const id of args.cards) {
    const w = offPlane(ctx, cardIn(ctx, 'take_off', id), args.plane)
    if (w) (writes.push(...w), n++)
  }
  return { plan: { op: 'take_off', label: `take ${plural(n)} off this plane`, writes, ids: {}, meta: { kind: 'place' } }, n }
}

export const takeOff = (ctx: OpCtx, args: TakeOffArgs): Plan => takeOffPlan(ctx, args).plan
