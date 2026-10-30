// `doc-place` (onboarding-lessons.md §6), "On the canvas": "Interviews: Kreuzberg offices" placed on the canvas, a window
// anyone here can read (its text cut by the window's foot, faded), in edit mode, no HUD. The hand presses `unframe` in
// its console: the window breaks cell by cell and the whole document lies open on the canvas at its own length (the
// `open` it would write shown with set() at the press); the canvas glides down along it.
import { setEditing } from '../../state/canvasView'
import { camera, cursor, onStage, run, set, wait, type Scene } from '../director'
import { CLEAR, base, piece } from '../fixtures/kit'
import { DOC_TEXTS, NO_HUD, docText, glideTo, pageStyle } from '../fixtures/o12'

const DOC = 'dp-interviews'
const doc = piece(DOC, { kind: 'document', docId: 'doc-interviews', x: CLEAR.x, y: CLEAR.y, w: 600, h: 375, name: '08 Interviews' })
const UNFRAME = `[data-target="plane:${DOC}"] [data-learn="console-unframe"]`

const scene: Scene = {
  id: 'doc-place',
  fixture: { ...base, pieces: [...base.pieces, doc] },
  view: 'canvas',
  size: [640, 400],
  length: 5800,
  poster: 5700,
  cursor: onStage(420, 360),
  setup: [pageStyle('doc-place', NO_HUD), docText(DOC_TEXTS), camera.set(CLEAR.x + 270, CLEAR.y + 215, 0.75), run(() => setEditing(DOC, true), 'in edit mode')],
  steps: [
    { at: 400, do: cursor.to(UNFRAME, 1000) },
    { do: wait(400) },
    { do: cursor.press() },
    { do: set((ws) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === DOC ? { ...p, open: true } : p)) }), 'unframed') },
    { do: wait(900) },
    { do: cursor.to(onStage(600, 120), 800) },
    { do: glideTo(CLEAR.x + 270, CLEAR.y + 470, 0.75, 1400) },
    { do: wait(300) },
  ],
}
export default scene
