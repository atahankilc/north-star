// A workspace's canvases (D-302, docs/specs/canvases.md): one to start with (`main`, implied, no doc until it's renamed
// or a second is made), more for whoever wants them: a marketing canvas, an engineering one. Pieces and the canvas's
// own text say which they're on (`canvasId`, missing = `main`); text on a plane goes where its plane goes. Cards, links,
// tasks and documents stay the workspace's, so a card can be on planes on different canvases.
import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'
import type { Label } from './labels'
import type { WithId } from './hooks'
import type { Piece } from './model'
import type { Box } from './pieces'
import { applyUi, runUi, sayRefused, uiCtx } from '../ops/firestore'
import { createCanvas, moveCanvas as moveCanvasOp, moveToCanvasPlan, piecesOff, piecesOnPlan, rename } from '../ops/pieces'
import { deleteAny } from '../ops/delete'

// The names, the implied first canvas and the list in order live in src/model/canvases.ts, without Firebase (S3).
// What a canvas holds, what goes with it and with a move (S6) too.
export { MAIN, CANVAS_NAME_MAX, MAIN_NAME, canvasOf, canvasList, onCanvas, canvasTextOn, canvasesOf, withStuck, canvasGoes } from '../model/canvases'
export type { Canvas, Spot, CanvasContent } from '../model/canvases'
import { MAIN, canvasOf, canvasesOf, onCanvas, type Canvas, type CanvasContent, type Spot } from '../model/canvases'

const col = (wid: string) => collection(db(), 'workspaces', wid, 'canvases')
export const canvasRef = (wid: string, id: string) => doc(col(wid), id)


// ---- One piece on several canvases (D-302's session 3): its home is its own `canvasId` and x/y; every other canvas it's
// on is a `pieceSpots/{canvasId}_{pieceId}` doc with its spot there. Size, frame, name and contents stay the piece's.
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


// The canvas shown's pieces as drawn (CanvasView sets them): those through a spot have their moves written to it
// (pieces.ts' placeAll, a section's carry), and all of them are what's in a new piece's way there (nearClear).
let throughSpot = new Set<string>()
let drawn: (Box & { id: string })[] | null = null
export function setShownHere(shown: (Box & { id: string; spot?: string })[]) {
  drawn = shown
  throughSpot = new Set(shown.filter((p) => p.spot).map((p) => p.id))
}
export const shownHere = () => drawn
export const spotted = (id: string) => throughSpot.has(id)
export const posRef = (wid: string, id: string) => (throughSpot.has(id) ? spotRef(wid, here, id) : doc(db(), 'workspaces', wid, 'pieces', id))

// The canvas new things go on: the one shown, set by the workspace's layout. A piece or the canvas's text made there
// carries it; on `main` nothing (old workspaces keep their shape).
let here = MAIN
export const setCanvasHere = (id: string) => void (here = id)
export const canvasHere = () => here
export const canvasField = (): { canvasId?: string } => (here === MAIN ? {} : { canvasId: here })

// A new canvas after the others; `main`'s doc written with it the first time (it had none). One undo step (S6:
// create_canvas, made by the signed-in person). '' when none was made.
export async function addCanvas(wid: string, name: string, _list: Canvas[], _uid?: string) {
  const ctx = uiCtx(wid)
  if (!ctx) return ''
  let plan
  try {
    plan = createCanvas(ctx, { name })
  } catch (e) {
    sayRefused(e, 'add a canvas')
    return ''
  }
  const done = await applyUi(wid, ctx, [plan])
  if (!done) return ''
  await done.written
  return plan.ids.$new
}

// S6: rename (a canvas `main` without its doc yet gets one).
export function renameCanvas(wid: string, c: Canvas, name: string) {
  return runUi(wid, (ctx) => [rename(ctx, { id: c.id, name })], { label: 'rename a canvas' })
}

// One place up or down: swaps its order with its neighbour's. Orders are made distinct first (two equal ones swap to
// the same). One undo step (S6: move_canvas); nothing at either end.
export function moveCanvas(wid: string, list: Canvas[], id: string, by: -1 | 1) {
  const i = list.findIndex((c) => c.id === id)
  const j = i + by
  if (i < 0 || j < 0 || j >= list.length) return
  return runUi(wid, (ctx) => [moveCanvasOp(ctx, { canvas: id, by })], { label: 'move a canvas' })
}

