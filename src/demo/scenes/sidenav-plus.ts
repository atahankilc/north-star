// The side nav's `+` (onboarding-lessons.md `side-nav` page 1): the side nav at the stage's left edge, the canvas
// beside it. The cursor clicks the real `+`, the real menu builds cell by cell (the whole of it: this scene is authored
// on a larger stage, still 16:10, so the menu fits), the cursor goes down to `plane` and clicks; the menu closes (its
// own) and a plane appears in the middle of the screen (what addPiece would have written, shown with set()), then goes
// into edit mode (the real setEditing), as `+` leaves a new piece.
import { PIECE_SIZE } from '../../data/pieces'
import { setEditing } from '../../state/canvasView'
import { aim, camera, cursor, onStage, run, set, wait, type Scene } from '../director'
import { pazar, workspace, WID } from '../fixtures/pazar'

const PLUS = '[aria-label="Add to the canvas"]'
const PLANE_ROW = '[role="menu"] [data-key="plane"]'
// The camera on the matrix and the table (names and all), the clear stretch right of them where the new plane goes: the
// nearest clear spot to the middle of the screen, as addPiece finds it when the middle is taken.
const NEW = 'p-new'
const at = { x: 3600, y: 300 }
const LOOK = { x: 3500, y: 600, zoom: 0.47 }

const scene: Scene = {
  id: 'sidenav-plus',
  fixture: { ...pazar, wid: WID, workspace },
  view: 'canvas',
  size: [1056, 660],
  length: 5600,
  // The new plane in edit mode, the cursor gone to rest.
  poster: 5550,
  cursor: onStage(640, 560),
  setup: [camera.set(LOOK.x, LOOK.y, LOOK.zoom)],
  steps: [
    { at: 300, do: cursor.to(PLUS, 1000) },
    { do: wait(350) },
    { do: cursor.press() },
    // The menu builds (320 ms); a moment to read it, then down to `plane`.
    { do: wait(700) },
    { do: cursor.to(aim(PLANE_ROW, 0.3, 0.5), 800) },
    { do: wait(350) },
    { do: cursor.press() },
    {
      do: set(
        (ws) => ({
          ...ws,
          pieces: [...ws.pieces, { id: NEW, kind: 'plane', x: at.x, y: at.y, w: PIECE_SIZE.plane.w, h: PIECE_SIZE.plane.h, name: '', createdAt: Date.now(), updatedAt: Date.now() }],
        }),
        'the plane is made',
      ),
    },
    // It builds in, then edit mode: its handles and console.
    { do: wait(450) },
    { do: run(() => setEditing(NEW, true), 'in edit mode') },
    { do: wait(300) },
    { do: cursor.to(onStage(820, 590), 900) },
  ],
}
export default scene
