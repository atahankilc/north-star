// `link-made` (onboarding-lessons.md §3), "What does it mean?": 02 Product in focus, no HUD, a feature over a problem
// with an `inspired by` link between them. The hand clicks the link's chip: it's selected, its bar under it; it opens
// the kind (`inspired by ▾`), the real list of kinds builds, `so` typed narrows it to `solves`, a click takes it: the
// line turns the colour of solving and says so. What the kind would write shown with set().
import type { Edge } from '../../data/edges'
import { aim, camera, cursor, inFocus, set, wait, type Scene } from '../director'
import { PLANE_K, byText, focusRoute, moved, smallPlane, type } from '../fixtures/kit'
import { stage } from '../fixtures/o10'

const feature = moved('f-allergens', PLANE_K, 150, 0)
const problem = moved('r-allergy', PLANE_K, 150, 225)
const link: Edge = { id: 'lb-1', fromId: feature.id, fromType: 'feature', toId: problem.id, toType: 'problem', kind: 'inspired-by' }
const CHIP = `[data-target="link:${link.id}"]`
const KIND = byText('[data-learn="link-bar"] button', 'inspired by')

const scene: Scene = {
  id: 'link-bar',
  fixture: smallPlane([feature, problem], { edges: [link] }),
  view: 'focus',
  route: focusRoute(),
  size: [480, 300],
  length: 6800,
  poster: 6700,
  cursor: inFocus(470, 320),
  setup: [...stage('link-bar'), camera.frame({ x: 25, y: -15, w: 450, h: 365 }, 6)],
  steps: [
    { at: 300, do: cursor.to(CHIP, 900) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(700) },
    { do: cursor.to(KIND, 700) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(700) },
    // Its `>` line narrows the kinds as it's typed (D-222).
    ...type('so', 220),
    { do: wait(500) },
    { do: cursor.to(aim('[role="listbox"] [role="option"]', 0.3, 0.5), 600) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: set((ws) => ({ ...ws, edges: ws.edges.map((e) => (e.id === link.id ? { ...e, kind: 'solves' } : e)) }), 'it solves') },
    { do: wait(400) },
  ],
}
export default scene
