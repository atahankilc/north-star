// `focus-plane` page 1 (onboarding-lessons.md §2), "You're inside the plane": 01 Lunch (its customers and problems) in focus, no HUD, its dock at the
// bottom. The hand drags across an empty stretch of the plane: the view moves with it, a little; then a right-click on
// empty plane, up and left, where the real menu has room to build with the card types to add here.
import { camera, cursor, inFocus, onStage, wait, type Ctx, type Scene } from '../director'
import { PLANE_K, bare, base, focusRoute, moved, rightClick, smallPlane } from '../fixtures/kit'

// A row of Lunch's customers and problems along the top, the `for` links hidden as they start; empty plane below, high
// enough on the stage for the whole right-click menu above the dock.
const cards = [moved('c-office', PLANE_K, 0, 0), moved('c-cooks', PLANE_K, 225, 0), moved('r-greasy', PLANE_K, 450, 0), moved('r-break', PLANE_K, 675, 0)]

// Empty plane under the problems (plane px).
const GRAB = inFocus(600, 200)
const PAN = { x: 50, y: -40 }
const dropAt = (c: Ctx) => {
  const a = GRAB(c)
  return a ? { x: a.x + PAN.x * c.scale, y: a.y + PAN.y * c.scale } : null
}
const MENU_AT = inFocus(120, 150)

const scene: Scene = {
  id: 'plane-inside',
  fixture: smallPlane(cards, { edges: base.edges.filter((e) => e.kind === 'for') }),
  view: 'focus',
  route: focusRoute(),
  size: [640, 400],
  length: 5600,
  poster: 5500,
  cursor: onStage(600, 230),
  setup: [bare('plane-inside'), camera.frame({ x: -25, y: -25, w: 925, h: 500 }, 16)],
  steps: [
    { at: 300, do: cursor.to(GRAB, 900) },
    { do: wait(300) },
    { do: cursor.drag(GRAB, dropAt, 1100) },
    { do: wait(400) },
    { do: cursor.to(MENU_AT, 800) },
    { do: wait(350) },
    { do: rightClick(MENU_AT) },
    { do: wait(1300) },
  ],
}
export default scene
