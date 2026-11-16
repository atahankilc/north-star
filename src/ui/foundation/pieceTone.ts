// Each piece kind's colour (D-263; D-394): one map beside CARD_TONE, pointing at tokens. Every place that colours a
// piece by its kind reads it here: its band and tab on the canvas, its marks, its shape in a workspace's picture.
import type { PieceKind } from '../../data/model'

export const PIECE_TONE: Record<PieceKind, string> = {
  plane: 'var(--fg)',
  matrix: 'var(--link-solves)',
  table: 'var(--link-part)',
  kanban: 'var(--link-draws)',
  documents: 'var(--link-depends)',
  document: 'var(--link-depends)',
  timeline: 'var(--link-competes)',
}
