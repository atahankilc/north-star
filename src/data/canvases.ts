// A workspace's canvases (D-302, docs/specs/canvases.md): one to start with (`main`, implied, no doc until it's renamed
// or a second is made), more for whoever wants them: a marketing canvas, an engineering one. Pieces and the canvas's
// own text say which they're on (`canvasId`, missing = `main`); text on a plane goes where its plane goes. Cards, links,
// tasks and documents stay the workspace's, so a card can be on planes on different canvases.
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { absent, tracked } from './history'
import { cardRef, placeRef, type Card } from './cards'
import { edgeRef, edgesOn, type Edge } from './edges'
import { CANVAS, labelRef, type Label } from './labels'
import { cellKey, cellRef, type Cell } from './matrix'
import { taskRef, type Task } from './tasks'
import type { Place } from './places'
import type { WithId } from './hooks'
import type { Piece } from './model'
import { KIND_NAME, kindOfPiece, nearClear, pieceRef, type Box } from './pieces'

export const MAIN = 'main'
export const CANVAS_NAME_MAX = 60
// The first canvas's name until someone gives it one.
export const MAIN_NAME = 'Main'

export type Canvas = { id: string; name: string; order: number; createdAt: number; createdBy?: string }

const col = (wid: string) => collection(db(), 'workspaces', wid, 'canvases')
export const canvasRef = (wid: string, id: string) => doc(col(wid), id)

// Which canvas a piece or the canvas's text is on.
export const canvasOf = (x: { canvasId?: string }) => x.canvasId || MAIN
export const onCanvas = (canvas: string) => (x: { canvasId?: string }) => canvasOf(x) === canvas
// Text on the canvas `canvas` (not on a plane, which goes with its plane).
export const canvasTextOn = (canvas: string) => (l: Pick<Label, 'pieceId' | 'canvasId'>) => l.pieceId === CANVAS && canvasOf(l) === canvas

// ---- One piece on several canvases (D-302's session 3): its home is its own `canvasId` and x/y; every other canvas it's
// on is a `pieceSpots/{canvasId}_{pieceId}` doc with its spot there. Size, frame, name and contents stay the piece's.
export type Spot = { id: string; canvasId: string; pieceId: string; x: number; y: number; createdAt: number }
export const spotRef = (wid: string, canvas: string, piece: string) => doc(db(), 'workspaces', wid, 'pieceSpots', `${canvas}_${piece}`)

// The pieces on `canvas`, each with its spot there (`spot` set for those not at home). One shown through a spot is the
// same object while neither it nor its spot changed, so what's drawn from it stays memoised (D-279).
const viaSpot = new WeakMap<object, { spot: Spot; piece: WithId<Piece> }>()
export function piecesOn(canvas: string, pieces: WithId<Piece>[], spots: Spot[]): WithId<Piece>[] {
  const out = pieces.filter(onCanvas(canvas))
  const here = spots.filter((s) => s.canvasId === canvas)
  if (!here.length) return out
  const byId = new Map(pieces.map((p) => [p.id, p]))
  for (const s of here) {
    const base = byId.get(s.pieceId)
    if (!base || canvasOf(base) === canvas) continue
    const was = viaSpot.get(base)
    if (was && was.spot.x === s.x && was.spot.y === s.y && was.spot.canvasId === s.canvasId) out.push(was.piece)
    else {
      const piece = { ...base, x: s.x, y: s.y, spot: canvas }
      viaSpot.set(base, { spot: s, piece })
      out.push(piece)
    }
  }
  return out
}

// The canvases a piece is on, its own first.
export const canvasesOf = (p: { id: string; canvasId?: string }, spots: Spot[]) => [canvasOf(p), ...spots.filter((s) => s.pieceId === p.id && s.canvasId !== canvasOf(p)).sort((a, b) => a.createdAt - b.createdAt).map((s) => s.canvasId)]

// Which pieces the canvas shown shows through a spot: their moves write the spot (pieces.ts' placeAll, a section's carry).
let throughSpot = new Set<string>()
export const setSpotted = (ids: Iterable<string>) => void (throughSpot = new Set(ids))
export const spotted = (id: string) => throughSpot.has(id)
export const posRef = (wid: string, id: string) => (throughSpot.has(id) ? spotRef(wid, here, id) : doc(db(), 'workspaces', wid, 'pieces', id))

