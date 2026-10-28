// One card on many planes (D-281, docs/specs/shared-cards.md): the plane a card was made on is its home (`pieceId`, its
// x/y on the card); every other plane it's on is a `places/{planeId}_{cardId}` doc with its spot there and whether it's
// folded there. Title, fields, links, tasks and comments stay the card's, one for every plane. The home is never shown:
// taking a card off it while it's on another plane moves the home there.
import { deleteField, writeBatch, type DocumentData, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { absent, snapshotWith, tracked } from './history'
import { GRID, snap } from './grid'
import { CARD, cardRef, placeRef, type AnyType, type Card } from './cards'
import { edgeRef, edgesOn, type Edge } from './edges'
import { labelRef } from './labels'

export type Place = { id: string; planeId: string; cardId: string; type: AnyType; x: number; y: number; folded?: boolean; createdAt: number }

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

// The other planes a card shown on `plane` is on.
export const elsewhere = (card: Pick<Card, 'id' | 'pieceId'>, places: Place[], plane: string) => planesOf(card, places).filter((p) => p !== plane)

// Every plane a card is on: its home first, then the others in the order it came to them.
export function planesOf(card: Pick<Card, 'id' | 'pieceId'>, places: Place[]): string[] {
  return [card.pieceId, ...places.filter((p) => p.cardId === card.id && p.planeId !== card.pieceId).sort((a, b) => a.createdAt - b.createdAt).map((p) => p.planeId)]
}

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

const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  a.x < b.x + CARD.w + GRID && b.x < a.x + CARD.w + GRID && a.y < b.y + CARD.h + GRID && b.y < a.y + CARD.h + GRID

// Where brought cards land on `plane`: laid out as they are on the first one's home (those not there in a row under
// them), centred on `at`, on the grid, the whole group moved right past any card it would cover.
export function landing(list: Card[], cards: Card[], places: Place[], plane: string, at: [number, number]): Map<string, { x: number; y: number; folded?: boolean }> {
  const from = list[0]?.pieceId
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

type Op = { ref: DocumentReference; data: DocumentData | null; set?: boolean }

function commit(ops: Op[]) {
  return async () => {
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(db())
      for (const o of ops.slice(i, i + 450)) {
        if (!o.data) batch.delete(o.ref)
        else if (o.set) batch.set(o.ref, o.data)
        else batch.update(o.ref, o.data)
      }
      await batch.commit()
    }
  }
}

const plural = (n: number) => (n === 1 ? 'a card' : `${n} cards`)

// Cards (`picked`, with their parts and members) brought to `plane` at `at`, one undo step; `move` takes those at home
// where the first one is off that plane (their home moves here; others are only brought). Returns what's now here.
export async function bringIn(wid: string, plane: string, picked: Card[], all: { cards: Card[]; places: Place[]; edges: Edge[] }, at: [number, number], move = false) {
  const list = withParts(picked, all.cards, all.edges).filter((c) => !onPlane(c, all.places, plane))
  if (!list.length) return []
  const spots = landing(list, all.cards, all.places, plane, at)
  const from = list[0].pieceId
  const now = Date.now()
  const ops: Op[] = list.map((c) => {
    const s = spots.get(c.id)!
    if (move && c.pieceId === from) return { ref: cardRef(wid, c.type, c.id), data: { pieceId: plane, x: s.x, y: s.y, updatedAt: now } }
    return { ref: placeRef(wid, plane, c.id), set: true, data: { planeId: plane, cardId: c.id, type: c.type, x: s.x, y: s.y, ...(s.folded ? { folded: true } : {}), createdAt: now } }
  })
  const before = (await Promise.all(ops.map((o) => (o.set ? absent([o.ref]) : snapshotWith(o.ref, {}))))).flat()
  await tracked(`${move ? 'move' : 'bring'} ${plural(list.length)} here`, ops.map((o) => o.ref), commit(ops), { before })
  return list.map((c) => c.id)
}

// Moving a card's home to another plane it's on (the earliest it came to): its spot and fold there become the card's,
// that place goes. Null when it's on no other plane (`except` left out too).
function rehome(wid: string, card: Card, places: Place[], except: string): Op[] | null {
  const p = places.filter((x) => x.cardId === card.id && x.planeId !== card.pieceId && x.planeId !== except).sort((a, b) => a.createdAt - b.createdAt)[0]
  if (!p) return null
  return [
    { ref: cardRef(wid, card.type, card.id), data: { pieceId: p.planeId, x: p.x, y: p.y, folded: p.folded ? true : deleteField(), updatedAt: Date.now() } },
    { ref: placeRef(wid, p.planeId, card.id), data: null },
  ]
}

// Cards taken off `plane`, staying on the others they're on, one undo step. A card on no other plane isn't touched
// (that's a delete). Returns how many came off.
export async function takeOff(wid: string, plane: string, list: Card[], places: Place[]) {
  const ops: Op[] = []
  let n = 0
  for (const c of list) {
    const o = c.pieceId === plane ? rehome(wid, c, places, plane) : [{ ref: placeRef(wid, plane, c.id), data: null }]
    if (o) (ops.push(...o), n++)
  }
  if (!n) return 0
  await tracked(`take ${plural(n)} off this plane`, ops.map((o) => o.ref), commit(ops))
  return n
}

// Delete on a plane (the user, D-281): cards also on another plane come off this one, the others are deleted with their
// links, text too; one undo step. Returns the cards taken off.
export async function removeHere(wid: string, plane: string, list: Card[], all: { edges: Edge[]; places: Place[] }, labels: { id: string }[] = []) {
  const off = list.filter((c) => elsewhere(c, all.places, plane).length)
  const gone = list.filter((c) => !off.includes(c))
  const ids = new Set(gone.map((c) => c.id))
  const ops: Op[] = [
    ...off.flatMap((c) => (c.pieceId === plane ? (rehome(wid, c, all.places, plane) ?? []) : [{ ref: placeRef(wid, plane, c.id), data: null }])),
    ...gone.map((c) => ({ ref: cardRef(wid, c.type, c.id), data: null })),
    ...edgesOn(all.edges, ids).map((e) => ({ ref: edgeRef(wid, e.id), data: null })),
    ...all.places.filter((p) => ids.has(p.cardId)).map((p) => ({ ref: placeRef(wid, p.planeId, p.cardId), data: null })),
    ...labels.map((l) => ({ ref: labelRef(wid, l.id), data: null })),
  ]
  if (!ops.length) return off
  const n = list.length + labels.length
  const what = !gone.length && !labels.length ? `take ${plural(off.length)} off this plane` : off.length ? `remove ${n} things` : `delete ${n > 1 ? `${n} things` : gone.length ? 'a card' : 'text'}`
  await tracked(what, ops.map((o) => o.ref), commit(ops))
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
