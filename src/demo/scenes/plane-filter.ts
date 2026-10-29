// `plane-filter` (onboarding-lessons.md §3), "Filters pass": 01 Lunch in focus, no HUD, its problems and the ideas for
// them. The hand presses the dock's `[filter]`: the strip builds over the dock; it opens SHOW, the real list of card
// types, and unticks ideas: the ideas go, the problems stay; SHOW's swatch for ideas goes dark. All real: a filter writes
// nothing.
import { aim, camera, cursor, inFocus, key, wait, type Scene } from '../director'
import { PLANE_K, base, byText, focusRoute, moved, smallPlane } from '../fixtures/kit'
import { row, stage } from '../fixtures/o10'

const cards = [
  moved('r-greasy', PLANE_K, 0, 0),
  moved('r-break', PLANE_K, 225, 0),
  moved('r-waste', PLANE_K, 450, 0),
  moved('i-preorder', PLANE_K, 0, 150),
  moved('i-forecast', PLANE_K, 450, 150),
  moved('i-shelf', PLANE_K, 225, 150),
]
const FILTER = aim('button[title="what this plane shows"]')
const SHOW = byText('[data-learn="filter-strip"] button', 'show')
const IDEAS = row('ideas')

const scene: Scene = {
  id: 'plane-filter',
  fixture: smallPlane(cards, { edges: base.edges.filter((e) => e.id === 'e-1' || e.id === 'e-5') }),
  view: 'focus',
  route: focusRoute(),
  size: [640, 400],
  length: 7400,
  poster: 7300,
  cursor: inFocus(600, 60),
  setup: [...stage('plane-filter'), camera.frame({ x: -25, y: -25, w: 725, h: 430 }, 4)],
  steps: [
    { at: 300, do: cursor.to(FILTER, 900) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(700) },
    { do: cursor.to(SHOW, 600) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(700) },
    { do: cursor.to(IDEAS, 600) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(700) },
    // The list closed: what's left on the plane.
    { do: key('Esc') },
    { do: cursor.to(inFocus(640, 330), 700) },
    { do: wait(300) },
  ],
}
export default scene
