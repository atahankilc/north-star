// What O9's scenes share (D-315, onboarding.md §6.2b): Pazar as a scene's fixture, a clear stretch of its canvas, the
// stage without the HUD (a lesson about one piece shows that piece, §6.2b.1), typing at a person's pace, a right-click,
// and made-up pieces and text. Here, not in scenes/, as every file there is a scene.
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import type { Label } from '../../data/labels'
import type { Card } from '../../data/cards'
import type { TableSetup } from '../../data/table'
import { key, pointOf, run, type Action, type Step, type Target } from '../director'
import { pazar, workspace, WID } from './pazar'
import { planeArea, useCanvasView } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'

export const base = { ...pazar, wid: WID, workspace }
export const AT = workspace.createdAt + 8 * 24 * 3600 * 1000

// A clear stretch of the canvas, left of every Pazar piece (they start at x 0): new things appear here.
export const CLEAR = { x: -1600, y: 0 }

// The stage without the HUD (breadcrumb, side nav, the corner): the scene's piece alone on the canvas. A style for this
// scene only, put in once; the tree is made again each loop, the style stays.
export const bare = (scene: string): Action =>
  run(() => {
    const id = `demo-bare-${scene}`
    if (document.getElementById(id)) return
    const st = document.createElement('style')
    st.id = id
    st.textContent = `[data-scene="${scene}"] header { display: none !important; }`
    document.head.appendChild(st)
  }, 'no HUD')

// Typed into what has the focus, at a readable pace, no key chips (it's words, not a key).
export const type = (text: string, each = 70): Step[] => [...text].map((ch) => ({ do: { ...key(/[A-Z]/.test(ch) ? `⇧${ch}` : ch === ' ' ? ' ' : ch, 0), ms: each } }))

// A right-click where `t` is (the cursor went there the step before): the browser's contextmenu, which the canvas or a
// plane answers with its menu. (The director's press is the left button's.)
export const rightClick = (t: Target): Action => ({
  what: 'right-click',
  ms: 120,
  start: (c) => {
    const p = pointOf(t, c)
    if (!p) return console.error('[demo] right-click: nothing there')
    const el = document.elementFromPoint(p.x, p.y) ?? document.body
    const init = { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, button: 2, buttons: 2, view: window }
    el.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true }))
    el.dispatchEvent(new MouseEvent('mousedown', init))
    el.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }))
    el.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }))
    el.dispatchEvent(new MouseEvent('contextmenu', { ...init, buttons: 0 }))
  },
})

let n = 0
export const piece = (id: string, p: Omit<Piece, 'createdAt' | 'updatedAt'>): WithId<Piece> => ({ id, ...p, createdAt: AT + ++n, updatedAt: AT + n })
export const text = (l: Omit<Label, 'createdAt'>): Label => ({ ...l, createdAt: AT + ++n })
// A Pazar card, put somewhere else.
export const moved = (id: string, pieceId: string, x: number, y: number, extra: Partial<Card> = {}): Card => ({ ...pazar.cards.find((c) => c.id === id)!, pieceId, x, y, ...extra })

// A piece appearing (what `+` makes, shown with set()), built cell by cell by the canvas as it comes.
export const appear = (p: WithId<Piece>, what = 'it appears') => ({ what, ms: 0, start: (c: import('../director').Ctx) => { const ws = c.store.get(); c.store.set({ ...ws, pieces: [...ws.pieces.filter((x) => x.id !== p.id), p] }); c.store.tell() } })
// Pazar without one of its pieces (it appears in the scene).
export const without = (id: string) => ({ ...base, pieces: base.pieces.filter((p) => p.id !== id) })
export const pazarPiece = (id: string) => base.pieces.find((p) => p.id === id)!
// Off the stage: a scene where no hand is needed (the `+` menu beside it was the cause).
export const AWAY = { x: 4000, y: 4000 }

// A small plane of its own (`id`), the scene's cards on it, alone on the canvas: what a card scene's focus shows.
export const PLANE_K = 'p-k'
export const smallPlane = (cards: Card[], extra: Partial<typeof base> = {}) => ({
  ...base,
  pieces: [piece(PLANE_K, { kind: 'plane', x: 0, y: 0, w: 1000, h: 600, name: '01 Lunch' })],
  cards,
  edges: [],
  tasks: [],
  ...extra,
})
export const focusRoute = (id = PLANE_K) => `/workspaces/${base.wid}?focus=${id}`
// A card arriving on the plane (shown with set()): it builds in cell by cell.
export const arrive = (c: Card, what = `${c.type} arrives`) => ({ what, ms: 0, start: (x: import('../director').Ctx) => { const ws = x.store.get(); x.store.set({ ...ws, cards: [...ws.cards.filter((k) => k.id !== c.id), c] }); x.store.tell() } })

// The focused piece's own view gliding (eased both ends) to frame part of it (its px), as camera.frame does at once:
// the scene's look following what it shows (a package folding small, a card growing).
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const frameTo = (b: { x: number; y: number; w: number; h: number }, ms: number, pad = 16): Action => {
  let from = { zoom: 1, ox: 0, oy: 0 }
  let to = from
  return {
    what: 'focus view glides',
    ms,
    start: () => {
      from = useCanvasView.getState().planeCam ?? from
      const a = planeArea()
      const zoom = Math.min(1.25, (a.w - 2 * pad) / b.w, (a.h - 2 * pad) / b.h)
      to = { zoom, ox: a.w / 2 - (b.x + b.w / 2) * zoom, oy: a.h / 2 - (b.y + b.h / 2) * zoom }
    },
    frame: (_c, k) => {
      const e = isReducedMotion() ? 1 : ease(k)
      useCanvasView.setState({ planeCam: { zoom: from.zoom + (to.zoom - from.zoom) * e, ox: from.ox + (to.ox - from.ox) * e, oy: from.oy + (to.oy - from.oy) * e } })
    },
  }
}

