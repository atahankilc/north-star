// `focus-plane` "Show only some" (lessons.ts, D-349): 01 Lunch in focus, no HUD, its problems and the ideas for
// them. The hand presses the dock's `[filter]`: its columns build over the dock (D-364); in SHOW, the real list of card
// types, it unticks ideas: the ideas go, the problems stay; SHOW's count turns magenta. All real: a filter writes
// nothing.
import { aim, camera, cursor, inFocus, key, wait, type Scene } from '../director'
import { PLANE_K, base, focusRoute, moved, smallPlane } from '../fixtures/kit'
import { stage } from '../fixtures/o10'

const cards = [
  moved('r-greasy', PLANE_K, 0, 0),
  moved('r-break', PLANE_K, 225, 0),
  moved('r-waste', PLANE_K, 450, 0),
  moved('i-preorder', PLANE_K, 0, 150),
  moved('i-forecast', PLANE_K, 450, 150),
  moved('i-shelf', PLANE_K, 225, 150),
]
const FILTER = aim('button[title="what this plane shows"]')
const IDEAS = aim('[data-learn="filter-strip"] [data-key="idea"]')

const scene: Scene = {
  id: 'plane-filter',
  fixture: smallPlane(cards, { edges: base.edges.filter((e) => e.id === 'e-1' || e.id === 'e-5') }),
  view: 'focus',
  route: focusRoute(),
  size: [640, 400],
  length: 5500,
  poster: 5400,
  cursor: inFocus(600, 60),
  setup: [...stage('plane-filter'), camera.frame({ x: -25, y: -25, w: 725, h: 430 }, 4)],
  steps: [
    { at: 300, do: cursor.to(FILTER, 900) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(700) },
    { do: cursor.to(IDEAS, 600) },
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
