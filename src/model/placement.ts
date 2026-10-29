// Where cards are and where new ones land, without Firebase (S4, D-312): moved out of data/places.ts and data/cards.ts so
// the ops (src/ops/) place cards exactly as the UI does. data/places.ts re-exports all of it.
import { CARD, type AnyType, type Card } from './cards'
import { GRID, snap } from './grid'
import type { Edge } from './edges'

export type Place = { id: string; planeId: string; cardId: string; type: AnyType; x: number; y: number; folded?: boolean; createdAt: number }

// A place's id: fixed by the plane and the card, so a card is on a plane once (D-281).
export const placeId = (plane: string, cardId: string) => `${plane}_${cardId}`

// Two cards' boxes (a grid step apart counts as touching).
export const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  a.x < b.x + CARD.w + GRID && b.x < a.x + CARD.w + GRID && a.y < b.y + CARD.h + GRID && b.y < a.y + CARD.h + GRID

// A new card centred on `at` (plane px), on the grid, moved right past any card it would cover (cards.ts' addCard).
export function clearSpot(at: [number, number], others: { x: number; y: number }[]): { x: number; y: number } {
  const spot = { x: snap(at[0] - CARD.w / 2), y: snap(at[1] - CARD.h / 2) }
  for (let hit = others.find((o) => overlaps(spot, o)); hit; hit = others.find((o) => overlaps(spot, o))) spot.x = hit.x + CARD.w + GRID
  return spot
}

// Where a card goes when nobody says (the agent's create_card without `where`): the first clear spot, row by row, from
// the plane's top-left (two grid steps in), each row a card's height and a step lower; past the plane's width, the next
// row. The same rule as the UI's (clearSpot) within each row.
export function freeSpot(others: { x: number; y: number }[], planeW = 960): { x: number; y: number } {
  const margin = 2 * GRID
  for (let row = 0; row < 200; row++) {
    const y = margin + row * (CARD.h + 2 * GRID)
    const s = clearSpot([margin + CARD.w / 2, y + CARD.h / 2], others)
    if (s.x + CARD.w <= Math.max(planeW - margin, margin + CARD.w)) return s
  }
  return clearSpot([margin + CARD.w / 2, margin + CARD.h / 2], others)
}

// The cards on a plane, each with its spot there (`on` set for those not at home). A card shown through a place is kept
// as the same object while neither it nor its place changed, so what's drawn from it stays memoised (D-279).
const shown = new Map<string, { base: Card; place: Place; card: Card }>()
function placed(base: Card, p: Place): Card {
  const was = shown.get(p.id)
  if (was && was.base === base && was.place.x === p.x && was.place.y === p.y && was.place.folded === p.folded) return was.card
  const card: Card = { ...base, x: p.x, y: p.y, folded: p.folded, on: p.planeId }
  shown.set(p.id, { base, place: p, card })
  return card
}

export function cardsOn(cards: Card[], places: Place[], plane: string): Card[] {
  const out = cards.filter((c) => c.pieceId === plane)
  const here = places.filter((p) => p.planeId === plane)
  if (!here.length) return out
  const byId = new Map(cards.map((c) => [c.id, c]))
  for (const p of here) {
    const base = byId.get(p.cardId)
    if (base && base.pieceId !== plane) out.push(placed(base, p))
  }
  return out
}

// Every plane's cards at once, as `cardsOn` gives them, by plane id.
export function cardsByPlane(cards: Card[], places: Place[]): Map<string, Card[]> {
  const out = new Map<string, Card[]>()
  const add = (plane: string, c: Card) => {
    const at = out.get(plane)
    if (at) at.push(c)
    else out.set(plane, [c])
  }
  for (const c of cards) add(c.pieceId, c)
  if (!places.length) return out
  const byId = new Map(cards.map((c) => [c.id, c]))
  for (const p of places) {
    const base = byId.get(p.cardId)
    if (base && base.pieceId !== p.planeId) add(p.planeId, placed(base, p))
  }
  return out
}

// The plane a card is drawn on: where its place is, else its home.
export const planeOf = (card: Card) => card.on ?? card.pieceId

