// What a piece shows when it's stuck to a plane or let go (D-210, D-215), as plan data (S6): a table's own plane rule
// (first, `auto`), a matrix's typed axes' plane. data/pieces.ts' boundTo wrote the same with deleteField().
import type { Piece } from '../data/model'
import { DELETE } from './types'

// The fields to patch (dotted paths) when `piece` is stuck to `plane` (or let go: null).
export function boundTo(piece: Pick<Piece, 'kind' | 'table' | 'matrix' | 'stuckTo'>, plane: string | null): Record<string, unknown> {
  const was = piece.stuckTo ?? null
  if (piece.kind === 'table' && piece.table) {
    const rules = (piece.table.rows?.rules ?? []).filter((r) => !r.auto)
    return { 'table.rows.rules': plane ? [{ field: 'plane', values: [plane], auto: true }, ...rules] : rules }
  }
  if (piece.kind === 'matrix' && piece.matrix) {
    const out: Record<string, unknown> = {}
    for (const which of ['rows', 'cols'] as const) {
      const a = piece.matrix[which]
      if (!a?.type) continue
      // Only a plane it had from being stuck, or none: one picked by hand stays.
      if (plane && (!a.plane || a.plane === was)) out[`matrix.${which}.plane`] = plane
      if (!plane && was && a.plane === was) out[`matrix.${which}.plane`] = DELETE
    }
    return out
  }
  return {}
}

// A dotted patch played onto a copy of `data` (for a new doc, which can't be patched).
export function withPatch(data: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out = structuredClone(data)
  for (const [path, v] of Object.entries(patch)) {
    const parts = path.split('.')
    let o = out
    for (const p of parts.slice(0, -1)) o = (o[p] && typeof o[p] === 'object' ? o[p] : (o[p] = {})) as Record<string, unknown>
    const last = parts[parts.length - 1]
    if (v === DELETE) delete o[last]
    else o[last] = v
  }
  return out
}
