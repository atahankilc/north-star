// `card-panel` "Who it's for", `link-made` "Shown when it matters" (lessons.ts, D-349): 01 Lunch in focus, no HUD, two customers and the problems
// tagged for them. The hand presses the dock's `[filter]`: its columns build over the dock (D-364); in FOR, the real
// list of the plane's customers, it ticks Office workers: only their problems stay; FOR's count turns magenta. All real:
// a filter writes nothing.
import { aim, camera, cursor, inFocus, key, wait, type Scene } from '../director'
import { PLANE_K, base, focusRoute, moved, smallPlane } from '../fixtures/kit'
import { row, stage } from '../fixtures/o10'

const cards = [
  moved('c-office', PLANE_K, 100, 0),
  moved('c-cooks', PLANE_K, 450, 0),
  moved('r-greasy', PLANE_K, 0, 150),
  moved('r-break', PLANE_K, 225, 150),
  moved('r-permit', PLANE_K, 450, 150),
  moved('r-waste', PLANE_K, 0, 300),
  moved('r-meetings', PLANE_K, 225, 300),
]
const FILTER = aim('button[title="what this plane shows"]')
const OFFICE = row('Office workers')

const scene: Scene = {
  id: 'for-filter',
  fixture: smallPlane(cards, { edges: base.edges.filter((e) => e.kind === 'for') }),
  view: 'focus',
  route: focusRoute(),
  size: [640, 400],
  length: 5500,
  poster: 5400,
  cursor: inFocus(600, 120),
  setup: [...stage('for-filter'), camera.frame({ x: -25, y: -25, w: 725, h: 560 }, 4)],
  steps: [
    { at: 300, do: cursor.to(FILTER, 900) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(700) },
    { do: cursor.to(OFFICE, 600) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(700) },
    // The drawer closed: what's left on the plane.
    { do: key('Esc') },
    { do: cursor.to(inFocus(640, 330), 700) },
    { do: wait(300) },
  ],
}
export default scene
