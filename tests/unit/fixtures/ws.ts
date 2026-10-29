// A small, realistic workspace for unit tests (S3): a café-ordering startup on one canvas. Two planes (customers and
// problems on one, the market on the other), eight cards of every type with links, a package, a card also on the second
// plane (a place), a matrix of competitors × features with cells, a deck stuck to the first plane with tasks, a
// heading on the canvas, evidence, a competitor's feature and a match. Built as the listeners build it: raw docs
// (`{ ...data, id }`) through src/model/fromDocs.ts. Every doc is in the shape firestore.rules (and clean.ts) accept.
import { fromDocs, WS_COLLECTIONS, type Docs, type RawDoc } from '../../../src/model/fromDocs'
import type { WorkspaceCtx } from '../../../src/state/wsStore'
import type { OpActor } from '../../../src/ops/types'

export const WID = 'wsTablebook000000001'
export const T = 1_790_000_000_000

export const ID = {
  planeA: 'planeA00000000000001',
  planeB: 'planeB00000000000002',
  matrix: 'matrix00000000000003',
  deck: 'deck0000000000000004',
  anna: 'cust0000000000000001',
  barista: 'cust0000000000000002',
  queue: 'prob0000000000000001',
  menu: 'prob0000000000000002',
  orderly: 'comp0000000000000001',
  preorder: 'idea0000000000000001',
  qr: 'feat0000000000000001',
  loyalty: 'feat0000000000000002',
  pkg: 'pack0000000000000001',
  e1: 'edge0000000000000001',
  e2: 'edge0000000000000002',
  e3: 'edge0000000000000003',
  e4: 'edge0000000000000004',
  heading: 'labl0000000000000001',
  note: 'labl0000000000000002',
  ev1: 'evid0000000000000001',
  cf1: 'cfea0000000000000001',
  task1: 'task0000000000000001',
  task2: 'task0000000000000002',
}

export const ALICE: OpActor = { uid: 'u-alice', role: 'owner' }
export const BOB: OpActor = { uid: 'u-bob', role: 'editor' }
export const CAROL: OpActor = { uid: 'u-carol', role: 'viewer' }

const times = { createdAt: T, updatedAt: T }
const STEPS = [
  { id: 'none', glyph: '○', label: 'none', tone: 'dim' },
  { id: 'partial', glyph: '◐', label: 'partial', tone: 'yellow' },
  { id: 'full', glyph: '●', label: 'full', tone: 'cyan' },
]

export const WORKSPACE = {
  id: WID,
  name: 'Tablebook',
  description: 'Ordering ahead for small cafés',
  ownerId: 'u-alice',
  memberIds: ['u-alice', 'u-bob', 'u-carol'],
  roles: { 'u-alice': 'owner', 'u-bob': 'editor', 'u-carol': 'viewer' },
  inviteCode: 'CAFE42',
  createdAt: T,
}

