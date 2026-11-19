// `deck` "Tasks beside you", `side-view` "Tasks, beside you" (lessons.ts, D-412): 01 Lunch in focus. `t` is pressed (its
// key chip): Tasks opens beside the canvas on the left, on `mine`; the hand presses the launch deck's tab: its board
// under it. All real: opening it writes nothing.
import { usePlace } from '../../views/workspace/places/placeStore'
import { camera, cursor, key, onStage, run, wait, type Scene } from '../director'
import { base, byText } from '../fixtures/kit'
import { calmTasks } from '../fixtures/o12'
import { P, WID } from '../fixtures/pazar'
import { DEMO_DAY } from '../clock'
import { DAY } from '../time'

// Pazar's tasks a week later (no SOON band over the board), and yours spanning today into next week (not due this week,
// so not in SOON either), so the days show your row with its bar titled.
const day = (n: number) => new Date(DEMO_DAY + n * DAY).toISOString().slice(0, 10)
const tasks = calmTasks(base.tasks).map((t) =>
  t.id === 'tk-cutoff' ? { ...t, title: 'Order cut-off at 9 pm', start: day(-2), due: day(8) } : t.id === 'tk-counter' ? { ...t, title: 'Portion counter at 9 pm', start: day(-1), due: day(9) } : t,
)
const DECK = byText('[data-learn="place-tasks"] [role="tab"]', '01', 0.5, 0.5)

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
    run(() => usePlace.setState({ open: null, page: false }), 'Tasks shut'),
  ],
  steps: [
    { at: 0, do: camera.frame({ x: -20, y: -20, w: 1240, h: 765 }, 24) },
    { at: 500, do: key('t', 1200) },
    { at: 1900, do: cursor.to(DECK, 1000) },
    { do: wait(400) },
    { do: cursor.press() },
    { do: cursor.to(onStage(560, 330), 500) },
    { do: wait(1100) },
  ],
}
export default scene
