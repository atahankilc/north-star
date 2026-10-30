// `side-nav` page 4 (onboarding-lessons.md §1), "Decks and days": the side nav at the stage's left edge, the canvas
// beside it (it has a deck, so the side nav shows its tasks button, columns over a bar). The hand clicks it: the real
// side view opens on the right, the launch deck's board in it under its tabs, beside the canvas (nothing written).
import { useCanvasView } from '../../state/canvasView'
import { useTasksSide } from '../../views/workspace/sideState'
import { camera, cursor, onStage, run, wait, type Scene } from '../director'
import { sideOnly } from '../fixtures/o13'
import { base } from '../fixtures/kit'
import { calmTasks } from '../fixtures/o12'
import { P } from '../fixtures/pazar'

const TASKS = '[data-learn="tasks"]'

const scene: Scene = {
  id: 'sidenav-side',
  // A week on: nothing due this week, so no SOON band over the deck's columns (not what this is about).
  fixture: { ...base, tasks: calmTasks(base.tasks) },
  view: 'canvas',
  size: [640, 400],
  length: 4400,
  poster: 4300,
  cursor: onStage(90, 360),
  setup: [
    sideOnly('sidenav-side'),
    run(
      () =>
        useTasksSide.setState({
          open: false,
          tab: P.deck,
          days: false,
          linked: null,
          taskFull: false,
        }),
      'the side view shut',
    ),
    run(() => useCanvasView.setState({ split: 0.45 }), 'its width'),
    // The planes and the deck in view, the deck at the left, so the side view opening on the right leaves it seen.
    camera.set(900, 700, 0.2),
  ],
  steps: [
    { at: 400, do: cursor.to(TASKS, 1100) },
    { do: wait(450) },
    { do: cursor.press() },
    // Off the side nav, onto the deck's board in the side view.
    { do: wait(500) },
    { do: cursor.to(onStage(500, 250), 800) },
    { do: wait(900) },
  ],
}
export default scene
