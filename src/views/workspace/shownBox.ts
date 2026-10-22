// Where a piece is on the canvas as it's drawn (D-228). A plane, or a matrix or table in its window, is its own box; one
// opened onto the canvas is as big as its contents plus a grid step round them, two under them (its name sits in the top
// margin, its console in the bottom one; its edge and fill gone), however its window was sized: that w/h stays stored for
// when it's closed again.
import type { Card } from '../../data/cards'
import { GRID } from '../../data/grid'
import type { Piece } from '../../data/model'
import { create } from 'zustand'
import { canOpen, kindOfPiece, type Box } from '../../data/pieces'
import { matrixBounds } from './Matrix'
import { tableBounds } from './Table'

// The margin round an open piece's contents, and under them, where its console is.
export const OPEN_PAD = GRID
export const OPEN_FOOT = 2 * GRID

export const isOpen = (p: Pick<Piece, 'kind' | 'open'>) => canOpen(p) && !!p.open

// How big an open documents list or document (D-234) came out, measured as it's drawn: its contents aren't known
// from the data (rows of text, a document's length). Until it's measured, its window's size.
export const useOpenSize = create<Record<string, { w: number; h: number }>>(() => ({}))

export function shownBox(p: Piece, cards: Card[]): Box {
  if (!isOpen(p)) return { x: p.x, y: p.y, w: p.w, h: p.h }
  const kind = kindOfPiece(p)
  const b = kind === 'matrix' ? matrixBounds(p, cards) : kind === 'table' ? tableBounds(p, cards) : (useOpenSize.getState()[(p as Piece & { id?: string }).id ?? ''] ?? { w: p.w - 2 * OPEN_PAD, h: p.h - OPEN_PAD - OPEN_FOOT })
  return { x: p.x, y: p.y, w: Math.ceil(b.w) + 2 * OPEN_PAD, h: Math.ceil(b.h) + OPEN_PAD + OPEN_FOOT }
}

// The pieces as they're drawn, with everything else they carry.
export const shownPieces = <P extends Piece>(pieces: P[], cards: Card[]): P[] => pieces.map((p) => (isOpen(p) ? { ...p, ...shownBox(p, cards) } : p))
