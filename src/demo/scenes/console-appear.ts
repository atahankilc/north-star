// `piece-console` page 1, "Every piece has a console" (onboarding-lessons.md §2): two planes on the canvas, no HUD. The
// hand comes onto the first: its console builds in its bottom-right corner (`focus`, `edit`, the comments inside); off
// it, the console goes; onto the second, its own builds there. All the real pointer's doing.
import { aim, camera, cursor, onStage, wait, type Scene } from '../director'
import { CLEAR, PLANE_E, bare, base, copy, piece, planeE, planeECards, planeEEdges } from '../fixtures/kit'

const OTHER = 'p-e2'
const other = piece(OTHER, { kind: 'plane', x: CLEAR.x + 600, y: CLEAR.y, w: 500, h: 325, name: '02 Product' })
const otherCards = [copy('f-pickup', OTHER, 25, 50), copy('f-counter', OTHER, 275, 50), copy('k-wolt', OTHER, 25, 200)]

const scene: Scene = {
  id: 'console-appear',
  fixture: { ...base, pieces: [...base.pieces, planeE(), other], cards: [...base.cards, ...planeECards, ...otherCards], edges: [...base.edges, ...planeEEdges] },
  view: 'canvas',
  size: [640, 400],
  length: 4600,
  poster: 1900,
  cursor: onStage(330, 380),
  setup: [bare('console-appear'), camera.set(CLEAR.x + 550, CLEAR.y + 175, 0.55)],
  steps: [
    { at: 300, do: cursor.to(aim(`[data-target="plane:${PLANE_E}"]`, 0.6, 0.55), 1000) },
    { do: wait(1100) },
    { do: cursor.to(aim(`[data-target="plane:${OTHER}"]`, 0.55, 0.6), 1100) },
    { do: wait(1100) },
  ],
}
export default scene
