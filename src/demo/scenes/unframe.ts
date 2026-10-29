// `unframe` (onboarding-lessons.md §2), "Framed or unframed": a features table on the canvas in edit mode, its console
// `EDIT … unframe … done`, no HUD. The hand presses `unframe`: the window breaks cell by cell while the table grows from
// fitted in it to its own size, lying on the canvas (the `open` it would write shown with set() at the press).
import { setEditing } from '../../state/canvasView'
import { camera, cursor, onStage, run, set, wait, type Scene } from '../director'
import { CLEAR, PLANE_F, TABLE_F, bare, lensFixture } from '../fixtures/kit'

const UNFRAME = `[data-target="plane:${TABLE_F}"] [data-learn="console-unframe"]`

const scene: Scene = {
  id: 'unframe',
  // The table alone in view (its plane left out, its rows still the plane's features).
  fixture: { ...lensFixture(false), pieces: lensFixture(false).pieces.filter((p) => p.id !== PLANE_F) },
  view: 'canvas',
  // A little larger than most (still 16:10): its console in edit mode is wider than the table, the unframed table wider
  // than the window was, and both should be in view.
  size: [768, 480],
  length: 4300,
  poster: 4200,
  cursor: onStage(420, 380),
  setup: [bare('unframe'), camera.set(CLEAR.x + 990, CLEAR.y + 190, 0.85), run(() => setEditing(TABLE_F, true), 'in edit mode')],
  steps: [
    { at: 400, do: cursor.to(UNFRAME, 1000) },
    { do: wait(400) },
    { do: cursor.press() },
    { do: set((ws) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === TABLE_F ? { ...p, open: true } : p)) }), 'unframed') },
    { do: wait(800) },
    { do: cursor.to(onStage(600, 60), 900) },
    { do: wait(600) },
  ],
}
export default scene
