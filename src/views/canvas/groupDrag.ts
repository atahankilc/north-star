// Dragging a selection (D-108): grab any selected card or label and everything selected moves with it, streamed to
// collaborators like a single drag, and undone in one step (endMoveMany). A section (D-130) carries what's inside it.
import { endMoveMany, streamMany, type Piece } from '../../data/selection'
import { useCanvas } from '../../state/canvasStore'
import { clearGuides } from './guides'
import { holdsPoint, holdsRect, type Rect } from './sections'

// `half`: a section's half size (D-130), which the others don't need here.
type Where = Piece & { x: number; y: number; half?: [number, number]; section?: boolean }

// Every card and label on the board and where it is; the board keeps this current.
let pieces = new Map<string, Where>()
export function setPieces(next: Map<string, Where>) {
  pieces = next
}
export const pieceOf = (id: string) => pieces.get(id)

// The parts folded into each card (D-164): they go wherever it goes. The board keeps this current.
let folded = new Map<string, string[]>()
export function setFoldedParts(next: Map<string, string[]>) {
  folded = next
}
export const piecesOnBoard = () => pieces.values()

const WRITE_EVERY_MS = 120
let group: { from: Where[]; lastWrite: number; moved: boolean } | null = null

const frameOf = (p: Where): Rect => [p.x - p.half![0], p.y - p.half![1], p.x + p.half![0], p.y + p.half![1]]

// What a section holds (D-130): every piece whose centre is inside its frame, and every section wholly inside it (and
// so what those hold). A card's folded parts (D-164), and those of the cards a section holds. Nothing for anything else.
export function contentsOf(id: string): string[] {
  const s = pieces.get(id)
  if (!s?.section || !s.half) return folded.get(id) ?? []
  const r = frameOf(s)
  const held = [...pieces.values()]
    .filter((p) => p.id !== id && (p.section && p.half ? holdsRect(r, frameOf(p)) : holdsPoint(r, p.x, p.y)))
    .map((p) => p.id)
  return [...new Set([...held, ...held.flatMap((h) => folded.get(h) ?? [])])]
}

// These pieces and what the sections among them hold.
export const withContents = (ids: string[]) => [...new Set([...ids, ...ids.flatMap(contentsOf)])]

// Starts a group drag if `id` is part of a selection of several, or a section with something in it; false otherwise
// (drag it alone).
export function startGroup(id: string): boolean {
  const { selection } = useCanvas.getState()
  const ids = withContents(selection.length > 1 && selection.includes(id) ? selection : [id])
  if (ids.length < 2) return false
  group = { from: ids.flatMap((s) => (pieces.has(s) ? [pieces.get(s)!] : [])), lastWrite: 0, moved: false }
  return true
}

// What the drag in progress carries, if one is.
export const groupIds = () => (group ? new Set(group.from.map((p) => p.id)) : null)

export function moveGroup(wid: string, delta: [number, number]) {
  if (!group) return
  group.moved = true
  const places = group.from.map((p) => ({ kind: p.kind, id: p.id, to: [p.x + delta[0], p.y + delta[1]] as [number, number] }))
  // One store update and one batched write for the whole selection: per piece, the board re-rendered once per card on
  // every pointer move and the drag crawled.
  useCanvas.getState().setDraggingMany(places.map((p) => [p.id, p.to]))
  const now = performance.now()
  if (now - group.lastWrite > WRITE_EVERY_MS) {
    group.lastWrite = now
    void streamMany(wid, places).catch(() => {})
  }
}

// Ends the drag; true if anything moved.
export function endGroup(wid: string): boolean {
  if (!group) return false
  const { dragging, setDraggingMany, land } = useCanvas.getState()
  const moved = group.moved
  const moves = group.from.flatMap((p) => {
    const to = dragging[p.id]
    return to ? [{ kind: p.kind, id: p.id, from: [p.x, p.y] as [number, number], to }] : []
  })
  // The pieces stay where they were dropped until their data is there too (canvasStore `land`): let go at once and
  // they ran back through the places streamed during the drag.
  if (moved && moves.length) {
    void endMoveMany(wid, moves).catch(() => {})
    land(moves.map((m) => [m.id, m.to]))
  } else setDraggingMany(group.from.map((p) => [p.id, null]))
  clearGuides()
  group = null
  return moved
}

export const inGroupDrag = () => group !== null
