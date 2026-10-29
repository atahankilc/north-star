// S6's piece and canvas ops on the fixture workspace, pure: create_piece, update_piece, rename, resize, arrange with
// what follows a plane and sticking, delete of pieces (the plane's cascade, a matrix's cells, a deck's tasks, a shared
// piece's scope) and of canvases, create_canvas, move_canvas, move_to_canvas, place_on / take_off for pieces.
// Undo of the same plans through apply, and the data/pieces.ts and data/canvases.ts wrappers: tests/unit/wrappers.test.ts.
import { describe, expect, it } from 'vitest'
import { counterIds } from '../../src/ops/newId'
import { validate } from '../../src/ops/validate'
import { project } from '../../src/ops/project'
import { DELETE, OpsRefused, type OpCtx, type Plan } from '../../src/ops/types'
import { arrange } from '../../src/ops/text'
import { createCanvas, createPiece, moveCanvas, moveToCanvasPlan, piecesOff, piecesOnPlan, place, rename, resize, updatePiece } from '../../src/ops/pieces'
import { deleteAny } from '../../src/ops/delete'
import { buildBatch, REGISTRY } from '../../src/ops/registry'
import { followerMoves, nearClearIn, stuckChain } from '../../src/model/pieceMoves'
import { canvasGoes, withStuck } from '../../src/model/canvases'
import type { WorkspaceCtx } from '../../src/state/wsStore'
import { ALICE, fixtureDocs, ID, SEC, T, textWs, wsFrom } from './fixtures/ws'

const NOW = T + 1000
const ctxOf = (ws: WorkspaceCtx = textWs()): OpCtx => ({ ws, actor: ALICE, now: NOW, newId: counterIds('new') })
function run(ctx: OpCtx, plans: Plan[]) {
  expect(validate(plans, ctx.ws, ctx.actor)).toEqual({ ok: true })
  return project(ctx.ws, plans)
}
const throwsRefused = (f: () => unknown, re: RegExp) => {
  try {
    f()
  } catch (e) {
    expect(e).toBeInstanceOf(OpsRefused)
    expect((e as OpsRefused).errors[0].message).toMatch(re)
    expect((e as OpsRefused).errors[0].fix.length).toBeGreaterThan(5)
    return (e as OpsRefused).errors[0]
  }
  throw new Error('did not refuse')
}
const piece = (ws: WorkspaceCtx, id: string) => ws.pieces.find((p) => p.id === id)
const C2 = SEC.canvas2

// The fixture with the deck touching the first plane's bottom edge (one grid step out), a table, and a timeline stuck
// to the deck.
const TABLE = 'table000000000000005'
const TL = 'timeline000000000006'
function stuckWs(): WorkspaceCtx {
  const d = fixtureDocs()
  const deck = d.pieces.find((p) => p.id === ID.deck)!
  deck.y = 625
  d.pieces.push(
    { id: TABLE, kind: 'table', x: 2200, y: 0, w: 800, h: 400, table: { rows: { rules: [{ field: 'type', values: ['feature'] }], items: [] }, cols: [{ id: 'c1', field: 'status' }] }, createdAt: T, updatedAt: T },
    { id: TL, kind: 'timeline', x: 0, y: 1150, w: 1000, h: 420, stuckTo: ID.deck, createdAt: T, updatedAt: T },
  )
  d.cells.push({ id: `${TABLE}_${ID.qr}_c1`, matrixId: TABLE, row: ID.qr, col: 'c1', value: 'x', updatedAt: T })
  d.canvases.push({ id: C2, name: 'Engineering', order: 1, createdAt: T })
  d.pieceSpots.push({ id: `${C2}_${ID.planeB}`, canvasId: C2, pieceId: ID.planeB, x: 0, y: 0, createdAt: T })
  return wsFrom(d)
}

