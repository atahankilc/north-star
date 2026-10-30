// `side-view` page 2 (onboarding-lessons.md §7), "Yours": the side view open beside Pazar's first plane on the launch
// deck's board. The hand presses `MINE` in its corner: the board gives way to the tasks given to you, across decks, each
// with its deck and its day; then `ALL · DAYS`: every deck's tasks on days. All real: a tab writes nothing.
import { useCanvasView } from '../../state/canvasView'
import { useTasksSide } from '../../views/workspace/sideState'
import { camera, cursor, onStage, run, wait, type Scene } from '../director'
import { base, byText } from '../fixtures/kit'
import { P } from '../fixtures/pazar'

const MINE = byText('[data-learn="side-view"] [role="tab"]', 'mine', 0.4, 0.5)
const ALL = byText('[data-learn="side-view"] [role="tab"]', 'all', 0.4, 0.5)

const scene: Scene = {
  id: 'side-mine',
  fixture: base,
  view: 'canvas',
  size: [640, 400],
  length: 6000,
  poster: 5900,
  cursor: onStage(330, 330),
  setup: [run(() => useTasksSide.setState({ open: true, tab: P.deck, days: false, linked: null, taskFull: false }), 'the side view open'), run(() => useCanvasView.setState({ split: 0.42 }), 'its width'), camera.set(560, 360, 0.42)],
  steps: [
    { at: 300, do: cursor.to(MINE, 1100) },
    { do: wait(400) },
    { do: cursor.press() },
    { do: wait(1100) },
    { do: cursor.to(ALL, 700) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(900) },
    { do: cursor.to(onStage(600, 230), 700) },
  ],
}
export default scene
