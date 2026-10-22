// Each thing's glyph, the same wherever it's listed: the side nav's `+` and go to (D-196, D-222).
import type { PieceKind } from '../../data/model'

export const PIECE_GLYPH: Record<PieceKind, string> = { plane: '▦', matrix: '⊞', table: '☰' }
export const TEXT_GLYPH = { heading: 'T', paragraph: '¶', sticky: '▤', section: '⬚', title: '✦' } as const
