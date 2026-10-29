// The welcome's second page (onboarding-lessons.md §1 `welcome` page 2, "Pieces hold the work"): a plane in focus with
// a table stuck to it open beside it (the real split, `beside=`). The plane's cards arrive in the chain's order, top to
// bottom: customers, problems, a competitor, ideas, two features, each row's links drawn as it lands; the table beside
// reads the plane's features, so its rows fill as they arrive. Then the person adds the last feature (the side nav's `+`,
// the real menu of card types, `feature`): it lands on the plane, its row appears in the table, and the cursor goes to
// it. The cards are written with set(), at the moment each would land (the demo writes nothing).
import type { Card } from '../../data/cards'
import type { Edge } from '../../data/edges'
import type { Piece } from '../../data/model'
import type { WithId } from '../../data/hooks'
import type { TableSetup } from '../../data/table'
import { planeArea, useCanvasView } from '../../state/canvasView'
import { aim, camera, cursor, inFocus, run, set, wait, type Ctx, type Pt, type Scene, type Step } from '../director'
import { pazar, workspace, WID, cards as all, edges as links } from '../fixtures/pazar'

const PLANE = 'p-tour'
const TABLE = 't-tour'
const AT = workspace.createdAt

// The chain, one row each (x, y in the plane): who, what hurts them, who's there already, what we'd do, what we'd build.
const ROWS: { ids: string[]; y: number }[] = [
  { ids: ['c-office', 'c-cooks'], y: 0 },
  { ids: ['r-greasy', 'r-break', 'r-waste'], y: 150 },
  { ids: ['k-wolt'], y: 300 },
  { ids: ['i-preorder', 'i-forecast'], y: 450 },
  { ids: ['f-pickup', 'f-counter', 'f-allergens'], y: 600 },
]
const X = [0, 225, 450]
const COMPETITOR_X = 450

const placed = (id: string, row: number, i: number): Card => {
  const c = all.find((x) => x.id === id)!
  return { ...c, pieceId: PLANE, x: c.type === 'competitor' ? COMPETITOR_X : X[i], y: ROWS[row].y }
}
const CARDS = ROWS.map((r, row) => r.ids.map((id, i) => placed(id, row, i)))
const IDS = new Set(ROWS.flatMap((r) => r.ids))
// The links among them that the plane shows (the `for` and `competes` kinds are hidden until a card is picked).
const LINKS: Edge[] = [
  ...links.filter((e) => IDS.has(e.fromId) && IDS.has(e.toId) && (e.kind === 'solves' || e.kind === 'inspired-by')),
  { id: 'e-t1', fromId: 'f-allergens', fromType: 'feature', toId: 'i-preorder', toType: 'idea', kind: 'inspired-by' },
]

const table: TableSetup = {
  rows: { rules: [{ field: 'plane', values: [PLANE], auto: true }, { field: 'type', values: ['feature'] }], items: [] },
  cols: [
    { id: 'tc-status', field: 'status' },
    { id: 'tc-priority', field: 'priority' },
  ],
}
const pieces: WithId<Piece>[] = [
  { id: PLANE, kind: 'plane', x: 0, y: 0, w: 700, h: 725, name: '01 Lunch', createdAt: AT, updatedAt: AT },
  { id: TABLE, kind: 'table', x: 725, y: 0, w: 425, h: 275, name: '02 Features', table, stuckTo: PLANE, createdAt: AT + 1, updatedAt: AT + 1 },
]

// A row of cards lands (and the links whose two ends are now there).
const land = (row: number): Step['do'] =>
  set((ws) => {
    const cards = [...ws.cards, ...CARDS[row]]
    const here = new Set(cards.map((c) => c.id))
    return { ...ws, cards, edges: LINKS.filter((e) => here.has(e.fromId) && here.has(e.toId)) }
  }, `row ${row + 1} lands`)

// Some cards land (and the links whose two ends are now there).
const landCards = (more: Card[], what: string): Step['do'] =>
  set((ws) => {
    const cards = [...ws.cards, ...more]
    const here = new Set(cards.map((c) => c.id))
    return { ...ws, cards, edges: LINKS.filter((e) => here.has(e.fromId) && here.has(e.toId)) }
  }, what)

// A row of the table beside (its name cell), found by its words, right of the plane's part of the screen.
const row = (words: string) => (c: Ctx): Pt | null => {
  const right = planeArea().w * c.scale
  const all = [...document.querySelectorAll<HTMLElement>('[data-scene] *')].filter((e) => e.childElementCount === 0 && (e.textContent ?? '').startsWith(words))
  const el = all.find((e) => e.getBoundingClientRect().left > right)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + Math.min(r.width * 0.7, 90), y: r.top + r.height * 0.75 }
}

function zoomTable(c: Ctx) {
  const right = planeArea().w * c.scale
  const head = [...document.querySelectorAll<HTMLElement>('[data-scene] *')].find((e) => e.tagName === 'BUTTON' && /^title$/i.test(e.textContent ?? '') && e.getBoundingClientRect().left > right)
  if (!head) return console.error('[demo] pieces-tour: no table head')
  const r = head.getBoundingClientRect()
  const at = { clientX: r.left - 8 * c.scale, clientY: r.top - 8 * c.scale }
  ;(document.elementFromPoint(at.clientX, at.clientY) ?? head).dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -160, ...at }))
}

const PLUS = '[aria-label="Add to the canvas"], [data-learn="plus"]'
const FEATURE_ROW = '[role="menu"] [data-key="feature"]'
const [MADE, ...FIRST] = [...CARDS[4]].reverse()

const scene: Scene = {
  id: 'pieces-tour',
  fixture: { ...pazar, pieces, cards: [], edges: [], cells: [], tasks: [], wid: WID, workspace },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${PLANE}&beside=${TABLE}`,
  size: [960, 600],
  length: 7400,
  // The person's feature made, its row in the table beside, the cursor on it.
  poster: 7300,
  cursor: inFocus(640, 760),
  // The table's own view is zoomed in 1.27× round its top left at 0 (a wheel turn there), so its rows read.
  // The plane a little wider than the table (its cards readable), the plane's chain framed in its part.
  setup: [run(() => useCanvasView.setState({ split: 0.56 }), 'split'), camera.frame({ x: -90, y: -20, w: 780, h: 740 }, 16)],
  steps: [
    // At 0, once the split has settled (the pane fits itself again when its box changes): part of the first frame.
    { at: 0, do: run(zoomTable, 'the table closer') },
    { at: 300, do: land(0) },
    { at: 800, do: land(1) },
    { at: 1300, do: land(2) },
    { at: 1800, do: land(3) },
    { at: 2300, do: landCards([...FIRST].reverse(), 'two features land') },
    // The person adds the last feature: the side nav's `+`, the real menu of card types, `feature`; it lands on the plane
    // and the table beside gains its row.
    { at: 2700, do: cursor.to(PLUS, 1000) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(650) },
    { do: cursor.to(aim(FEATURE_ROW, 0.3, 0.5), 700) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: landCards([MADE], 'the feature is made') },
    { do: wait(400) },
    { do: cursor.to(row('Allergen labels'), 1000) },
  ],
}
export default scene