describe('model: what follows a plane, the nearest clear place', () => {
  it('stuckChain goes all the way down (plane → deck → timeline); followerMoves keeps a touching one on its edge', () => {
    const ws = stuckWs()
    expect(stuckChain(ws.pieces, ID.planeA).map((p) => p.id)).toEqual([ID.deck, TL])
    const a = piece(ws, ID.planeA)!
    const moves = followerMoves(ws.pieces, ID.planeA, a, { ...a, h: 700 })
    // The deck touches the bottom: stays on it (y = 700 + 25); the timeline, apart from the deck, moves as its corner.
    expect(moves.find((m) => m.id === ID.deck)!.to).toMatchObject({ x: 0, y: 725 })
    expect(moves.find((m) => m.id === TL)!.to).toMatchObject({ x: 0, y: 1250 })
    expect(withStuck([ID.planeA], ws.pieces).map((p) => p.id).sort()).toEqual([ID.deck, ID.planeA, TL].sort())
  })

  it('nearClearIn: where asked when clear, else the nearest clear spot', () => {
    expect(nearClearIn({ x: 5000, y: 0, w: 100, h: 100 }, [{ x: 0, y: 0, w: 960, h: 600 }])).toEqual({ x: 5000, y: 0 })
    const p = nearClearIn({ x: 0, y: 0, w: 400, h: 400 }, [{ x: 0, y: 0, w: 100, h: 100 }])
    expect(p).not.toEqual({ x: 0, y: 0 })
    expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(300)
  })
})

