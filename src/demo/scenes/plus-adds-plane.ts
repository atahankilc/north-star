// The welcome's third page for editors (onboarding-lessons.md §1 `welcome` page 3, "Add anything with +"): the whole
// screen, Pazar's pieces round a clear middle. The cursor goes to the side
// nav's magenta `+`, a rest, a click: the real menu builds cell by cell; a moment to read it, down to `plane`, a click.
// The menu closes (its own) and a plane appears in the middle of the screen (what addPiece would have written there,
// shown with set()), then goes into edit mode (the real setEditing) as `+` leaves a new piece. The side nav's own lesson
// has sidenav-plus (the same click, a closer look); this one is about the screen as a whole.
import { PIECE_SIZE, snap } from '../../data/pieces'
import { setEditing } from '../../state/canvasView'
import { aim, camera, cursor, onStage, run, set, wait, type Scene } from '../director'
import { pazar, workspace, WID, P } from '../fixtures/pazar'

const PLUS = '[aria-label="Add to the canvas"]'
const PLANE_ROW = '[role="menu"] [data-key="plane"]'
// Pazar's pieces laid round a clear middle (smaller, whole, in view at 0.55): three above, three below, the middle
// free for the new plane, and room under it for its edit console.
const MID = { x: 0, y: 0 }
const LOOK = { ...MID, zoom: 0.55 }
const AROUND: Record<string, { x: number; y: number; w: number; h: number }> = {
  [P.lunch]: { x: -860, y: -510, w: 520, h: 170 },
  [P.product]: { x: -260, y: -510, w: 520, h: 170 },
  [P.matrix]: { x: 340, y: -510, w: 520, h: 170 },
  [P.deck]: { x: -860, y: 380, w: 520, h: 170 },
  [P.days]: { x: -260, y: 380, w: 520, h: 170 },
  [P.table]: { x: 340, y: 380, w: 520, h: 170 },
}
const pieces = pazar.pieces.filter((p) => AROUND[p.id]).map((p) => ({ ...p, ...AROUND[p.id] }))
const NEW = 'p-new'
const { w, h } = PIECE_SIZE.plane
const at = { x: snap(MID.x - w / 2), y: snap(MID.y - h / 2) }

const scene: Scene = {
  id: 'plus-adds-plane',
  fixture: { ...pazar, pieces, wid: WID, workspace },
  view: 'canvas',
  // Larger than 960 × 600 (still 16:10), so the whole `+` menu fits.
  size: [1056, 660],
  length: 5700,
  // The new plane in the middle, in edit mode, the cursor gone to rest.
  poster: 5650,
  cursor: onStage(620, 610),
  setup: [camera.set(LOOK.x, LOOK.y, LOOK.zoom)],
  steps: [
    { at: 300, do: cursor.to(PLUS, 1100) },
    { do: wait(400) },
    { do: cursor.press() },
    // The menu builds (320 ms); a moment to read it, then down to `plane`.
    { do: wait(750) },
    { do: cursor.to(aim(PLANE_ROW, 0.3, 0.5), 800) },
    { do: wait(400) },
    { do: cursor.press() },
    {
      do: set(
        (ws) => ({ ...ws, pieces: [...ws.pieces, { id: NEW, kind: 'plane', x: at.x, y: at.y, w, h, name: '', createdAt: Date.now(), updatedAt: Date.now() }] }),
        'the plane is made',
      ),
    },
    // It builds in, then edit mode: its handles and console.
    { do: wait(450) },
    { do: run(() => setEditing(NEW, true), 'in edit mode') },
    { do: wait(250) },
    { do: cursor.to(onStage(960, 330), 900) },
  ],
}
export default scene
