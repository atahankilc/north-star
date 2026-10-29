// `move-canvas` page 1 (onboarding-lessons.md §2), "Move or share a piece": a plane on the canvas in edit mode, a second
// canvas `Launch week` in the workspace, no HUD. The hand presses `also on…`: the real prompt lists the canvases; it
// picks `Launch week`: the same plane is now on both; out of edit mode its name and console say `⧉ 2` (what it
// would write shown with set()).
import { setEditing } from '../../state/canvasView'
import { MAIN } from '../../data/canvases'
import { aim, camera, cursor, onStage, run, set, wait, type Scene } from '../director'
import { AT, CLEAR, PLANE_E, bare, base, byText, planeE, planeECards, planeEEdges } from '../fixtures/kit'

const LAUNCH = 'c-launch'
const DONE = `[data-target="plane:${PLANE_E}"] [role="toolbar"] button[aria-pressed="true"]`
const ALSO = byText(`[data-target="plane:${PLANE_E}"] button`, 'also on')
const ROW = aim(`[data-learn="prompt"] [data-key="${LAUNCH}"]`, 0.3, 0.5)

const scene: Scene = {
  id: 'canvases-share',
  fixture: {
    ...base,
    canvases: [...base.canvases, { id: LAUNCH, name: 'Launch week', order: 1, createdAt: AT }],
    pieces: [...base.pieces, planeE()],
    cards: [...base.cards, ...planeECards],
    edges: [...base.edges, ...planeEEdges],
  },
  view: 'canvas',
  size: [640, 400],
  length: 7300,
  poster: 7200,
  cursor: onStage(560, 380),
  setup: [bare('canvases-share'), camera.set(CLEAR.x + 230, CLEAR.y + 190, 0.8), run(() => setEditing(PLANE_E, true), 'in edit mode')],
  steps: [
    { at: 300, do: cursor.to(ALSO, 1000) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(800) },
    { do: cursor.to(ROW, 800) },
    { do: wait(350) },
    { do: cursor.press() },
    {
      do: set(
        (ws) => ({
          ...ws,
          spots: [{ id: `${LAUNCH}_${PLANE_E}`, canvasId: LAUNCH, pieceId: PLANE_E, x: 0, y: 0, createdAt: AT }],
          pieces: ws.pieces.map((p) => (p.id === PLANE_E ? { ...p, canvases: [MAIN, LAUNCH] } : p)),
        }),
        'on both canvases',
      ),
    },
    // `done` on its console; the hand over it: its name and its console both say `⧉ 2`.
    { do: wait(500) },
    { do: cursor.to(DONE, 700) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(300) },
    { do: cursor.to(onStage(420, 200), 600) },
    { do: wait(800) },
  ],
}
export default scene
