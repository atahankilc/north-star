// `side-view` "Yours", "Every deck on days" (lessons.ts, D-412): Tasks open beside the canvas, on `mine`: the tasks given
// to you, across decks. The hand presses `all · days`: every deck's tasks on days; then `mine` again. All real: a tab
// writes nothing.
import { usePlace } from '../../views/workspace/places/placeStore'
import { camera, cursor, onStage, run, wait, type Scene } from '../director'
import { base, byText } from '../fixtures/kit'

const MINE = byText('[data-learn="place-tasks"] [role="tab"]', 'mine', 0.4, 0.5)
const ALL = byText('[data-learn="place-tasks"] [role="tab"]', 'all', 0.4, 0.5)

const scene: Scene = {
  id: 'side-mine',
  fixture: base,
  view: 'canvas',
  size: [640, 400],
  length: 6000,
  poster: 5900,
  cursor: onStage(330, 330),
  setup: [run(() => usePlace.setState({ open: 'tasks', page: false }), 'Tasks open'), camera.set(560, 360, 0.42)],
  steps: [
    { at: 300, do: cursor.to(ALL, 1100) },
    { do: wait(400) },
    { do: cursor.press() },
    { do: wait(1100) },
    { do: cursor.to(MINE, 700) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(900) },
    { do: cursor.to(onStage(600, 230), 700) },
  ],
}
export default scene