// Fresh raw docs every call (tests change them freely).
export function fixtureDocs(): Docs {
  const d: Record<string, RawDoc[]> = Object.fromEntries(WS_COLLECTIONS.map((c) => [c, []]))
  d.pieces = [
    { id: ID.planeA, kind: 'plane', x: 0, y: 0, w: 960, h: 600, name: 'Customers', ...times },
    { id: ID.planeB, kind: 'plane', x: 1100, y: 0, w: 960, h: 600, name: 'Market', ...times },
    {
      id: ID.matrix,
      kind: 'matrix',
      x: 1100,
      y: 700,
      w: 800,
      h: 500,
      name: 'Rivals',
      matrix: { rows: { type: 'competitor', items: [] }, cols: { type: 'feature', plane: ID.planeB, items: [] }, cell: 'scale', steps: STEPS },
      ...times,
    },
    { id: ID.deck, kind: 'kanban', x: 0, y: 700, w: 900, h: 500, name: 'Build', kanban: { cols: [{ id: 'todo', name: 'todo' }, { id: 'doing', name: 'doing' }, { id: 'done', name: 'done', done: true }] }, stuckTo: ID.planeA, ...times },
  ]
  d.customers = [
    { id: ID.anna, title: 'Anna, café owner', pieceId: ID.planeA, x: 50, y: 50, validation: 'testing', tags: ['smb'], body: 'Runs two cafés in Berlin.', ...times },
    { id: ID.barista, title: 'Baristas at rush hour', pieceId: ID.planeA, x: 300, y: 50, ...times },
  ]
  d.problems = [
    { id: ID.queue, title: 'Morning queues lose sales', pieceId: ID.planeA, x: 50, y: 225, validation: 'validated', ...times },
    { id: ID.menu, title: 'Menus change daily', pieceId: ID.planeA, x: 300, y: 225, ...times },
  ]
  d.competitors = [{ id: ID.orderly, name: 'Orderly', pieceId: ID.planeB, x: 50, y: 50, regions: ['Germany'], url: 'https://orderly.example', notes: 'Big in DACH.', ...times }]
  d.ideas = [{ id: ID.preorder, title: 'Pre-order from the street', pieceId: ID.planeA, x: 550, y: 225, validation: 'hypothesis', ...times }]
  d.features = [
    { id: ID.qr, title: 'QR table ordering', pieceId: ID.planeB, x: 300, y: 50, priority: 'P1', status: 'planned', impact: 'high', effort: 'M', criteria: [{ id: 'c1', text: 'works offline' }], ...times },
    { id: ID.loyalty, title: 'Loyalty stamps', pieceId: ID.planeB, x: 550, y: 50, impact: 'medium', effort: 'S', ...times },
  ]
  d.packages = [{ id: ID.pkg, title: 'Package 1', pieceId: ID.planeB, x: 300, y: 300, memberIds: [ID.qr, ID.loyalty], ...times }]
  d.edges = [
    { id: ID.e1, fromId: ID.queue, fromType: 'problem', toId: ID.anna, toType: 'customer', kind: 'for' },
    { id: ID.e2, fromId: ID.preorder, fromType: 'idea', toId: ID.queue, toType: 'problem', kind: 'solves' },
    { id: ID.e3, fromId: ID.orderly, fromType: 'competitor', toId: ID.preorder, toType: 'idea', kind: 'competes-with', label: 'same pitch' },
    { id: ID.e4, fromId: ID.qr, fromType: 'feature', toId: ID.preorder, toType: 'idea', kind: 'inspired-by' },
  ]
  // Anna is on the market plane too.
  d.places = [{ id: `${ID.planeB}_${ID.anna}`, planeId: ID.planeB, cardId: ID.anna, type: 'customer', x: 50, y: 300, createdAt: T }]
  d.labels = [
    { id: ID.heading, pieceId: 'canvas', text: 'Who we beat', size: 'heading', kicker: '02', x: 0, y: -200, ...times },
    { id: ID.note, pieceId: ID.planeA, text: 'Ask Anna about Sundays', kind: 'sticky', x: 600, y: 50, uid: 'u-alice', author: 'Alice', ...times },
  ]
  d.cells = [
    { id: `${ID.matrix}_${ID.orderly}_${ID.qr}`, matrixId: ID.matrix, row: ID.orderly, col: ID.qr, value: 'full', updatedAt: T },
    { id: `${ID.matrix}_${ID.orderly}_${ID.loyalty}`, matrixId: ID.matrix, row: ID.orderly, col: ID.loyalty, value: 'partial', confidence: 'guess', updatedAt: T },
  ]
  d.evidence = [{ id: ID.ev1, nodeId: ID.anna, nodeType: 'customer', kind: 'interview', text: 'Loses ~20 orders every morning', stance: 'supports', date: '2026-10-01', ...times }]
  d.competitorFeatures = [{ id: ID.cf1, competitorId: ID.orderly, name: 'Table QR', category: 'ordering', availability: 'paid', ...times }]
  d.comparisons = [{ id: `${ID.qr}_${ID.orderly}`, featureId: ID.qr, competitorId: ID.orderly, competitorFeatureId: ID.cf1, criteria: { c1: 'part' }, updatedAt: T }]
  d.tasks = [
    { id: ID.task1, pieceId: ID.deck, col: 'todo', order: 1, title: 'Interview three more owners', uid: 'u-alice', cardId: ID.anna, cardType: 'customer', due: '2026-11-05', ...times },
    { id: ID.task2, pieceId: ID.deck, col: 'doing', order: 1, title: 'Prototype the QR flow', uid: 'u-bob', assignee: 'u-bob', assigneeName: 'Bob', cardId: ID.qr, cardType: 'feature', ...times },
  ]
  // Sorted by id, as Firestore lists them.
  for (const c of WS_COLLECTIONS) d[c].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return d as Docs
}

// The snapshot a workspace route would hold, made from docs (the fixture's unless given).
export function wsFrom(docs: Docs, workspace: RawDoc = { ...WORKSPACE }): WorkspaceCtx {
  return { ...fromDocs(docs), wid: WID, workspace: workspace as unknown as WorkspaceCtx['workspace'], canvas: 'main' }
}

export const fixtureWs = () => wsFrom(fixtureDocs())

