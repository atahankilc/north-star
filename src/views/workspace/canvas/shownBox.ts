// Where a piece is on the canvas as it's drawn (D-228). A plane, or a matrix or table in its window, is its own box; one
// opened onto the canvas is as big as its contents plus a grid step round them, two under them (its name sits in the top
// margin, its console in the bottom one; its edge and fill gone), however its window was sized: that w/h stays stored for
// when it's closed again. How big its contents are is its kind's (pieceKinds.tsx `opened`).
import type { Card } from '../../../data/cards'
import type { Piece } from '../../../data/model'
import { canOpen, type Box } from '../../../data/pieces'
import type { WithId } from '../../../data/hooks'
import { kindRecord } from './pieceKinds'
import { OPEN_FOOT, OPEN_PAD, useOpenSize } from './sizes'

export { OPEN_PAD, useOpenSize }

export const isOpen = (p: Pick<Piece, 'kind' | 'open'>) => canOpen(p) && !!p.open

function shownBox(p: Piece, cards: Card[]): Box {
  if (!isOpen(p)) return { x: p.x, y: p.y, w: p.w, h: p.h }
  // Until it's been drawn (a kind measured as it draws), its window's size.
  const b = kindRecord(p)?.opened(p as WithId<Piece>, cards) ?? { w: p.w - 2 * OPEN_PAD, h: p.h - OPEN_PAD - OPEN_FOOT }
  return { x: p.x, y: p.y, w: Math.ceil(b.w) + 2 * OPEN_PAD, h: Math.ceil(b.h) + OPEN_PAD + OPEN_FOOT }
}

// The pieces as they're drawn, with everything else they carry.
export const shownPieces = <P extends Piece>(pieces: P[], cards: Card[]): P[] => pieces.map((p) => (isOpen(p) ? { ...p, ...shownBox(p, cards) } : p))
