// Dragging a selection (D-108): grab any selected card or label and everything selected moves with it, streamed to
// collaborators like a single drag, and undone in one step (endMoveMany).
import { moveLabel } from '../../data/labels'
import { moveNode } from '../../data/nodes'
import { endMoveMany, type Piece } from '../../data/selection'
import { useCanvas } from '../../state/canvasStore'

type Where = Piece & { x: number; y: number }

// Every card and label on the board and where it is; the board keeps this current.
let pieces = new Map<string, Where>()
export function setPieces(next: Map<string, Where>) {
  pieces = next
}
export const pieceOf = (id: string) => pieces.get(id)

const WRITE_EVERY_MS = 120
let group: { from: Where[]; lastWrite: number; moved: boolean } | null = null

// Starts a group drag if `id` is part of a selection of several; false otherwise (drag it alone).
export function startGroup(id: string): boolean {
  const { selection } = useCanvas.getState()
  if (selection.length < 2 || !selection.includes(id)) return false
  group = { from: selection.flatMap((s) => (pieces.has(s) ? [pieces.get(s)!] : [])), lastWrite: 0, moved: false }
  return true
}

export function moveGroup(wid: string, delta: [number, number]) {
  if (!group) return
  group.moved = true
  const { setDragging } = useCanvas.getState()
  const now = performance.now()
  const write = now - group.lastWrite > WRITE_EVERY_MS
  if (write) group.lastWrite = now
  for (const p of group.from) {
    const x = p.x + delta[0]
    const y = p.y + delta[1]
    setDragging(p.id, [x, y])
    if (write) void (p.kind === 'label' ? moveLabel(wid, p.id, x, y) : moveNode(wid, p.kind, p.id, x, y))
  }
}

// Ends the drag; true if anything moved.
export function endGroup(wid: string): boolean {
  if (!group) return false
  const { dragging, setDragging } = useCanvas.getState()
  const moved = group.moved
  const moves = group.from.flatMap((p) => {
    const to = dragging[p.id]
    return to ? [{ kind: p.kind, id: p.id, from: [p.x, p.y] as [number, number], to }] : []
  })
  if (moved && moves.length) void endMoveMany(wid, moves)
  for (const p of group.from) setDragging(p.id, null)
  group = null
  return moved
}

export const inGroupDrag = () => group !== null