// A plane of its own on the clear stretch with three of Lunch's cards: what the piece lessons move, resize and open.
export const PLANE_E = 'p-e'
export const planeE = (extra: Partial<WithId<Piece>> = {}) => piece(PLANE_E, { kind: 'plane', x: CLEAR.x, y: CLEAR.y, w: 500, h: 325, name: '01 Lunch', ...extra })
// Copies under ids of their own (Pazar's cards stay where they are).
export const copy = (id: string, pieceId: string, x: number, y: number): Card => ({ ...moved(id, pieceId, x, y), id: `${pieceId}-${id}` })
export const planeECards = [copy('c-office', PLANE_E, 25, 50), copy('r-greasy', PLANE_E, 275, 50), copy('i-preorder', PLANE_E, 275, 200)]
export const planeEEdges = [{ ...pazar.edges.find((e) => e.id === 'e-1')!, id: 'pe-1', fromId: `${PLANE_E}-i-preorder`, toId: `${PLANE_E}-r-greasy` }]
// The canvas's distance (canvas px) on the page now, from a point the cursor knows: a drag's `to`.
export const by = (from: () => { x: number; y: number } | null, dx: number, dy: number) => (c: import('../director').Ctx) => {
  const a = from()
  if (!a) return null
  const z = (useCanvasView.getState().cams[c.wid]?.zoom ?? 1) * c.scale
  return { x: a.x + dx * z, y: a.y + dy * z }
}

// A double-click on what's at `t` (the director's press is a single click): a cell to type in, a piece to focus.
export const doubleClick = (t: Target): Action => ({
  what: 'double-click',
  ms: 0,
  start: (c) => {
    const p = pointOf(t, c)
    if (!p) return console.error('[demo] double-click: nothing there')
    const el = document.elementFromPoint(p.x, p.y) ?? document.body
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, button: 0, detail: 2, view: window }))
  },
})

// A plane of features (Product's, copied) with a features table beside it on the clear stretch: what the lens lessons
// open, unframe, stick and open beside. The table's rows: that plane's features once it's stuck (`plane is …`), else
// every feature.
export const PLANE_F = 'p-f'
export const TABLE_F = 't-f'
export const planeF = piece(PLANE_F, { kind: 'plane', x: CLEAR.x, y: CLEAR.y, w: 500, h: 325, name: '02 Product' })
export const planeFCards = [copy('f-pickup', PLANE_F, 25, 50), copy('f-qr', PLANE_F, 275, 50), copy('f-counter', PLANE_F, 25, 200), copy('f-allergens', PLANE_F, 275, 200)]
const cols: TableSetup['cols'] = [
  { id: 'tc-status', field: 'status' },
  { id: 'tc-priority', field: 'priority' },
  { id: 'tc-cost', name: 'cost / month', kind: 'number', unit: '€' },
]
export const tableF = (stuck: boolean, extra: Partial<WithId<Piece>> = {}) =>
  piece(TABLE_F, {
    kind: 'table',
    x: CLEAR.x + (stuck ? 525 : 700),
    y: CLEAR.y + (stuck ? 0 : 50),
    w: 475,
    h: 250,
    name: '04 Features',
    table: { rows: { rules: stuck ? [{ field: 'plane', values: [PLANE_F], auto: true }, { field: 'type', values: ['feature'] }] : [{ field: 'plane', values: [PLANE_F] }, { field: 'type', values: ['feature'] }], items: [] }, cols },
    ...(stuck ? { stuckTo: PLANE_F } : {}),
    ...extra,
  })
export const costs = [
  { matrixId: TABLE_F, row: `${PLANE_F}-f-pickup`, col: 'tc-cost', value: 120, updatedAt: AT },
  { matrixId: TABLE_F, row: `${PLANE_F}-f-qr`, col: 'tc-cost', value: 640, updatedAt: AT },
]
export const lensFixture = (stuck: boolean, extra: Partial<WithId<Piece>> = {}) => ({ ...base, pieces: [...base.pieces, planeF, tableF(stuck, extra)], cards: [...base.cards, ...planeFCards], cells: [...base.cells, ...costs] })

// The last element matching `selector` whose text starts with `words`, at (ax, ay) inside it: a button known by its words.
export const byText = (selector: string, words: string, ax = 0.5, ay = 0.5) => () => {
  const el = [...document.querySelectorAll(selector)].filter((e) => (e.textContent ?? '').trim().startsWith(words)).at(-1)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width * ax, y: r.top + r.height * ay }
}

// A card's panel kept shut as it's selected (by a pick the scene makes: a row, a card brought), before it's drawn: the
// state Enter leaves on a card just named (D-250). Its panel (400 px) would cover a scene's whole stage in the slot.
export const shutPanelOnPick = (id: string): Action =>
  run(() => {
    const off = useCanvasView.subscribe((s) => {
      if (s.cardSelected !== id) return
      off()
      if (s.panelShut !== id) useCanvasView.setState({ panelShut: id })
    })
  }, 'its panel stays shut')