// Every plane a card is on: its home first, then the others in the order it came to them.
export function planesOf(card: Pick<Card, 'id' | 'pieceId'>, places: Place[]): string[] {
  return [card.pieceId, ...places.filter((p) => p.cardId === card.id && p.planeId !== card.pieceId).sort((a, b) => a.createdAt - b.createdAt).map((p) => p.planeId)]
}

// The other planes a card shown on `plane` is on.
export const elsewhere = (card: Pick<Card, 'id' | 'pieceId'>, places: Place[], plane: string) => planesOf(card, places).filter((p) => p !== plane)

export const onPlane = (card: Pick<Card, 'id' | 'pieceId'>, places: Place[], plane: string) =>
  card.pieceId === plane || places.some((p) => p.cardId === card.id && p.planeId === plane)

// What comes along when cards are brought to a plane (the user, D-281): a card's parts (`part of` to a card of its own
// type, all the way down, as cardInside's partsOf reads them) and a package's members with theirs.
export function withParts(picked: Card[], cards: Card[], edges: Edge[]): Card[] {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const ids = new Set(picked.map((c) => c.id))
  for (let grew = true; grew; ) {
    grew = false
    for (const e of edges) {
      if (e.kind !== 'part-of' || !ids.has(e.toId) || ids.has(e.fromId)) continue
      const [a, b] = [byId.get(e.fromId), byId.get(e.toId)]
      if (a && b && a.type === b.type) (ids.add(a.id), (grew = true))
    }
    for (const id of [...ids]) {
      for (const m of byId.get(id)?.memberIds ?? []) if (byId.has(m) && !ids.has(m)) (ids.add(m), (grew = true))
    }
  }
  return [...ids].flatMap((id) => byId.get(id) ?? [])
}

// Where brought cards land on `plane`: laid out as they are on `from` (the first one's home unless said; those not there
// in a row under them), centred on `at`, on the grid, the whole group moved right past any card it would cover.
export function landing(list: Card[], cards: Card[], places: Place[], plane: string, at: [number, number], from = list[0]?.pieceId): Map<string, { x: number; y: number; folded?: boolean }> {
  const there = new Map(cardsOn(cards, places, from).map((c) => [c.id, c]))
  const spots = new Map<string, { x: number; y: number; folded?: boolean }>()
  for (const c of list) {
    const s = there.get(c.id)
    if (s) spots.set(c.id, { x: s.x, y: s.y, folded: s.folded })
  }
  const laid = [...spots.values()]
  const bottom = laid.length ? Math.max(...laid.map((s) => s.y)) + CARD.h + 2 * GRID : 0
  let left = laid.length ? Math.min(...laid.map((s) => s.x)) : 0
  for (const c of list)
    if (!spots.has(c.id)) {
      spots.set(c.id, { x: left, y: bottom, folded: c.folded })
      left += CARD.w + GRID
    }
  const all = [...spots.values()]
  const x0 = Math.min(...all.map((s) => s.x))
  const y0 = Math.min(...all.map((s) => s.y))
  const w = Math.max(...all.map((s) => s.x)) + CARD.w - x0
  const h = Math.max(...all.map((s) => s.y)) + CARD.h - y0
  let dx = snap(at[0] - w / 2) - x0
  const dy = snap(at[1] - h / 2) - y0
  const others = cardsOn(cards, places, plane).filter((c) => !spots.has(c.id))
  for (let hit = true; hit; ) {
    hit = false
    for (const s of all) {
      const o = others.find((k) => overlaps({ x: s.x + dx, y: s.y + dy }, k))
      if (o) {
        dx = o.x + CARD.w + GRID - s.x
        hit = true
        break
      }
    }
  }
  return new Map([...spots].map(([id, s]) => [id, { ...s, x: s.x + dx, y: s.y + dy }]))
}

// The box round spots (plane px).
export function boxOf(spots: { x: number; y: number }[]) {
  const x = Math.min(...spots.map((s) => s.x))
  const y = Math.min(...spots.map((s) => s.y))
  return { x, y, w: Math.max(...spots.map((s) => s.x)) + CARD.w - x, h: Math.max(...spots.map((s) => s.y)) + CARD.h - y }
}
