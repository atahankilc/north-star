// `side-view` page 1 (onboarding-lessons.md §7), "Decks and days, beside you": 01 Lunch in focus, the HUD's side nav on
// the left. `t` is pressed (its key chip): the side view opens on the right, beside the plane, the launch deck's board in
// it under its tabs; the hand presses the deck's `[days ›]` in its dock: the deck's days come in (under 1300 px they open
// over the board, `‹ back to the board`). All real: opening it writes nothing.
import { useCanvasView } from '../../state/canvasView'
import { useTasksSide } from '../../views/workspace/sideState'
import { camera, cursor, key, onStage, run, wait, type Scene } from '../director'
import { base, byText } from '../fixtures/kit'
import { calmTasks } from '../fixtures/o12'
import { P, WID } from '../fixtures/pazar'
import { DEMO_DAY } from '../clock'

// Pazar's tasks a week later (no SOON band over the board), and yours spanning today into next week (not due this week,
// so not in SOON either), so the days show your row with its bar titled.
const DAY = 24 * 3600 * 1000
const day = (n: number) => new Date(DEMO_DAY + n * DAY).toISOString().slice(0, 10)
const tasks = calmTasks(base.tasks).map((t) =>
  t.id === 'tk-cutoff' ? { ...t, title: 'Order cut-off at 9 pm', start: day(-2), due: day(8) } : t.id === 'tk-counter' ? { ...t, title: 'Portion counter at 9 pm', start: day(-1), due: day(9) } : t,
)
const DAYS = byText('[data-learn="side-view"] button', 'days ›', 0.5, 0.5)

const scene: Scene = {
  id: 'side-view',
  fixture: { ...base, tasks },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.lunch}`,
  size: [640, 400],
  length: 5200,
  poster: 5100,
  cursor: onStage(200, 330),
  setup: [
    run(() => useTasksSide.setState({ open: false, tab: P.deck, days: false, linked: null, taskFull: false }), 'the side view shut'),
    run(() => useCanvasView.setState({ split: 0.42 }), 'its width'),
  ],
  steps: [
    // At 0, not in the setup: the side view the loop before left open, shut as it starts again, gives the plane back its
    // whole part (a refit as the stage settles), and this comes after it.
    { at: 0, do: camera.frame({ x: -20, y: -20, w: 1240, h: 765 }, 24) },
    { at: 500, do: key('t', 1200) },
    { at: 1900, do: cursor.to(DAYS, 1000) },
    { do: wait(400) },
    { do: cursor.press() },
    // Off the dock straight away (it lays out again as the days come), onto the days.
    { do: cursor.to(onStage(600, 330), 500) },
    { do: wait(1100) },
  ],
}
export default scene