// The canvas, one undo step (⌘Z brings it back): what goes with it is canvasGoes' (S6: delete, read from the workspace;
// `all` is ignored). Never the first (`main`): the op refuses it.
export function deleteCanvas(wid: string, canvas: string, _all?: CanvasContent) {
  return runUi(wid, (ctx) => [deleteAny(ctx, { ids: [canvas] })], { label: 'delete a canvas' })
}

// Pieces and the canvas's text moved to the canvas `to`, all by one step: where they were, or the nearest clear place
// there round it (`boxes`: how big each is as drawn). A piece stuck to one that stays lets go. One undo step; returns
// where they went (to look there), null when refused. S6: move_to_canvas with what the caller found (carry: false);
// what's in the way there is read from the workspace (`all`, `spots` ignored).
export async function moveToCanvas(wid: string, to: Canvas, pieces: WithId<Piece>[], labels: Label[], boxes: Box[], _all?: WithId<Piece>[], _spots: Spot[] = []) {
  const ctx = uiCtx(wid)
  if (!ctx) return null
  let made
  try {
    made = moveToCanvasPlan(ctx, { items: [...pieces.map((p) => p.id), ...labels.map((l) => l.id)], canvas: to.id, from: canvasHere(), carry: false, boxes })
  } catch (e) {
    sayRefused(e, `move to ${to.name}`)
    return null
  }
  const done = await applyUi(wid, ctx, [made.plan])
  if (!done) return null
  await done.written
  return made.landed
}

// The same pieces on the canvas `to` as well (D-302's session 3), all by one offset, where they are or the nearest clear
// place there. Those already there stay as they are. One undo step (S6: place_on with pieces and a canvas; what the
// caller found goes, carry: false); null when every one is there already.
export async function alsoOnCanvas(wid: string, to: Canvas, pieces: WithId<Piece>[], boxes: Box[], _all?: WithId<Piece>[]) {
  const ctx = uiCtx(wid)
  if (!ctx) return null
  let made
  try {
    made = piecesOnPlan(ctx, { pieces: pieces.map((p) => p.id), canvas: to.id, from: canvasHere(), carry: false, boxes })
  } catch (e) {
    sayRefused(e, `put it on ${to.name} too`)
    return null
  }
  if (!made.landed) return null
  const done = await applyUi(wid, ctx, [made.plan])
  if (!done) return null
  await done.written
  return made.landed
}

// Off the canvas `canvas` only, staying on the others it's on (D-302's session 3); on its home, the home moves to its
// first other canvas and that spot goes. Returns the canvases it's still on, or null when it's on no other (a delete).
// S6: take_off with a piece and a canvas; the spots are read from the workspace.
export async function takeOffCanvas(wid: string, piece: WithId<Piece>, canvas: string, _spots?: Spot[]) {
  const ctx = uiCtx(wid)
  if (!ctx) return null
  const stored = ctx.ws.pieces.find((p) => p.id === piece.id)
  if (!stored) return null
  const still = canvasesOf(stored, ctx.ws.spots).filter((c) => c !== canvas)
  if (!still.length) return null
  await runUi(wid, (c) => [piecesOff(c, { piece: piece.id, canvas })])
  return still
}

// A plane's name where cards are picked or listed (D-302's session 4): on another canvas than the one shown, that
// canvas's name before it (`Engineering / 02 Build`); with one canvas, or here (through a spot too), the name alone.
export function planeTitle(id: string, ws: { pieces: WithId<Piece>[]; canvases: Canvas[]; canvas: string }) {
  const p = ws.pieces.find((x) => x.id === id)
  const name = p?.name?.trim() || 'plane'
  if (!p || ws.canvases.length < 2 || (p.canvases ?? [canvasOf(p)]).includes(ws.canvas)) return name
  return `${ws.canvases.find((c) => c.id === canvasOf(p))?.name ?? 'another canvas'} / ${name}`
}
