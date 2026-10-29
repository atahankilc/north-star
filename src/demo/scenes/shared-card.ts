// `brought` page 1 (onboarding-lessons.md §3), "The same card, twice": 02 Product in focus, no HUD, Lunch's pre-order
// idea brought here beside the feature it inspired, `⧉ 2` on it. The view closes in on the idea and the hand rests on
// its `⧉ 2`; the view goes back out and the hand clicks the idea: its panel builds, and its PLANES section says where it
// is: 01 Lunch and 02 Product. All real.
import type { Place } from '../../data/places'
import { aim, cursor, inFocus, wait, type Scene } from '../director'
import { AT, base, focusRoute, moved, piece } from '../fixtures/kit'
import { P } from '../fixtures/pazar'
import { closeIn, inSection, scrollPanel, stage, view } from '../fixtures/o10'

const place: Place = { id: `${P.product}_i-preorder`, planeId: P.product, cardId: 'i-preorder', type: 'idea', x: 0, y: 200, createdAt: AT }
const lunch = piece(P.lunch, { kind: 'plane', x: 0, y: 0, w: 1000, h: 600, name: '01 Lunch' })
const product = piece(P.product, { kind: 'plane', x: 1100, y: 0, w: 1000, h: 600, name: '02 Product' })
const CARD = '[data-target="card:i-preorder"]'

const scene: Scene = {
  id: 'shared-card',
  fixture: {
    ...base,
    pieces: [lunch, product],
    cards: [moved('i-preorder', P.lunch, 0, 0), moved('f-pickup', P.product, 0, 25)],
    edges: base.edges.filter((e) => e.id === 'e-14'),
    places: [place],
    tasks: [],
  },
  view: 'focus',
  route: focusRoute(P.product),
  size: [640, 400],
  length: 7700,
  poster: 7600,
  cursor: inFocus(160, 470),
  setup: [...stage('shared-card'), view(0.8, 16, 20)],
  steps: [
    // The view closes in on the idea, so its `⧉ 2` reads; the hand rests on it; the view goes back out, the hand clicks.
    { at: 200, do: closeIn({ x: -10, y: 190, w: 220, h: 120 }, 700, 40, 2.2) },
    { do: cursor.to(aim(`${CARD} [title^="On 2 planes"]`, 0.5, 0.5), 800) },
    { do: wait(600) },
    { do: closeIn({ x: -20, y: -25, w: 800, h: 500 }, 600, 0) },
    { do: cursor.to(aim(CARD, 0.5, 0.5), 450) },
    { do: wait(100) },
    { do: cursor.press() },
    { do: wait(800) },
    { do: cursor.to((c) => ({ x: 400 * c.scale, y: 300 * c.scale }), 500) },
    { do: scrollPanel('#planes', 900) },
    { do: wait(100) },
    { do: cursor.to(inSection('planes', 'Lunch'), 600) },
    { do: wait(400) },
  ],
}
export default scene
