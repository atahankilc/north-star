// A workspace's canvases (D-302, docs/specs/canvases.md): one to start with (`main`, implied, no doc until it's renamed
// or a second is made), more for whoever wants them: a marketing canvas, an engineering one. Pieces and the canvas's
// own text say which they're on (`canvasId`, missing = `main`); text on a plane goes where its plane goes. Cards, links,
// tasks and documents stay the workspace's, so a card can be on planes on different canvases.
import { collection, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
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

export type CanvasContent = { pieces: WithId<Piece>[]; cards: Card[]; labels: Label[]; cells: Cell[]; edges: Edge[]; tasks: Task[]; places: Place[] }

// What deleting a canvas does (its confirm says it): its pieces go with what's theirs (a plane's cards and text, a
// matrix's or table's cells, a deck's tasks) and its own text; a card also on a plane on another canvas stays there
// (its home moves, as D-281's delete of a plane).
export function canvasGoes(canvas: string, all: CanvasContent) {
  const pieces = all.pieces.filter(onCanvas(canvas))
  const going = new Set(pieces.map((p) => p.id))
  const elsewhere = (c: Card) => all.places.filter((p) => p.cardId === c.id && !going.has(p.planeId)).sort((a, b) => a.createdAt - b.createdAt)[0]
  const homed = all.cards.filter((c) => going.has(c.pieceId))
  const stay = homed.filter((c) => elsewhere(c))
  const gone = homed.filter((c) => !elsewhere(c))
  return { pieces, going, stay, gone, elsewhere }
}

// The canvas, one undo step (⌘Z brings it back). Never the last one: the caller checks.
export function deleteCanvas(wid: string, canvas: string, all: CanvasContent) {
  const { pieces, going, stay, gone, elsewhere } = canvasGoes(canvas, all)
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