describe('create_piece', () => {
  it('a deck is stored as a kanban with three columns, on the canvas named (never the screen)', () => {
    const ctx = ctxOf()
    const plan = createPiece(ctx, { kind: 'deck', name: 'Launch', canvas: 'main', where: { x: 5000, y: 0 } })
    expect(plan).toMatchObject({ op: 'create_piece', label: 'add a deck', meta: { kind: 'kanban' } })
    const ws = run(ctx, [plan])
    const p = piece(ws, plan.ids.$new)!
    expect(p).toMatchObject({ kind: 'kanban', name: 'Launch', x: 5000, y: 0, w: 900, h: 500 })
    expect(p.kanban!.cols.map((c) => c.name)).toEqual(['todo', 'doing', 'done'])
    expect(p.canvasId).toBeUndefined()
    // On the second canvas: its canvasId.
    expect(createPiece(ctx, { kind: 'plane', canvas: C2 }).writes[0].set!.canvasId).toBe(C2)
  })

  it('the canvas must be said and exist; kinds, setups and documents are checked', () => {
    const ctx = ctxOf()
    throwsRefused(() => createPiece(ctx, { kind: 'plane' } as never), /which canvas/)
    throwsRefused(() => createPiece(ctx, { kind: 'plane', canvas: 'nope' }), /no canvas nope/)
    throwsRefused(() => createPiece(ctx, { kind: 'board' as never, canvas: 'main' }), /isn't a kind of piece/)
    throwsRefused(() => createPiece(ctx, { kind: 'plane', canvas: 'main', setup: { a: 1 } }), /has no setup/)
    throwsRefused(() => createPiece(ctx, { kind: 'document', canvas: 'main' }), /shows a document/)
    throwsRefused(() => createPiece(ctx, { kind: 'matrix', canvas: 'main', stuck_to: ID.matrix }), /sticks to a plane/)
    throwsRefused(() => createPiece(ctx, { kind: 'plane', canvas: 'main', stuck_to: ID.planeA }), /doesn't stick/)
  })

  it('at: centred, moved to the nearest clear place; near: right of a piece; nothing: under everything', () => {
    const ctx = ctxOf()
    const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    const atPlan = createPiece(ctx, { kind: 'plane', canvas: 'main', where: { at: [480, 300] } })
    const made = run(ctx, [atPlan]).pieces.find((p) => p.id === atPlan.ids.$new)!
    for (const p of ctx.ws.pieces) expect(overlap(made, p)).toBe(false)
    const near = createPiece(ctxOf(), { kind: 'table', canvas: 'main', where: { near: ID.planeB } }).writes[0].set!
    expect(near.x).toBeGreaterThanOrEqual(1100 + 960)
    const under = createPiece(ctxOf(), { kind: 'documents', canvas: 'main' }).writes[0].set!
    expect(under.y).toBeGreaterThanOrEqual(1200)
    expect(under.documents).toEqual({ view: 'table', pageSize: 10 })
  })

  it('stuck to a plane: beside it, a table showing that plane (its auto rule), a matrix its typed axes', () => {
    const ctx = ctxOf()
    const t = createPiece(ctx, { kind: 'table', canvas: 'main', stuck_to: ID.planeA })
    const ws = run(ctx, [t])
    const table = piece(ws, t.ids.$new)!
    expect(table).toMatchObject({ stuckTo: ID.planeA, x: 960 + 25, y: 0 })
    expect(table.table!.rows.rules[0]).toEqual({ field: 'plane', values: [ID.planeA], auto: true })
    const m = createPiece(ctx, { kind: 'matrix', canvas: 'main', stuck_to: ID.planeA, setup: { rows: { type: 'idea', items: [] }, cols: { noun: 'criteria', items: [{ id: 'i1', name: 'impact' }] }, cell: 'scale', steps: [] } })
    expect((m.writes[0].set!.matrix as { rows: { plane?: string } }).rows.plane).toBe(ID.planeA)
  })
})

describe('update_piece, rename', () => {
  it('rename, frame/unframe, stick and let go: each its label; null name takes it away', () => {
    const ctx = ctxOf(stuckWs())
    expect(updatePiece(ctx, { id: ID.planeA, name: '  Who  ' })).toMatchObject({ label: 'rename a plane', writes: [{ patch: { name: 'Who' } }] })
    expect(updatePiece(ctx, { id: ID.planeA, name: null }).writes[0].patch!.name).toBe(DELETE)
    expect(updatePiece(ctx, { id: TABLE, framed: false })).toMatchObject({ label: 'open a table', writes: [{ patch: { open: true } }] })
    expect(updatePiece(ctx, { id: TABLE, framed: true }).writes[0].patch!.open).toBe(DELETE)
    throwsRefused(() => updatePiece(ctx, { id: ID.planeA, framed: false }), /always framed/)
    const stick = updatePiece(ctx, { id: TABLE, stuck_to: ID.planeB })
    expect(stick.label).toBe('stick a table')
    const ws = run(ctx, [stick])
    expect(piece(ws, TABLE)!.table!.rows.rules).toEqual([{ field: 'plane', values: [ID.planeB], auto: true }, { field: 'type', values: ['feature'] }])
    const off = updatePiece({ ...ctx, ws }, { id: TABLE, stuck_to: null })
    expect(off.label).toBe('unstick a table')
    expect(piece(run({ ...ctx, ws }, [off]), TABLE)!.table!.rows.rules).toEqual([{ field: 'type', values: ['feature'] }])
    throwsRefused(() => updatePiece(ctx, { id: TL, stuck_to: TABLE }), /sticks to a deck or plane/)
    throwsRefused(() => updatePiece(ctx, { id: ID.planeA, documents: { view: 'shelf' } }), /isn't a documents list/)
    // Nothing changed: nothing written.
    expect(updatePiece(ctx, { id: ID.deck, stuck_to: ID.planeA }).writes).toEqual([])
  })

  it('rename: a piece or a canvas; main without its doc gets one (listed as made); a card is refused with a fix', () => {
    const ctx = ctxOf()
    expect(rename(ctx, { id: ID.planeA, name: 'People' })).toMatchObject({ op: 'rename', label: 'rename a plane' })
    const main = rename(ctx, { id: 'main', name: 'Strategy' })
    expect(main.writes[0]).toEqual({ coll: 'canvases', id: 'main', set: { name: 'Strategy', order: 0, createdAt: NOW } })
    expect(Object.values(main.ids)).toEqual(['main'])
    run(ctx, [main])
    expect(rename(ctx, { id: C2, name: 'Eng' }).writes[0]).toEqual({ coll: 'canvases', id: C2, patch: { name: 'Eng' } })
    throwsRefused(() => rename(ctx, { id: ID.anna, name: 'x' }), /title/)
  })
})

describe('resize, arrange with followers and sticking', () => {
  it('resize a plane: what touches it stays on its edge; at least 325 × 200; not while unframed', () => {
    const ctx = ctxOf(stuckWs())
    const plan = resize(ctx, { id: ID.planeA, w: 1000, h: 700 })
    expect(plan).toMatchObject({ op: 'resize', label: 'resize a plane', meta: { kind: 'plane' } })
    const ws = run(ctx, [plan])
    expect(piece(ws, ID.planeA)).toMatchObject({ w: 1000, h: 700 })
    expect(piece(ws, ID.deck)).toMatchObject({ y: 725 })
    expect(piece(ws, TL)).toMatchObject({ y: 1250 })
    throwsRefused(() => resize(ctx, { id: ID.planeA, w: 100, h: 100 }), /at least 325/)
    const open = ctxOf(project(ctx.ws, [updatePiece(ctx, { id: TABLE, framed: false })]))
    throwsRefused(() => resize(open, { id: TABLE, w: 900, h: 500 }), /as big as what it shows/)
  })

  it('resize text: a sticky note its width (h refused), a section its box', () => {
    const ctx = ctxOf()
    expect(resize(ctx, { id: ID.note, w: 200 })).toMatchObject({ op: 'resize', label: 'resize a sticky note', writes: [{ patch: { w: 200 } }] })
    throwsRefused(() => resize(ctx, { id: ID.note, w: 200, h: 300 }), /has no h/)
    expect(resize(ctx, { id: SEC.plane, w: 500, h: 400 }).writes[0].patch).toMatchObject({ w: 500, h: 400 })
  })

  it('arrange a plane brings what is stuck to it, all the way down; carry: false leaves them', () => {
    const ctx = ctxOf(stuckWs())
    const plan = arrange(ctx, { items: [ID.planeA], by: [100, 50] })
    expect(plan.label).toBe('move a plane')
    expect(plan.meta).toEqual({ kind: 'plane' })
    const ws = run(ctx, [plan])
    expect(piece(ws, ID.planeA)).toMatchObject({ x: 100, y: 50 })
    expect(piece(ws, ID.deck)).toMatchObject({ x: 100, y: 675 })
    expect(piece(ws, TL)).toMatchObject({ x: 100, y: 1200 })
    expect(arrange(ctx, { items: [ID.planeA], by: [100, 50], carry: false }).writes).toHaveLength(1)
  })

  it('arrange a plane shown through a spot moves its spot there, and its followers shown there', () => {
    const ctx = ctxOf(stuckWs())
    const plan = arrange(ctx, { items: [ID.planeB], by: [0, 100], canvas: C2 })
    expect(plan.writes).toEqual([{ coll: 'pieceSpots', id: `${C2}_${ID.planeB}`, patch: { x: 0, y: 100 } }])
  })

  it('stick: a table dropped near a plane edge snaps one step out and sticks (one patch); far away it stays as it was', () => {
    const ctx = ctxOf(stuckWs())
    // planeB's right edge is at 2060: dropped at 2100, 40 px out.
    const plan = arrange(ctx, { to: [{ id: TABLE, x: 2100, y: 10 }], stick: true })
    expect(plan.label).toBe('stick a table')
    expect(plan.writes).toHaveLength(1)
    const ws = run(ctx, [plan])
    expect(piece(ws, TABLE)).toMatchObject({ x: 2060 + 25, y: 0, stuckTo: ID.planeB })
    expect(piece(ws, TABLE)!.table!.rows.rules[0]).toEqual({ field: 'plane', values: [ID.planeB], auto: true })
    const far = arrange(ctx, { to: [{ id: TABLE, x: 4000, y: 0 }], stick: true })
    expect(far.label).toBe('move a table')
    expect(far.writes[0].patch).toEqual({ x: 4000, y: 0, updatedAt: NOW })
  })

  it('place (the UI drag): exact boxes for itself and its followers, a stick change, one plan', () => {
    const ctx = ctxOf(stuckWs())
    const plan = place(ctx, { id: ID.deck, canvas: 'main', to: { x: 0, y: 700, w: 900, h: 500 }, stuck: null, followers: [{ id: TL, to: { x: 0, y: 1225, w: 1000, h: 420 } }] })
    expect(plan.label).toBe('unstick a deck')
    const ws = run(ctx, [plan])
    expect(piece(ws, ID.deck)!.stuckTo).toBeUndefined()
    expect(piece(ws, TL)).toMatchObject({ y: 1225 })
  })
})

describe('delete pieces', () => {
  it('a plane: its cards go with their links, a card also on another plane moves home there, its text and places go', () => {
    const ctx = ctxOf()
    const plan = deleteAny(ctx, { ids: [ID.planeA] })
    expect(plan).toMatchObject({ op: 'delete', label: 'delete a plane', meta: { kind: 'plane' } })
    const ws = run(ctx, [plan])
    expect(piece(ws, ID.planeA)).toBeUndefined()
    for (const id of [ID.barista, ID.queue, ID.menu, ID.preorder]) expect(ws.cards.some((c) => c.id === id)).toBe(false)
    // Anna is on the market plane too: she stays, at home there, at her spot there; that place goes.
    expect(ws.cards.find((c) => c.id === ID.anna)).toMatchObject({ pieceId: ID.planeB, x: 50, y: 300 })
    expect(ws.places).toEqual([])
    expect(ws.evidence.map((e) => e.id)).toEqual([ID.ev1])
    expect(ws.edges.map((e) => e.id)).toEqual([])
    expect(ws.labels.some((l) => l.id === ID.note || l.id === SEC.plane)).toBe(false)
    // The deck stuck to it stays (let go by the app's reading, D-141), with its tasks.
    expect(piece(ws, ID.deck)).toBeDefined()
    expect(ws.tasks).toHaveLength(2)
  })

  it('a matrix takes its cells, a deck its tasks, a table its cells', () => {
    const ctx = ctxOf(stuckWs())
    const m = run(ctx, [deleteAny(ctx, { ids: [ID.matrix] })])
    expect(m.cells.filter((c) => c.matrixId === ID.matrix)).toEqual([])
    expect(m.cells).toHaveLength(1)
    const d = deleteAny(ctx, { ids: [ID.deck] })
    expect(d.label).toBe('delete a deck')
    expect(run(ctx, [d]).tasks).toEqual([])
    expect(run(ctx, [deleteAny(ctx, { ids: [TABLE] })]).cells.filter((c) => c.matrixId === TABLE)).toEqual([])
  })

  it('a piece on two canvases asks which (D-313): here takes it off one canvas, everywhere deletes it and its spots', () => {
    const ctx = ctxOf(stuckWs())
    throwsRefused(() => deleteAny(ctx, { ids: [ID.planeB] }), /on 2 canvases \(Main, Engineering\)/)
    throwsRefused(() => deleteAny(ctx, { ids: [ID.planeB], scope: 'here' }), /which canvas/)
    const off = deleteAny(ctx, { ids: [ID.planeB], scope: 'here', canvas: C2 })
    expect(off).toMatchObject({ label: 'take a plane off this canvas', writes: [{ coll: 'pieceSpots', id: `${C2}_${ID.planeB}`, del: true }] })
    // Off its home: the home moves to the other canvas, at its spot there.
    const home = run(ctx, [deleteAny(ctx, { ids: [ID.planeB], scope: 'here', canvas: 'main' })])
    expect(piece(home, ID.planeB)).toMatchObject({ canvasId: C2, x: 0, y: 0 })
    expect(home.spots).toEqual([])
    const all = run(ctx, [deleteAny(ctx, { ids: [ID.planeB], scope: 'everywhere' })])
    expect(piece(all, ID.planeB)).toBeUndefined()
    expect(all.spots).toEqual([])
    expect(all.cards.some((c) => c.id === ID.qr || c.id === ID.orderly || c.id === ID.pkg)).toBe(false)
    // Anna's place on it goes; she stays at home.
    expect(all.cards.find((c) => c.id === ID.anna)).toMatchObject({ pieceId: ID.planeA })
  })

  it('take_off pieces: off a canvas, refused when on no other', () => {
    const ctx = ctxOf(stuckWs())
    expect(piecesOff(ctx, { piece: ID.planeB, canvas: C2 }).writes).toEqual([{ coll: 'pieceSpots', id: `${C2}_${ID.planeB}`, del: true }])
    throwsRefused(() => piecesOff(ctx, { piece: ID.planeA, canvas: 'main' }), /no other canvas/)
  })
})

describe('canvases', () => {
  it('create_canvas: after the others; the first time main gets its doc too (listed as made)', () => {
    const ctx = ctxOf(wsFrom(fixtureDocs()))
    const plan = createCanvas(ctx, { name: ' Marketing ' })
    const id = plan.ids.$new
    expect(plan.writes).toEqual([
      { coll: 'canvases', id, set: { name: 'Marketing', order: 1, createdAt: NOW, createdBy: ALICE.uid } },
      { coll: 'canvases', id: 'main', set: { name: 'Main', order: 0, createdAt: NOW } },
    ])
    expect(Object.values(plan.ids).sort()).toEqual(['main', id].sort())
    const ws = run(ctx, [plan])
    expect(ws.canvases.map((c) => c.name)).toEqual(['Main', 'Marketing'])
    const second = createCanvas({ ...ctx, ws }, { name: 'Sales' })
    expect(second.writes).toHaveLength(1)
    expect(second.writes[0].set!.order).toBe(2)
    throwsRefused(() => createCanvas(ctx, { name: '  ' }), /needs a name/)
  })

  it('move_canvas: up or down, refused at the ends', () => {
    const ctx = ctxOf()
    const ws = run(ctx, [moveCanvas(ctx, { canvas: C2, by: 'up' })])
    expect(ws.canvases.map((c) => c.id)).toEqual([C2, 'main'])
    throwsRefused(() => moveCanvas(ctx, { canvas: 'main', by: 'up' }), /first already/)
  })

  it('delete a canvas: its pieces with what is theirs, its text, spots there; a piece also elsewhere moves home; never main', () => {
    const d = fixtureDocs()
    d.canvases.push({ id: C2, name: 'Engineering', order: 1, createdAt: T })
    // A plane at home on canvas 2 with a card also placed on planeA, a heading there, and planeB shown there too.
    d.pieces.push({ id: 'planeC00000000000009', kind: 'plane', canvasId: C2, x: 0, y: 0, w: 960, h: 600, createdAt: T, updatedAt: T })
    d.ideas.push({ id: 'idea0000000000000009', title: 'Gift cards', pieceId: 'planeC00000000000009', x: 50, y: 50, createdAt: T, updatedAt: T })
    d.ideas.push({ id: 'idea0000000000000010', title: 'Tips', pieceId: 'planeC00000000000009', x: 300, y: 50, createdAt: T, updatedAt: T })
    d.places.push({ id: `${ID.planeA}_idea0000000000000009`, planeId: ID.planeA, cardId: 'idea0000000000000009', type: 'idea', x: 700, y: 400, createdAt: T })
    d.labels.push({ id: 'labl0000000000000099', pieceId: 'canvas', canvasId: C2, text: 'Build', size: 'heading', x: 0, y: -100, createdAt: T, updatedAt: T })
    d.pieceSpots.push({ id: `${C2}_${ID.planeB}`, canvasId: C2, pieceId: ID.planeB, x: 1100, y: 0, createdAt: T })
    const ctx = ctxOf(wsFrom(d))
    expect(canvasGoes(C2, ctx.ws).pieces.map((p) => p.id)).toEqual(['planeC00000000000009'])
    const plan = deleteAny(ctx, { ids: [C2] })
    expect(plan).toMatchObject({ label: 'delete a canvas', meta: { kind: 'canvas' } })
    const ws = run(ctx, [plan])
    expect(ws.canvases.map((c) => c.id)).toEqual(['main'])
    expect(piece(ws, 'planeC00000000000009')).toBeUndefined()
    expect(ws.cards.find((c) => c.id === 'idea0000000000000009')).toMatchObject({ pieceId: ID.planeA, x: 700, y: 400 })
    expect(ws.cards.some((c) => c.id === 'idea0000000000000010')).toBe(false)
    expect(ws.labels.some((l) => l.id === 'labl0000000000000099')).toBe(false)
    expect(ws.spots).toEqual([])
    expect(piece(ws, ID.planeB)).toMatchObject({ x: 1100 })
    throwsRefused(() => deleteAny(ctx, { ids: ['main'] }), /first canvas is never deleted/)
  })

  it('move_to_canvas: a plane goes with what is stuck to it; a section with what it holds; where it lands is clear', () => {
    const ctx = ctxOf(stuckWs())
    const { plan, landed } = moveToCanvasPlan(ctx, { items: [ID.planeA], canvas: C2, from: 'main' })
    expect(plan.label).toBe('move 3 things to Engineering')
    const ws = run(ctx, [plan])
    for (const id of [ID.planeA, ID.deck, TL]) expect(piece(ws, id)!.canvasId).toBe(C2)
    expect(piece(ws, ID.matrix)!.canvasId).toBeUndefined()
    // planeB is shown on canvas 2 at 0,0: they land clear of it.
    expect(landed.x !== 0 || landed.y !== 0).toBe(true)
    // A piece only shown here (through a spot) isn't moved.
    throwsRefused(() => moveToCanvasPlan(ctxOf(stuckWs()), { items: [ID.planeB], canvas: 'main', from: C2 }), /only shown here/)
    // The canvas section carries the heading and planeA (and so its deck and timeline).
    const sec = textWs()
    const r = moveToCanvasPlan(ctxOf(sec), { items: [SEC.canvas], canvas: C2, from: 'main' })
    const ids = r.plan.writes.map((w) => w.id).sort()
    expect(ids).toEqual([ID.deck, ID.heading, ID.planeA, SEC.canvas].sort())
  })

  it('place_on pieces: a spot each on the other canvas, with what is stuck; those there already stay', () => {
    const ctx = ctxOf(stuckWs())
    const { plan, landed } = piecesOnPlan(ctx, { pieces: [ID.planeA], canvas: C2, from: 'main' })
    expect(plan.writes.map((w) => w.id).sort()).toEqual([`${C2}_${ID.deck}`, `${C2}_${ID.planeA}`, `${C2}_${TL}`].sort())
    expect(landed).not.toBeNull()
    const ws = run(ctx, [plan])
    expect(ws.spots).toHaveLength(4)
    expect(piecesOnPlan({ ...ctx, ws }, { pieces: [ID.planeA], canvas: C2, from: 'main' }).landed).toBeNull()
    // Through the registry: place_on with pieces + canvas.
    expect(REGISTRY.get('place_on')!.build(ctx, { pieces: [ID.matrix], canvas: C2 }).writes).toHaveLength(1)
  })

  it('a batch: a new canvas, a plane on it, a deck stuck to the plane; one validate pass', () => {
    const ctx = ctxOf(wsFrom(fixtureDocs()))
    const plans = buildBatch(ctx, [
      { op: 'create_canvas', args: { name: 'Ops', handle: '$c' } },
      { op: 'create_piece', args: { kind: 'plane', name: 'Hiring', canvas: '$c', handle: '$p' } },
      { op: 'create_piece', args: { kind: 'deck', canvas: '$c', stuck_to: '$p' } },
      { op: 'rename', args: { id: '$p', name: 'People' } },
    ])
    const ws = run(ctx, plans)
    const plane = ws.pieces.find((p) => p.name === 'People')!
    expect(plane.canvasId).toBe(plans[0].ids.$c)
    expect(ws.pieces.find((p) => p.stuckTo === plane.id)).toMatchObject({ kind: 'kanban', x: plane.x + plane.w + 25 })
  })
})