// S5: the fixture with sections and a second canvas (text ops).
export const SEC = { plane: 'labl0000000000000010', canvas: 'labl0000000000000011', canvas2: 'canv0000000000000002' }

// The fixture with a section on the first plane round the sticky note and the pre-order idea, one on the canvas round
// the heading and the first plane, and a second canvas the second plane is also on (a spot).
export function textWs(): WorkspaceCtx {
  const d = fixtureDocs()
  d.labels.push(
    { id: SEC.plane, pieceId: ID.planeA, text: 'Ideas', kind: 'section', x: 525, y: 0, w: 450, h: 375, createdAt: T, updatedAt: T },
    { id: SEC.canvas, pieceId: 'canvas', text: 'Discovery', kind: 'section', x: -50, y: -300, w: 1100, h: 950, createdAt: T, updatedAt: T },
  )
  d.canvases.push({ id: SEC.canvas2, name: 'Engineering', order: 1, createdAt: T })
  d.pieceSpots.push({ id: `${SEC.canvas2}_${ID.planeB}`, canvasId: SEC.canvas2, pieceId: ID.planeB, x: 0, y: 0, createdAt: T })
  return wsFrom(d)
}


// S7: the fixture with a matrix that unfolds features into their criteria and has a typed row, a second competitor
// with the same name (for ambiguous names), and a table of features with a typed row and own columns, with cells.
export const LENS = {
  table: 'table000000000000007',
  orderly2: 'comp0000000000000002',
  square: 'sq0001',
  backlog: 'r00001',
  status: 'tc0001',
  cost: 'tc0002',
  done: 'tc0003',
  risk: 'tc0004',
}

export function lensDocs(): Docs {
  const d = fixtureDocs()
  const m = d.pieces.find((p) => p.id === ID.matrix)! as RawDoc & { matrix: Record<string, unknown> }
  m.matrix = {
    rows: { type: 'competitor', items: [{ id: LENS.square, name: 'Square' }] },
    cols: { type: 'feature', plane: ID.planeB, items: [], unfold: 'criteria' },
    cell: 'scale',
    steps: [
      { id: 'none', glyph: '○', label: 'none', tone: 'dim' },
      { id: 'partial', glyph: '◐', label: 'partial', tone: 'yellow' },
      { id: 'full', glyph: '●', label: 'full', tone: 'cyan' },
    ],
    notRelevant: true,
  }
  d.competitors.push({ id: LENS.orderly2, name: 'Orderly', pieceId: ID.planeB, x: 50, y: 300, createdAt: T, updatedAt: T })
  d.pieces.push({
    id: LENS.table,
    kind: 'table',
    x: 2200,
    y: 0,
    w: 800,
    h: 400,
    name: 'Backlog',
    table: {
      rows: { rules: [{ field: 'type', values: ['feature'] }], items: [{ id: LENS.backlog, name: 'Ops work' }] },
      cols: [
        { id: LENS.status, field: 'status' },
        { id: LENS.cost, name: 'cost', kind: 'number', unit: '€' },
        { id: LENS.done, name: 'done', kind: 'check' },
        { id: LENS.risk, name: 'risk', kind: 'scale', steps: [{ id: 'low', glyph: '▁', label: 'low', tone: 'dim' }, { id: 'high', glyph: '█', label: 'high', tone: 'magenta' }] },
      ],
      sort: { col: LENS.cost },
    },
    createdAt: T,
    updatedAt: T,
  })
  d.cells.push(
    { id: `${ID.matrix}_${ID.orderly}_${ID.qr}~c1`, matrixId: ID.matrix, row: ID.orderly, col: `${ID.qr}~c1`, value: 'partial', updatedAt: T },
    { id: `${ID.matrix}_${LENS.square}_${ID.qr}`, matrixId: ID.matrix, row: LENS.square, col: ID.qr, value: 'none', notes: 'no QR', updatedAt: T },
    { id: `${LENS.table}_${ID.qr}_${LENS.cost}`, matrixId: LENS.table, row: ID.qr, col: LENS.cost, value: 1200, updatedAt: T },
    { id: `${LENS.table}_${LENS.backlog}_${LENS.cost}`, matrixId: LENS.table, row: LENS.backlog, col: LENS.cost, value: 300, updatedAt: T },
    { id: `${LENS.table}_${LENS.backlog}_${LENS.done}`, matrixId: LENS.table, row: LENS.backlog, col: LENS.done, value: 'yes', updatedAt: T },
  )
  for (const c of WS_COLLECTIONS) d[c].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return d
}

export const lensWs = () => wsFrom(lensDocs())
