// The kind guide's `plane` row (onboarding-lessons.md §2 `kind-guide`): a clear stretch of canvas, no HUD. A plane
// appears (what `+ → plane` makes, shown with set()), built cell by cell; then the chain lands in it a card at a time,
// customer, problem, idea, and the idea's `solves` link: a space for cards, linked.
import { camera, set, wait, type Scene } from '../director'
import { AWAY, CLEAR, bare, base, moved, piece } from '../fixtures/kit'

const PLANE = 'p-new'
const box = { x: CLEAR.x, y: CLEAR.y, w: 500, h: 325 }
const CARDS = [moved('c-office', PLANE, 25, 50), moved('r-greasy', PLANE, 275, 50), moved('i-preorder', PLANE, 275, 200)]
const PIECE = piece(PLANE, { kind: 'plane', ...box, name: '08 Breakfast' })
const LINKS = base.edges.filter((e) => e.id === 'e-1' || e.id === 'e-8')

const scene: Scene = {
  id: 'kind-plane',
  fixture: { ...base, edges: [] },
  view: 'canvas',
  size: [480, 300],
  length: 3600,
  poster: 3500,
  cursor: AWAY,
  setup: [bare('kind-plane'), camera.set(box.x + box.w / 2, box.y + box.h / 2 - 12, 0.8)],
  steps: [
    { at: 300, do: set((ws) => ({ ...ws, pieces: [...ws.pieces, PIECE] }), 'the plane appears') },
    { at: 1100, do: set((ws) => ({ ...ws, cards: [...ws.cards, CARDS[0]] }), 'a customer') },
    { at: 1600, do: set((ws) => ({ ...ws, cards: [...ws.cards, CARDS[1]], edges: [LINKS[1]] }), 'a problem') },
    { at: 2100, do: set((ws) => ({ ...ws, cards: [...ws.cards, CARDS[2]] }), 'an idea') },
    { at: 2600, do: set((ws) => ({ ...ws, edges: LINKS }), 'it solves the problem') },
    { do: wait(1000) },
  ],
}
export default scene
