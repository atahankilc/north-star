// The selected cell of a grid (a matrix's, a table's) and the keys that move it (D-361: each had written it). The cell
// rides on the canvas's card selection (D-187), so Escape and leaving focus let go of it as of a card; its key holds the
// piece's id, since more than one can be live at once (open on the canvas, D-228; stacked beside a plane, D-211).
// Arrows move it (kept inside), the keyboard's focus going along so the one left behind isn't ringed; every other key on
// a selected cell goes to the grid's own `onKey`. Not while typing, a menu or a panel has the keys, nor with ⌘/Ctrl/⌥.
import { useEffect, useRef, type RefObject } from 'react'
import { useCanvasView } from '../../../state/canvasView'
import { keysTaken } from '../../../ui/foundation/focus'

export type CellAt = { r: number; c: number }

// A grid's selection key: `cell|<piece>|<row>|<col>` (a matrix) or `tcell|…` (a table).
export function cellSel(prefix: string) {
  const lead = `${prefix}|`
  return {
    key: (piece: string, row: string, col: string) => `${lead}${piece}|${row}|${col}`,
    parse: (piece: string, s: string | null) => (s?.startsWith(`${lead}${piece}|`) ? (s.slice(lead.length + piece.length + 1).split('|') as [string, string]) : null),
  }
}

// Which card a selected cell's row and column are (the card panel follows a cell's card, D-247): any grid's.
export const CELL_SEL = /^t?cell\|[^|]+\|([^|]+)\|([^|]+)$/

const MOVES: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

type Opts = {
  sel: ReturnType<typeof cellSel>
  piece: string
  live: boolean
  rows: string[]
  cols: string[]
  layer: RefObject<HTMLElement | null>
  onKey: (e: KeyboardEvent, at: CellAt) => void
}

export function useGridCursor({ sel, piece, live, rows, cols, layer, onKey }: Opts) {
  const picked = sel.parse(piece, useCanvasView((s) => (live ? s.cardSelected : null)))
  const ri = picked ? rows.indexOf(picked[0]) : -1
  const ci = picked ? cols.indexOf(picked[1]) : -1
  const selected: CellAt | null = ri >= 0 && ci >= 0 ? { r: ri, c: ci } : null
  const select = (r: number, c: number) => useCanvasView.setState({ cardSelected: sel.key(piece, rows[r], cols[c]), labelSelected: null })

  // A selected cell whose row or column went (taken out, or its card deleted) lets go.
  const gone = !!picked && !selected
  useEffect(() => {
    if (gone) useCanvasView.setState({ cardSelected: null })
  }, [gone])

  const keys = useRef<(e: KeyboardEvent) => void>(() => {})
  keys.current = (e: KeyboardEvent) => {
    if (!selected || keysTaken(e.target, { docked: true }) || e.metaKey || e.ctrlKey || e.altKey) return
    const move = MOVES[e.key]
    if (!move) return onKey(e, selected)
    e.preventDefault()
    const r = Math.min(rows.length - 1, Math.max(0, selected.r + move[0]))
    const c = Math.min(cols.length - 1, Math.max(0, selected.c + move[1]))
    select(r, c)
    layer.current?.querySelector<HTMLElement>(`[data-cell="${sel.key(piece, rows[r], cols[c])}"]`)?.focus()
  }
  useEffect(() => {
    if (!live) return
    const on = (e: KeyboardEvent) => keys.current(e)
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [live])

  return { selected, select }
}
