// ⌘C / ⌘V / ⌘D on the board (D-108): what's selected becomes a clip of its documents (selection.ts), pasted at the
// view's centre or, for a duplicate, just below and right of the originals.
import type { DocumentData } from 'firebase/firestore'
import { copied, copy, paste, type Clip } from '../../data/selection'
import { useHistory } from '../../data/history'
import { useCanvas } from '../../state/canvasStore'
import type { WorkspaceCtx } from '../workspace/context'

const OFFSET = 0.6

// A document as it's stored: no id, no times (paste gives new ones).
function bare(d: { id: string } & DocumentData): DocumentData {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = d
  return rest
}

export function clipOf(ws: WorkspaceCtx, ids: string[]): Clip | null {
  const pieces: Clip['pieces'] = []
  const lists = [
    ['customer', ws.customers],
    ['problem', ws.problems],
    ['idea', ws.ideas],
    ['feature', ws.features],
    ['competitor', ws.competitors],
    ['label', ws.labels],
  ] as const
  for (const id of ids) {
    for (const [kind, list] of lists) {
      const d = (list as ({ id: string } & DocumentData)[]).find((x) => x.id === id)
      // A competitor without a place yet isn't on the board.
      if (d && typeof d.x === 'number') pieces.push({ kind, id, data: bare(d) })
    }
  }
  if (pieces.length === 0) return null
  const competitors = new Set(pieces.filter((p) => p.kind === 'competitor').map((p) => p.id))
  const features = ws.competitorFeatures.filter((f) => competitors.has(f.competitorId)).map((f) => ({ id: f.id, data: bare(f) }))
  const inside = new Set([...pieces.map((p) => p.id), ...features.map((f) => f.id)])
  const edges = ws.edges
    .filter((e) => inside.has(e.fromId) && (inside.has(e.toId) || e.kind === 'for'))
    .map((e) => bare(e) as Clip['edges'][number])
  return { wid: ws.wid, pieces, features, edges }
}

const customersOf = (ws: WorkspaceCtx) => new Set(ws.customers.map((c) => c.id))

export function copySelection(ws: WorkspaceCtx) {
  const clip = clipOf(ws, useCanvas.getState().selection)
  if (!clip) return
  copy(clip)
  useHistory.getState().say(`Copied ${clip.pieces.length} thing${clip.pieces.length === 1 ? '' : 's'}`)
}

// Centred on `centre` (a right-click's spot, D-117), or on the view.
export async function pasteClip(ws: WorkspaceCtx, centre?: [number, number]) {
  const clip = copied()
  if (!clip) return
  const xs = clip.pieces.map((p) => p.data.x as number)
  const ys = clip.pieces.map((p) => p.data.y as number)
  // The top-left corner goes half the clip's size up and left of the centre.
  const [cx, cy] = centre ?? useCanvas.getState().viewCenter()
  const at: [number, number] = [cx - (Math.max(...xs) - Math.min(...xs)) / 2, cy + (Math.max(...ys) - Math.min(...ys)) / 2]
  const made = await paste(ws.wid, at, customersOf(ws), clip)
  useCanvas.getState().selectMany(made.map((m) => m.id))
}

export async function duplicateSelection(ws: WorkspaceCtx) {
  const clip = clipOf(ws, useCanvas.getState().selection)
  if (!clip) return
  const x0 = Math.min(...clip.pieces.map((p) => p.data.x as number))
  const y0 = Math.max(...clip.pieces.map((p) => p.data.y as number))
  const made = await paste(ws.wid, [x0 + OFFSET, y0 - OFFSET], customersOf(ws), clip)
  useCanvas.getState().selectMany(made.map((m) => m.id))
}