// The canvases in order, `main` first even without its doc.
export function canvasList(docs: WithId<Omit<Canvas, 'id'>>[]): Canvas[] {
  const list = docs.filter((c) => typeof c.name === 'string').slice()
  if (!list.some((c) => c.id === MAIN)) list.push({ id: MAIN, name: MAIN_NAME, order: 0, createdAt: 0 })
  return list.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

// The canvas new things go on: the one shown, set by the workspace's layout. A piece or the canvas's text made there
// carries it; on `main` nothing (old workspaces keep their shape).
let here = MAIN
export const setCanvasHere = (id: string) => void (here = id)
export const canvasHere = () => here
export const canvasField = (): { canvasId?: string } => (here === MAIN ? {} : { canvasId: here })

// A new canvas after the others; `main`'s doc written with it the first time (it had none). One undo step.
export async function addCanvas(wid: string, name: string, list: Canvas[], uid?: string) {
  const ref = doc(col(wid))
  const now = Date.now()
  const main = list.find((c) => c.id === MAIN && !c.createdAt)
  const refs = main ? [ref, canvasRef(wid, MAIN)] : [ref]
  const order = Math.max(0, ...list.map((c) => c.order)) + 1
  await tracked('add a canvas', refs, () => {
    const batch = writeBatch(db())
    batch.set(ref, { name: name.trim().slice(0, CANVAS_NAME_MAX), order, createdAt: now, ...(uid ? { createdBy: uid } : {}) })
    if (main) batch.set(canvasRef(wid, MAIN), { name: MAIN_NAME, order: 0, createdAt: now })
    return batch.commit()
  }, { before: absent(refs) })
  return ref.id
}

export function renameCanvas(wid: string, c: Canvas, name: string) {
  const ref = canvasRef(wid, c.id)
  const value = name.trim().slice(0, CANVAS_NAME_MAX) || MAIN_NAME
  // `main` may have no doc yet: written whole.
  if (!c.createdAt) return tracked('rename a canvas', [ref], () => setDoc(ref, { name: value, order: c.order, createdAt: Date.now() }), { before: absent([ref]) })
  return tracked('rename a canvas', [ref], () => updateDoc(ref, { name: value }))
}

// One place up or down: swaps its order with its neighbour's. Orders are made distinct first (two equal ones swap to
// the same). One undo step.
export function moveCanvas(wid: string, list: Canvas[], id: string, by: -1 | 1) {
  const i = list.findIndex((c) => c.id === id)
  const j = i + by
  if (i < 0 || j < 0 || j >= list.length) return
  const next = list.slice()
  ;[next[i], next[j]] = [next[j], next[i]]
  const now = Date.now()
  const refs = next.map((c) => canvasRef(wid, c.id))
  return tracked('move a canvas', refs, () => {
    const batch = writeBatch(db())
    next.forEach((c, k) => batch.set(canvasRef(wid, c.id), { name: c.name, order: k, createdAt: c.createdAt || now, ...(c.createdBy ? { createdBy: c.createdBy } : {}) }))
    return batch.commit()
  })
}

export type CanvasContent = { pieces: WithId<Piece>[]; cards: Card[]; labels: Label[]; cells: Cell[]; edges: Edge[]; tasks: Task[]; places: Place[]; spots: Spot[] }

// What deleting a canvas does (its confirm says it): its pieces go with what's theirs (a plane's cards and text, a
// matrix's or table's cells, a deck's tasks) and its own text; a card also on a plane on another canvas stays there
// (its home moves, as D-281's delete of a plane).
// A piece also on another canvas stays there (its home moves, as a card's does), and its spots here go.
export function canvasGoes(canvas: string, all: CanvasContent) {
  const homed = all.pieces.filter(onCanvas(canvas))
  const away = (p: { id: string }) => all.spots.filter((s) => s.pieceId === p.id && s.canvasId !== canvas).sort((a, b) => a.createdAt - b.createdAt)[0]
  const pieces = homed.filter((p) => !away(p))
  const kept = homed.filter((p) => away(p)).map((p) => ({ piece: p, to: away(p)! }))
  const going = new Set(pieces.map((p) => p.id))
  const elsewhere = (c: Card) => all.places.filter((p) => p.cardId === c.id && !going.has(p.planeId)).sort((a, b) => a.createdAt - b.createdAt)[0]
  const cardsHome = all.cards.filter((c) => going.has(c.pieceId))
  const stay = cardsHome.filter((c) => elsewhere(c))
  const gone = cardsHome.filter((c) => !elsewhere(c))
  return { pieces, going, stay, gone, elsewhere, kept }
}

// The canvas, one undo step (⌘Z brings it back). Never the last one: the caller checks.
export function deleteCanvas(wid: string, canvas: string, all: CanvasContent) {
  const { pieces, going, stay, gone, elsewhere, kept } = canvasGoes(canvas, all)
  const goneIds = new Set(gone.map((c) => c.id))
  const now = Date.now()
  const ops: { ref: ReturnType<typeof canvasRef>; data: Record<string, unknown> | null }[] = [
    { ref: canvasRef(wid, canvas), data: null },
    ...pieces.map((p) => ({ ref: doc(db(), 'workspaces', wid, 'pieces', p.id), data: null })),
    ...gone.map((c) => ({ ref: cardRef(wid, c.type, c.id), data: null })),
    ...edgesOn(all.edges, goneIds).map((e) => ({ ref: edgeRef(wid, e.id), data: null })),
    // A card kept takes the spot it had on the plane it stays on; that place goes.
    ...stay.flatMap((c) => {
      const p = elsewhere(c)!
      return [
        { ref: cardRef(wid, c.type, c.id), data: { pieceId: p.planeId, x: p.x, y: p.y, folded: p.folded ? true : deleteField(), updatedAt: now } },
        { ref: placeRef(wid, p.planeId, c.id), data: null },
      ]
    }),
    ...all.places.filter((p) => going.has(p.planeId) || goneIds.has(p.cardId)).map((p) => ({ ref: placeRef(wid, p.planeId, p.cardId), data: null })),
    ...all.labels.filter((l) => going.has(l.pieceId) || canvasTextOn(canvas)(l)).map((l) => ({ ref: labelRef(wid, l.id), data: null })),
    ...all.cells.filter((c) => going.has(c.matrixId)).map((c) => ({ ref: cellRef(wid, cellKey(c.matrixId, c.row, c.col)), data: null })),
    ...all.tasks.filter((t) => going.has(t.pieceId)).map((t) => ({ ref: taskRef(wid, t.id), data: null })),
    // A piece also elsewhere: its home moves to its first other canvas, that spot goes; its spots here and those of
    // the pieces going, too.
    ...kept.flatMap(({ piece, to }) => [
      { ref: pieceRef(wid, piece.id), data: { canvasId: to.canvasId === MAIN ? deleteField() : to.canvasId, x: to.x, y: to.y, updatedAt: now } },
      { ref: spotRef(wid, to.canvasId, piece.id), data: null },
    ]),
    ...all.spots.filter((s) => s.canvasId === canvas || going.has(s.pieceId)).map((s) => ({ ref: spotRef(wid, s.canvasId, s.pieceId), data: null })),
  ]
  // A place deleted twice (its plane going and its card going) is one op.
  const seen = new Set<string>()
  const unique = ops.filter((o) => (seen.has(o.ref.path) ? false : (seen.add(o.ref.path), true)))
  return tracked('delete a canvas', unique.map((o) => o.ref), async () => {
    for (let i = 0; i < unique.length; i += 450) {
      const batch = writeBatch(db())
      for (const o of unique.slice(i, i + 450)) {
        if (o.data) batch.update(o.ref, o.data)
        else batch.delete(o.ref)
      }
      await batch.commit()
    }
  })
}

// What goes along when pieces move to another canvas (D-302's session 2): what's stuck to them, all the way down (a
// plane's deck, that deck's timeline, D-298). A plane's cards, text and links are the plane's already.
export function withStuck(ids: string[], pieces: WithId<Piece>[]): WithId<Piece>[] {
  const going = new Set(ids)
  for (let grew = true; grew; ) {
    grew = false
    for (const p of pieces) if (p.stuckTo && going.has(p.stuckTo) && !going.has(p.id)) (going.add(p.id), (grew = true))
  }
  return pieces.filter((p) => going.has(p.id))
}

// Pieces and the canvas's text moved to the canvas `to`, all by one step: where they were, or the nearest clear place
// there round it (`boxes`: how big each is as drawn; `all`: every piece, what's in the way there). A piece stuck to one
// that stays lets go. One undo step; returns where they went (to look there).
export async function moveToCanvas(wid: string, to: Canvas, pieces: WithId<Piece>[], labels: Label[], boxes: Box[], all: WithId<Piece>[], spots: Spot[] = []) {
  const x0 = Math.min(...boxes.map((b) => b.x))
  const y0 = Math.min(...boxes.map((b) => b.y))
  const bounds = { x: x0, y: y0, w: Math.max(...boxes.map((b) => b.x + b.w)) - x0, h: Math.max(...boxes.map((b) => b.y + b.h)) - y0 }
  const at = nearClear(bounds, all, to.id)
  const dx = at.x - bounds.x
  const dy = at.y - bounds.y
  const canvasId = to.id === MAIN ? deleteField() : to.id
  const moved = new Set(pieces.map((p) => p.id))
  const now = Date.now()
  const ops: { ref: ReturnType<typeof pieceRef>; data: Record<string, unknown> | null }[] = [
    ...pieces.map((p) => ({ ref: pieceRef(wid, p.id), data: { canvasId, x: p.x + dx, y: p.y + dy, ...(p.stuckTo && !moved.has(p.stuckTo) ? { stuckTo: deleteField() } : {}), updatedAt: now } })),
    // Already on that canvas too (D-302's session 3): now its home, so that spot goes.
    ...spots.filter((s) => s.canvasId === to.id && moved.has(s.pieceId)).map((s) => ({ ref: spotRef(wid, s.canvasId, s.pieceId), data: null })),
    ...labels.map((l) => ({ ref: labelRef(wid, l.id), data: { canvasId, x: l.x + dx, y: l.y + dy, updatedAt: now } })),
  ]
  const n = pieces.length + labels.length
  const what = n > 1 ? `${n} things` : pieces.length ? `a ${KIND_NAME[kindOfPiece(pieces[0])]}` : 'text'
  await tracked(`move ${what} to ${to.name}`, ops.map((o) => o.ref), () => {
    const batch = writeBatch(db())
    for (const o of ops) (o.data ? batch.update(o.ref, o.data) : batch.delete(o.ref))
    return batch.commit()
  })
  return { ...bounds, x: at.x, y: at.y }
}

// The same pieces on the canvas `to` as well (D-302's session 3), all by one offset, where they are or the nearest clear
// place there (`all`: what's on it, through spots too). Those already there stay as they are. One undo step.
export async function alsoOnCanvas(wid: string, to: Canvas, pieces: WithId<Piece>[], boxes: Box[], all: WithId<Piece>[]) {
  const there = new Set(all.filter((p) => (p.spot ?? canvasOf(p)) === to.id).map((p) => p.id))
  const list = pieces.filter((p) => !there.has(p.id))
  if (!list.length) return null
  const x0 = Math.min(...boxes.map((b) => b.x))
  const y0 = Math.min(...boxes.map((b) => b.y))
  const bounds = { x: x0, y: y0, w: Math.max(...boxes.map((b) => b.x + b.w)) - x0, h: Math.max(...boxes.map((b) => b.y + b.h)) - y0 }
  const at = nearClear(bounds, all, to.id)
  const now = Date.now()
  const refs = list.map((p) => spotRef(wid, to.id, p.id))
  await tracked(`put ${list.length > 1 ? `${list.length} things` : `a ${KIND_NAME[kindOfPiece(list[0])]}`} on ${to.name} too`, refs, () => {
    const batch = writeBatch(db())
    list.forEach((p, i) => batch.set(refs[i], { canvasId: to.id, pieceId: p.id, x: p.x + at.x - bounds.x, y: p.y + at.y - bounds.y, createdAt: now }))
    return batch.commit()
  }, { before: absent(refs) })
  return { ...bounds, x: at.x, y: at.y }
}

// Off the canvas `canvas` only, staying on the others it's on (D-302's session 3); on its home, the home moves to its
// first other canvas and that spot goes. Returns the canvases it's still on, or null when it's on no other (a delete).
export async function takeOffCanvas(wid: string, piece: WithId<Piece>, canvas: string, spots: Spot[]) {
  const on = canvasesOf(piece, spots)
  const still = on.filter((c) => c !== canvas)
  if (!still.length) return null
  const kind = KIND_NAME[kindOfPiece(piece)]
  if (canvasOf(piece) !== canvas) {
    const ref = spotRef(wid, canvas, piece.id)
    await tracked(`take a ${kind} off this canvas`, [ref], () => deleteDoc(ref))
    return still
  }
  const s = spots.find((x) => x.pieceId === piece.id && x.canvasId === still[0])!
  const refs = [pieceRef(wid, piece.id), spotRef(wid, s.canvasId, piece.id)]
  await tracked(`take a ${kind} off this canvas`, refs, () => {
    const batch = writeBatch(db())
    batch.update(refs[0], { canvasId: s.canvasId === MAIN ? deleteField() : s.canvasId, x: s.x, y: s.y, updatedAt: Date.now() })
    batch.delete(refs[1])
    return batch.commit()
  })
  return still
}
