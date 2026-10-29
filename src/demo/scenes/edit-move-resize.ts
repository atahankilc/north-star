// `piece-made` page 1, "It's in edit mode" (onboarding-lessons.md §2): a new plane on the canvas in edit mode, no HUD.
// The hand takes it by its middle and moves it (the real carry at 0.8, the landing L's where it'll land), lets go;
// then takes its bottom-right corner handle and pulls it bigger (the edges lit, the size shown). What each would write
// shown with set() at the drop.
import { setEditing } from '../../state/canvasView'
import { aim, camera, cursor, onStage, run, set, wait, type Scene } from '../director'
import { CLEAR, PLANE_E, bare, base, by, planeE, planeECards, planeEEdges } from '../fixtures/kit'

const P = `[data-target="plane:${PLANE_E}"]`
const MID = aim(P, 0.5, 0.62)
const CORNER = aim(`${P} [data-h="se"]`)
const MOVE = { x: 75, y: 50 }
const GROW = { w: 100, h: 50 }

const scene: Scene = {
  id: 'edit-move-resize',
  fixture: { ...base, pieces: [...base.pieces, planeE()], cards: [...base.cards, ...planeECards], edges: [...base.edges, ...planeEEdges] },
  view: 'canvas',
  // A little larger than most (still 16:10): the plane, moved and grown, and its edit console all in view.
  size: [768, 480],
  length: 6600,
  poster: 6200,
  cursor: onStage(560, 380),
  setup: [bare('edit-move-resize'), camera.set(CLEAR.x + 305, CLEAR.y + 237, 0.8), run(() => setEditing(PLANE_E, true), 'in edit mode')],
  steps: [
    { at: 300, do: cursor.to(MID, 900) },
    { do: wait(350) },
    { do: cursor.drag(MID, by(MID, MOVE.x, MOVE.y), 1400, set((ws) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === PLANE_E ? { ...p, x: p.x + MOVE.x, y: p.y + MOVE.y } : p)) }), 'it lands')) },
    { do: wait(400) },
    { do: cursor.to(CORNER, 800) },
    { do: wait(350) },
    { do: cursor.drag(CORNER, by(CORNER, GROW.w, GROW.h), 1200, set((ws) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === PLANE_E ? { ...p, w: p.w + GROW.w, h: p.h + GROW.h } : p)) }), 'resized')) },
    { do: wait(300) },
    { do: cursor.to(onStage(600, 390), 500) },
  ],
}
export default scene
