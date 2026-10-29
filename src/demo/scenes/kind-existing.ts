// The kind guide's `existing card…` row, in a plane (onboarding-lessons.md §2): 02 Product in focus, no HUD. A
// right-click on empty plane, top left: the real menu; `exi` typed narrows it to `existing card…`, a click on it: it
// turns into the list of cards from other planes; `lun` typed narrows it to Lunch's pre-order idea; a click on it
// brings it where the right-click was (a place of its own on this plane, shown with set()): the same card, `⧉ 2` on it,
// and the feature's link to it shows. Held on `⧉ 2`. Clicks, not the menu's letter and Enter: those keys are lost when
// the scene plays in the coach's frame.
import type { Place } from '../../data/places'
import { aim, camera, cursor, inFocus, onStage, set, wait, type Scene } from '../director'
import { AT, bare, base, focusRoute, moved, piece, rightClick, shutPanelOnPick, type } from '../fixtures/kit'
import { P } from '../fixtures/pazar'

const SPOT = { x: 0, y: 0 }
const place: Place = { id: `${P.product}_i-preorder`, planeId: P.product, cardId: 'i-preorder', type: 'idea', ...SPOT, createdAt: AT }
const lunch = piece(P.lunch, { kind: 'plane', x: 0, y: 0, w: 1000, h: 600, name: '01 Lunch' })
const product = piece(P.product, { kind: 'plane', x: 1100, y: 0, w: 1000, h: 600, name: '02 Product' })
const AT_CLICK = inFocus(SPOT.x + 40, SPOT.y + 30)
const EXISTING = '[role="menu"] [data-key="existing"]'
const ROW = '[role="menu"] [data-key="i-preorder"]'

const scene: Scene = {
  id: 'kind-existing',
  fixture: {
    ...base,
    pieces: [lunch, product],
    cards: [moved('i-preorder', P.lunch, 0, 0), moved('f-pickup', P.product, 275, 0), moved('f-counter', P.product, 275, 150)],
    edges: base.edges.filter((e) => e.id === 'e-14'),
    tasks: [],
  },
  view: 'focus',
  route: focusRoute(P.product),
  size: [640, 400],
  length: 7600,
  poster: 7500,
  cursor: onStage(560, 330),
  setup: [bare('kind-existing'), camera.frame({ x: -25, y: -25, w: 525, h: 300 }, 30)],
  steps: [
    { at: 300, do: cursor.to(AT_CLICK, 700) },
    { do: wait(300) },
    { do: rightClick(AT_CLICK) },
    { do: wait(500) },
    // `exi` typed narrows the menu to `existing card…` (its row is last, under the list's fold); a click takes it.
    ...type('exi', 150),
    { do: wait(300) },
    { do: cursor.to(aim(EXISTING, 0.3, 0.5), 700) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(450) },
    ...type('lun', 150),
    { do: wait(350) },
    // Brought, it's selected and its panel would cover the slot: shut as it's selected, before it's drawn (as Enter
    // leaves a card just named, D-250), so the card and its `⧉ 2` read.
    { do: shutPanelOnPick('i-preorder') },
    { do: cursor.to(aim(ROW, 0.3, 0.5), 600) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: set((ws) => ({ ...ws, places: [place] }), 'brought here') },
    { do: wait(300) },
    { do: cursor.to(onStage(600, 60), 500) },
    { do: wait(700) },
  ],
}
export default scene
