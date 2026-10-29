// The kind guide's `idea` row, in a plane (onboarding-lessons.md §2): a plane in focus with a problem on it, no HUD. An
// idea appears under it (shown with set()) and its `solves` link comes; then it's tested: what was learned comes in
// (evidence, shown with set()) and it moves from testing to validated.
import type { Evidence } from '../../data/evidence'
import { camera, set, wait, type Scene } from '../director'
import { AT, AWAY, PLANE_K, arrive, bare, base, focusRoute, moved, smallPlane } from '../fixtures/kit'

const idea = moved('i-forecast', PLANE_K, 125, 175, { validation: 'testing' })
const learned: Evidence = { id: 'v-f', nodeId: idea.id, nodeType: 'idea', kind: 'data', stance: 'supports', text: 'Waste fell from 6 to 1 portion a night with the 9 pm count', source: 'Pilot, 2 cooks', date: '2026-10-16', createdAt: AT }

const scene: Scene = {
  id: 'card-idea',
  fixture: smallPlane([moved('r-waste', PLANE_K, 125, 0)]),
  view: 'focus',
  route: focusRoute(),
  size: [480, 300],
  length: 3600,
  poster: 3500,
  cursor: AWAY,
  setup: [bare('card-idea'), camera.frame({ x: 50, y: -25, w: 350, h: 375 }, 12)],
  steps: [
    { at: 400, do: arrive(idea) },
    { at: 1200, do: set((ws) => ({ ...ws, edges: base.edges.filter((e) => e.id === 'e-5') }), 'it solves the problem') },
    { at: 2000, do: set((ws) => ({ ...ws, evidence: [learned] }), 'what the test taught') },
    { at: 2500, do: set((ws) => ({ ...ws, cards: ws.cards.map((c) => (c.id === idea.id ? { ...c, validation: 'validated' } : c)) }), 'validated') },
    { do: wait(1100) },
  ],
}
export default scene
