// What a piece is, without Firebase (S3, D-312); data/pieces.ts re-exports it and keeps the writes.
import type { Piece, PieceKind } from '../data/model'

// A new piece's size in canvas pixels at zoom 1.
export const PIECE_SIZE: Record<PieceKind, { w: number; h: number }> = {
  plane: { w: 960, h: 600 },
  matrix: { w: 800, h: 500 },
  table: { w: 800, h: 400 },
  documents: { w: 800, h: 450 },
  document: { w: 650, h: 500 },
  kanban: { w: 900, h: 500 },
  timeline: { w: 1000, h: 420 },
}

// The smallest a piece resizes to (D-180): room for its name and its console. Whole steps of the grid.
export const PIECE_MIN = { w: 325, h: 200 }

export const KIND_NAME: Record<PieceKind, string> = { plane: 'plane', matrix: 'matrix', table: 'table', documents: 'documents', document: 'document', kanban: 'deck', timeline: 'timeline' }

// What a piece is.
const KINDS: PieceKind[] = ['matrix', 'table', 'documents', 'document', 'kanban', 'timeline']
export const kindOfPiece = (p: Pick<Piece, 'kind'>): PieceKind => (KINDS.includes(p.kind) ? p.kind : 'plane')

// Not a plane (D-206, D-209, D-232): just its contents on the canvas, at their own size, with a focus of its own (no
// ink, no marks).
export const isBare = (p: Pick<Piece, 'kind'>) => kindOfPiece(p) !== 'plane'

// A lens on the cards (D-209): a matrix or a table, which sticks to a plane (D-210) and opens onto the canvas (D-228).
export const isLens = (p: Pick<Piece, 'kind'>) => p.kind === 'matrix' || p.kind === 'table'

// What sticks to something (D-210): a lens or a kanban to a plane (D-255), a timeline to a kanban (D-262).
export const sticks = (p: Pick<Piece, 'kind'>) => isLens(p) || p.kind === 'kanban' || p.kind === 'timeline'
// What it sticks to: a plane; a timeline to a deck or a plane (D-262, D-300: a plane's deck's days, once it has one).
export const hostKinds = (p: Pick<Piece, 'kind'>): PieceKind[] => (p.kind === 'timeline' ? ['kanban', 'plane'] : sticks(p) ? ['plane'] : [])
// What others stick to: a plane, a kanban.
export const isHost = (p: Pick<Piece, 'kind'>) => kindOfPiece(p) === 'plane' || p.kind === 'kanban'

// What can be taken out of its window onto the canvas (D-228): a lens, the documents list, a document (D-234), a kanban
// (D-251), a timeline (D-289).
export const canOpen = (p: Pick<Piece, 'kind'>) => isLens(p) || p.kind === 'documents' || p.kind === 'document' || p.kind === 'kanban' || p.kind === 'timeline'

// firestore.rules' validPiece allows 80.
export const PIECE_NAME_MAX = 80
