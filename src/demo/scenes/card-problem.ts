// The kind guide's `problem` row, in a plane (onboarding-lessons.md §2): a plane in focus, no HUD. A problem card
// appears as a hypothesis (shown with set()); it moves to testing, and evidence comes in, two for it and one against,
// counted on the card: `testing +2 −1`, the `!` saying they disagree.
import type { Evidence } from '../../data/evidence'
import { camera, set, wait, type Scene } from '../director'
import { AT, AWAY, PLANE_K, arrive, bare, focusRoute, moved, smallPlane } from '../fixtures/kit'

const card = moved('r-same', PLANE_K, 150, 100, { validation: 'hypothesis' })
const ev = (id: string, stance: Evidence['stance'], text: string): Evidence => ({ id, nodeId: card.id, nodeType: 'problem', kind: 'interview', stance, text, source: 'Lunch-break interviews', date: '2026-10-12', createdAt: AT })
const EV = [ev('v-a', 'supports', '7 of 9 eat the same canteen dish twice a week'), ev('v-b', 'supports', 'The canteen menu repeats every Monday'), ev('v-c', 'contradicts', 'Two said they like knowing what’s coming')]

const scene: Scene = {
  id: 'card-problem',
  fixture: smallPlane([]),
  view: 'focus',
  route: focusRoute(),
  size: [480, 300],
  length: 3600,
  poster: 3500,
  cursor: AWAY,
  setup: [bare('card-problem'), camera.frame({ x: 75, y: 50, w: 350, h: 200 }, 16)],
  steps: [
    { at: 400, do: arrive(card) },
    { at: 1300, do: set((ws) => ({ ...ws, cards: ws.cards.map((c) => (c.id === card.id ? { ...c, validation: 'testing' } : c)) }), 'testing') },
    ...EV.map((e, i) => ({ at: 1900 + i * 450, do: set((ws) => ({ ...ws, evidence: [...ws.evidence, e] }), `evidence ${i + 1}`) })),
    { at: 1900 + EV.length * 450, do: wait(250) },
  ],
}
export default scene
