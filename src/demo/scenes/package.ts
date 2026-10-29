// `package-made` (onboarding-lessons.md §3), "A package": 02 Product in focus, no HUD, three features selected, the
// `3 selected` panel open. The hand presses `package these 3`: a package forms round them (the blue frame, its band on
// top; shown with set()), the panel steps aside and the view takes in the package; the hand presses the band's `[−] 3`:
// it folds into one blue card of rows, a bar in each member's colour. What each would write shown with set().
import type { Card } from '../../data/cards'
import { useCanvasView } from '../../state/canvasView'
import { aim, camera, cursor, onStage, run, set, wait, type Scene } from '../director'
import { PLANE_K, byText, focusRoute, frameTo, moved, smallPlane } from '../fixtures/kit'
import { stage } from '../fixtures/o10'

const members = [moved('f-pickup', PLANE_K, 0, 75), moved('f-qr', PLANE_K, 0, 200), moved('f-counter', PLANE_K, 0, 325)]
const pkg: Card = { id: 'pk-launch', type: 'package', pieceId: PLANE_K, title: 'Launch at Factory', x: 0, y: 0, memberIds: members.map((m) => m.id) }
const PACK = byText('[data-learn="card-panel"] button', 'package these')
const FOLD = aim('[data-learn="package-band"] button', 0.5, 0.5)

const scene: Scene = {
  id: 'package',
  fixture: smallPlane(members),
  view: 'focus',
  route: focusRoute(),
  size: [640, 400],
  length: 6400,
  poster: 6300,
  cursor: onStage(150, 380),
  setup: [...stage('package'), run(() => useCanvasView.setState({ cardMulti: members.map((m) => m.id) }), 'three selected'), camera.frame({ x: -25, y: 50, w: 600, h: 400 }, 6)],
  steps: [
    { at: 300, do: cursor.to(PACK, 1000) },
    { do: wait(350) },
    { do: cursor.press() },
    {
      do: set((ws) => ({ ...ws, cards: [...ws.cards, pkg] }), 'the package forms'),
    },
    { do: run(() => useCanvasView.setState({ cardMulti: [], cardSelected: null }), 'the panel goes as the package forms') },
    { do: frameTo({ x: -50, y: -50, w: 400, h: 500 }, 700) },
    { do: wait(500) },
    { do: cursor.to(FOLD, 900) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: set((ws) => ({ ...ws, cards: ws.cards.map((c) => (c.id === pkg.id ? { ...c, folded: true } : c)) }), 'folded') },
    { do: frameTo({ x: -100, y: -50, w: 400, h: 275 }, 700) },
    { do: wait(400) },
  ],
}
export default scene
