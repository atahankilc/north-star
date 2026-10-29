// `stuck` page 1 (onboarding-lessons.md §2), "Linked to the plane": a plane with its features table stuck to its right
// edge, the plane in edit mode, no HUD. The hand moves the plane: the table comes with it (the real carry of what's stuck
// to it); let go, both land (what the drop would write shown with set()).
import { setEditing } from '../../state/canvasView'
import { aim, camera, cursor, onStage, run, set, wait, type Scene } from '../director'
import { CLEAR, PLANE_F, TABLE_F, bare, by, lensFixture } from '../fixtures/kit'

const P = `[data-target="plane:${PLANE_F}"]`
const GRAB = aim(P, 0.5, 0.45)
const MOVE = { x: 25, y: 75 }
const DONE = `${P} [role="toolbar"] button[aria-pressed="true"]`

const scene: Scene = {
  id: 'stick-follow',
  fixture: lensFixture(true, { w: 300 }),
  view: 'canvas',
  // A little larger than most (still 16:10): the plane's console in edit mode is wider than the plane at this zoom.
  size: [768, 480],
  length: 6400,
  poster: 6300,
  cursor: onStage(560, 390),
  setup: [bare('stick-follow'), camera.set(CLEAR.x + 359, CLEAR.y + 175, 0.74), run(() => setEditing(PLANE_F, true), 'in edit mode')],
  steps: [
    { at: 300, do: cursor.to(GRAB, 900) },
    { do: wait(350) },
    {
      do: cursor.drag(
        GRAB,
        by(GRAB, MOVE.x, MOVE.y),
        1700,
        set((ws) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === PLANE_F || p.id === TABLE_F ? { ...p, x: p.x + MOVE.x, y: p.y + MOVE.y } : p)) }), 'both land'),
      ),
    },
    { do: wait(400) },
    // `done` on the plane's console: edit mode ends; the table stays stuck where it came to.
    { do: cursor.to(DONE, 700) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(400) },
    { do: cursor.to(onStage(610, 60), 700) },
    { do: wait(500) },
  ],
}
export default scene
