// `card-made` page 3, "Link it" (onboarding-lessons.md §3): 01 Lunch in focus, no HUD, an idea and a problem. The hand
// comes over the idea: its `›` shows at its right edge; it takes the `›` and drags it onto the problem (the line follows
// the hand, the problem lit as the target), lets go: the link lands as `solves` (the idea → problem default), selected,
// its bar under it with the label ready; a short label typed, Enter. What the drop and the label would write shown with
// set().
import type { Edge } from '../../data/edges'
import { aim, camera, cursor, inFocus, key, set, wait, type Scene } from '../director'
import { PLANE_K, focusRoute, moved, smallPlane, type } from '../fixtures/kit'
import { linkLands, stage } from '../fixtures/o10'

const idea = moved('i-preorder', PLANE_K, 150, 250)
const problem = moved('r-break', PLANE_K, 150, 0)
const IDEA = `[data-target="card:${idea.id}"]`
const PROBLEM = `[data-target="card:${problem.id}"]`
const HANDLE = aim(`${IDEA} [aria-label="Drag to another card to link"]`, 0.6, 0.5)
const link: Edge = { id: 'ld-1', fromId: idea.id, fromType: 'idea', toId: problem.id, toType: 'problem', kind: 'solves' }
const LABEL = 'no queue'

const scene: Scene = {
  id: 'link-draw',
  fixture: smallPlane([idea, problem]),
  view: 'focus',
  route: focusRoute(),
  size: [480, 300],
  length: 6400,
  poster: 6300,
  cursor: inFocus(470, 330),
  setup: [...stage('link-draw'), camera.frame({ x: 25, y: -15, w: 450, h: 400 }, 6)],
  steps: [
    { at: 300, do: cursor.to(aim(IDEA, 0.55, 0.6), 800) },
    { do: wait(450) },
    { do: cursor.to(HANDLE, 450) },
    { do: wait(350) },
    { do: cursor.drag(HANDLE, aim(PROBLEM, 0.4, 0.55), 1500, linkLands(link)) },
    { do: wait(500) },
    ...type(LABEL, 110),
    { do: wait(300) },
    { do: key('↵') },
    { do: set((ws) => ({ ...ws, edges: ws.edges.map((e) => (e.id === link.id ? { ...e, label: LABEL } : e)) }), 'labelled') },
    { do: wait(400) },
  ],
}
export default scene
