// Whole screens in the gallery (D-324, G3): WorkspaceLayout can't mount itself (it loads the workspace from Firestore),
// so the screen is put together as the demo's CanvasScreen does (src/demo/views.tsx): the HUD (breadcrumb, side nav,
// the bottom-left corner) over the real CanvasView, and the finder. Over Pazar, through onCanvas (its states: focus,
// picked, edit…), and with a second canvas when the breadcrumb's prompt is the point.
import { CanvasScreen } from '../demo/views'
import { MAIN, setCanvasHere } from '../data/canvases'
import { WID } from '../demo/fixtures/pazar'
import { camOf, useCanvasView } from '../state/canvasView'
import { onCanvas, P, PAZAR, type OnCanvas } from './canvas'
import type { StateSpec } from './example'

export function Screen() {
  setCanvasHere(MAIN)
  return <CanvasScreen />
}

export const screen = (o: OnCanvas = {}): StateSpec => ({ ...onCanvas(o), render: () => <Screen /> })

// Pazar on two canvases, as the `canvases` scene has it: Main (the planes, the matrix, the table) and Launch week (the
// deck, its days and the research).
export const LAUNCH = 'c-launch'
const ON_LAUNCH = new Set<string>([P.deck, P.days, P.docs])
export const twoCanvases = (ws: typeof PAZAR): typeof PAZAR => ({
  ...ws,
  canvases: [...ws.canvases, { id: LAUNCH, name: 'Launch week', order: 1, createdAt: ws.workspace.createdAt }, { id: 'c-ideas', name: 'Ideas', order: 2, createdAt: ws.workspace.createdAt }],
  pieces: ws.pieces.map((p) => (ON_LAUNCH.has(p.id) ? { ...p, canvasId: LAUNCH } : p)),
})

// A point of the canvas (its px) on the page, in the canvas element's box: what a peer's cursor is placed by.
export function onCanvasAt(x: number, y: number): [number, number] {
  const cam = camOf(WID)
  const { size } = useCanvasView.getState()
  return [size.w / 2 + cam.x + x * cam.zoom, size.h / 2 + cam.y + y * cam.zoom]
}
// The same in the piece in focus, through its own view.
export function inFocusAt(x: number, y: number): [number, number] | null {
  const v = useCanvasView.getState().planeCam
  return v ? [v.ox + x * v.zoom, v.oy + y * v.zoom] : null
}
