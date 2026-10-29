// A workspace's canvases (D-302) without Firebase (S3, D-312): their names, the one implied, the list in order. data/canvases.ts
// re-exports it and keeps the writes.
import type { WithId } from '../data/hooks'
import type { Card } from './cards'
import type { Label } from './labels'
import type { Place } from './placement'
import type { Piece } from '../data/model'
import type { Cell } from './matrix'
import type { Edge } from './edges'
import type { Task } from '../data/tasks'

export const MAIN = 'main'
export const CANVAS_NAME_MAX = 60
// The first canvas's name until someone gives it one.
export const MAIN_NAME = 'Main'

export type Canvas = { id: string; name: string; order: number; createdAt: number; createdBy?: string }

// Which canvas a piece or the canvas's text is on.
export const canvasOf = (x: { canvasId?: string }) => x.canvasId || MAIN
export type Spot = { id: string; canvasId: string; pieceId: string; x: number; y: number; createdAt: number }

// The canvases in order, `main` first even without its doc.
export function canvasList(docs: WithId<Omit<Canvas, 'id'>>[]): Canvas[] {
  const list = docs.filter((c) => typeof c.name === 'string').slice()
  if (!list.some((c) => c.id === MAIN)) list.push({ id: MAIN, name: MAIN_NAME, order: 0, createdAt: 0 })
  return list.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

// ---- Pure helpers moved from data/canvases.ts (S6): which canvas things are on, what goes with a canvas or a move.
// Kept free of data/ so the ops can use them; data/canvases.ts re-exports them under the same names.

// The canvas's own text lives on `canvas` (labels' CANVAS); written out here so this file stays import-free at run time.
const CANVAS_SPACE = 'canvas'

export const onCanvas = (canvas: string) => (x: { canvasId?: string }) => canvasOf(x) === canvas
// Text on the canvas `canvas` (not on a plane, which goes with its plane).
export const canvasTextOn = (canvas: string) => (l: Pick<Label, 'pieceId' | 'canvasId'>) => l.pieceId === CANVAS_SPACE && canvasOf(l) === canvas

// The canvases a piece is on, its own first.
export const canvasesOf = (p: { id: string; canvasId?: string }, spots: Spot[]) => [canvasOf(p), ...spots.filter((s) => s.pieceId === p.id && s.canvasId !== canvasOf(p)).sort((a, b) => a.createdAt - b.createdAt).map((s) => s.canvasId)]

// What goes along when pieces move to another canvas (D-302's session 2): what's stuck to them, all the way down (a
// plane's deck, that deck's timeline, D-298). A plane's cards, text and links are the plane's already.
export function withStuck<P extends { id: string; stuckTo?: string }>(ids: string[], pieces: P[]): P[] {
  const going = new Set(ids)
  for (let grew = true; grew; ) {
    grew = false
    for (const p of pieces) if (p.stuckTo && going.has(p.stuckTo) && !going.has(p.id)) (going.add(p.id), (grew = true))
  }
  return pieces.filter((p) => going.has(p.id))
}

export type CanvasContent = { pieces: WithId<Piece>[]; cards: Card[]; labels: Label[]; cells: Cell[]; edges: Edge[]; tasks: Task[]; places: Place[]; spots: Spot[] }

// What deleting a canvas does (its confirm says it): its pieces go with what's theirs (a plane's cards and text, a
// matrix's or table's cells, a deck's tasks) and its own text; a card also on a plane on another canvas stays there
// (its home moves, as D-281's delete of a plane).
// A piece also on another canvas stays there (its home moves, as a card's does), and its spots here go.
export function canvasGoes(canvas: string, all: Pick<CanvasContent, 'pieces' | 'cards' | 'places' | 'spots'>) {
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
