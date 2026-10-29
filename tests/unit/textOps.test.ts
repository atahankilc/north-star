// S5's text ops on the fixture workspace, pure: create_text (every kind, every way of saying where), update_text,
// delete of text, arrange (a section carrying what's inside it, on a plane and on the canvas), and the registry.
// Undo of the same plans through apply, and the data/labels.ts wrappers: tests/unit/wrappers.test.ts.
import { describe, expect, it } from 'vitest'
import { counterIds } from '../../src/ops/newId'
import { validate } from '../../src/ops/validate'
import { project } from '../../src/ops/project'
import { OpsRefused, type OpCtx, type Plan } from '../../src/ops/types'
import { deleteThings } from '../../src/ops/cards'
import { arrange, createText, updateText } from '../../src/ops/text'
import { buildBatch, REGISTRY } from '../../src/ops/registry'
import { labelBox } from '../../src/model/labelBox'
import { CARD } from '../../src/model/cards'
import { inside, sectionHolds, cardBoxes } from '../../src/model/textPlace'
import type { WorkspaceCtx } from '../../src/state/wsStore'
import { ALICE, CAROL, fixtureDocs, ID, SEC, T, textWs, wsFrom } from './fixtures/ws'

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
const label = (ws: WorkspaceCtx, id: string) => ws.labels.find((l) => l.id === id)!

describe('create_text', () => {
  it('a heading on the canvas at x/y: on the canvas of the ctx (never the screen), main without canvasId', () => {
    const ctx = ctxOf()
    const plan = createText(ctx, { kind: 'heading', text: 'Market', size: 'subheading', kicker: '03', where: { x: 100, y: -500 } })
    expect(plan).toMatchObject({ op: 'create_text', label: 'add a heading', meta: { kind: 'heading' } })
    expect(plan.writes[0].set).toEqual({ pieceId: 'canvas', text: 'Market', size: 'subheading', kicker: '03', x: 100, y: -500, createdAt: NOW, updatedAt: NOW })
    expect(label(run(ctx, [plan]), plan.ids.$new)).toMatchObject({ text: 'Market', size: 'subheading' })
    // Another canvas shown: that one (R1); or the one named.
    const other = ctxOf({ ...textWs(), canvas: SEC.canvas2 })
    expect(createText(other, { kind: 'heading', text: 'x', where: { x: 0, y: 0 } }).writes[0].set!.canvasId).toBe(SEC.canvas2)
    expect(createText(ctx, { kind: 'heading', text: 'x', canvas: SEC.canvas2 }).writes[0].set!.canvasId).toBe(SEC.canvas2)
  })

  it('a paragraph on a plane with no where: a clear spot, clear of its cards and text; defaults as the + makes them', () => {
    const ctx = ctxOf()
    const plan = createText(ctx, { kind: 'paragraph', plane: ID.planeA, text: 'Mornings are the whole business.\nEvery minute counts.' })
    const ws = run(ctx, [plan])
    const p = label(ws, plan.ids.$new)
    expect(p).toMatchObject({ size: 'note', w: 500, pieceId: ID.planeA })
    const box = labelBox(p)
    expect(box.x + box.w).toBeLessThanOrEqual(960)
    const overlap = (a: typeof box, b: typeof box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    for (const c of cardBoxes(ctx.ws.cards.filter((c) => c.pieceId === ID.planeA))) expect(overlap(box, c)).toBe(false)
    for (const l of ctx.ws.labels.filter((l) => l.pieceId === ID.planeA && l.kind !== 'section')) expect(overlap(box, labelBox(l))).toBe(false)
  })

  it('a sticky note near a card: right of it, yellow, signed by the actor; a long text is cut to 4000', () => {
    const ctx = ctxOf()
    const plan = createText(ctx, { kind: 'sticky', plane: ID.planeA, text: 'x'.repeat(5000), author: 'Alice', where: { near: ID.barista } })
    const s = label(run(ctx, [plan]), plan.ids.$new)
    expect(s).toMatchObject({ kind: 'sticky', color: 'yellow', uid: ALICE.uid, author: 'Alice', w: 150, x: 300 + CARD.w + 50, y: 50 })
    expect(s.text.length).toBe(4000)
    // The agent: signed with the actor's name.
    const named = { ...ctx, actor: { ...ALICE, name: 'Alice K' } }
    expect(createText(named, { kind: 'sticky', plane: ID.planeA, text: 'hi' }).writes[0].set).toMatchObject({ uid: ALICE.uid, author: 'Alice K' })
    expect(plan.meta?.kind).toBe('sticky')
  })

  it('a section round things fits them (and later carries them); one in a section lands inside it', () => {
    const ctx = ctxOf()
    const plan = createText(ctx, { kind: 'section', plane: ID.planeA, text: 'Who', around: [ID.anna, ID.barista] })
    const ws = run(ctx, [plan])
    const sec = label(ws, plan.ids.$new)
    expect(sec.kind).toBe('section')
    const holds = sectionHolds(sec, ws.labels, cardBoxes(ws.cards.filter((c) => c.pieceId === ID.planeA)))
    expect(holds.sort()).toEqual([ID.anna, ID.barista].sort())

    const inSec = createText(ctx, { kind: 'heading', plane: ID.planeA, text: 'Top', size: 'minor', where: { in_section: SEC.plane } })
    const h = label(run(ctx, [inSec]), inSec.ids.$new)
    expect(inside(labelBox(h), labelBox(label(ctx.ws, SEC.plane)))).toBe(true)
    // Clear of the sticky note already inside.
    const note = labelBox(label(ctx.ws, ID.note))
    const hb = labelBox(h)
    expect(hb.y >= note.y + note.h || hb.y + hb.h <= note.y || hb.x >= note.x + note.w || hb.x + hb.w <= note.x).toBe(true)
  })

  it('the project title: canvas only, one per workspace, no words of its own', () => {
    const ctx = ctxOf()
    const plan = createText(ctx, { kind: 'title', text: '' })
    expect(plan.writes[0].set).toMatchObject({ kind: 'title', text: '', w: 800, pieceId: 'canvas' })
    const ws = run(ctx, [plan])
    throwsRefused(() => createText(ctxOf(ws), { kind: 'title' }), /already has its project title/)
    throwsRefused(() => createText(ctx, { kind: 'title', plane: ID.planeA }), /canvas only/)
    throwsRefused(() => createText(ctx, { kind: 'title', text: 'Tablebook' }), /has no text/)
  })

  it('refuses, with a fix: a kind it is not, a field the kind has not, a value not allowed, a plane or thing not there', () => {
    const ctx = ctxOf()
    throwsRefused(() => createText(ctx, { kind: 'poem' as never }), /isn't a kind of text/)
    expect(throwsRefused(() => createText(ctx, { kind: 'heading', scale: 'large' }), /has no scale/).fix).toMatch(/takes size/)
    expect(throwsRefused(() => createText(ctx, { kind: 'paragraph', size: 'heading' }), /has no size/).fix).toMatch(/scale/)
    throwsRefused(() => createText(ctx, { kind: 'sticky', color: 'pink' as never }), /isn't a color/)
    throwsRefused(() => createText(ctx, { kind: 'sticky', bold: true }), /has no bold/)
    throwsRefused(() => createText(ctx, { kind: 'heading', plane: 'ghost' }), /no plane ghost/)
    throwsRefused(() => createText(ctx, { kind: 'heading', plane: ID.matrix }), /not a plane/)
    throwsRefused(() => createText(ctx, { kind: 'heading', plane: ID.planeA, where: { near: ID.orderly } }), /isn't on plane/)
    throwsRefused(() => createText(ctx, { kind: 'heading', around: [ID.anna] }), /only a section/)
    throwsRefused(() => createText(ctx, { kind: 'heading', canvas: 'nowhere' }), /no canvas nowhere/)
    throwsRefused(() => createText(ctx, { kind: 'heading', plane: ID.planeA, canvas: SEC.canvas2 }), /not both/)
    // A viewer: validate refuses.
    const v = validate([createText(ctx, { kind: 'heading', text: 'x' })], ctx.ws, CAROL)
    expect(v.ok).toBe(false)
  })
})

describe('update_text', () => {
  it('words and setting; null takes a field away; false is nothing; the label says which kind', () => {
    const ctx = ctxOf()
    const plan = updateText(ctx, { id: ID.heading, text: 'Who we really beat', kicker: null, bold: true, color: 'magenta', rotate: 90 })
    expect(plan).toMatchObject({ op: 'update_text', label: 'change a heading', meta: { kind: 'heading' } })
    const h = label(run(ctx, [plan]), ID.heading)
    expect(h).toMatchObject({ text: 'Who we really beat', bold: true, color: 'magenta', rotate: 90 })
    expect(h.kicker).toBeUndefined()
    const fold = updateText(ctx, { id: ID.note, folded: true, scale: 'small', w: 200 })
    expect(label(run(ctx, [fold]), ID.note)).toMatchObject({ folded: true, scale: 'small', w: 200 })
    expect(updateText(ctx, { id: ID.note, folded: false }).writes[0].patch!.folded).toEqual({ $delete: true })
    expect(updateText(ctx, { id: SEC.plane, side: 'left', h: 400, x: 500 }).writes[0].patch).toMatchObject({ side: 'left', h: 400, x: 500 })
    // Nothing to change: nothing written.
    expect(updateText(ctx, { id: ID.note }).writes).toEqual([])
  })

  it('refuses what the kind has not, and text that is not there', () => {
    const ctx = ctxOf()
    throwsRefused(() => updateText(ctx, { id: ID.note, rotate: 90 }), /has no rotate/)
    throwsRefused(() => updateText(ctx, { id: ID.heading, h: 10 }), /has no h/)
    throwsRefused(() => updateText(ctx, { id: ID.heading, w: -5 } as never), /has no w/)
    throwsRefused(() => updateText(ctx, { id: SEC.plane, w: 0 }), /above 0/)
    throwsRefused(() => updateText(ctx, { id: 'ghost', text: 'x' }), /no text ghost/)
  })
})

describe('delete (text)', () => {
  it('takes the text alone: a section leaves what it holds', () => {
    const ctx = ctxOf()
    const plan = deleteThings(ctx, { ids: [SEC.plane] })
    expect(plan).toMatchObject({ label: 'delete a section', meta: { kind: 'section' } })
    expect(plan.writes).toEqual([{ coll: 'labels', id: SEC.plane, del: true }])
    const ws = run(ctx, [plan])
    expect(ws.labels.some((l) => l.id === ID.note)).toBe(true)
    expect(deleteThings(ctx, { ids: [ID.note] }).label).toBe('delete a sticky note')
  })
})

describe('arrange', () => {
  it('a section on a plane carries the text and cards wholly inside it, by the same distance', () => {
    const ctx = ctxOf()
    const plan = arrange(ctx, { items: [SEC.plane], by: [50, 100] })
    expect(plan.label).toBe('move a section and what is in it')
    expect(plan.meta?.kind).toBe('section')
    const ws = run(ctx, [plan])
    expect(label(ws, SEC.plane)).toMatchObject({ x: 575, y: 100 })
    expect(label(ws, ID.note)).toMatchObject({ x: 650, y: 150 })
    expect(ws.cards.find((c) => c.id === ID.preorder)).toMatchObject({ x: 600, y: 325 })
    // What's not wholly inside stays.
    expect(ws.cards.find((c) => c.id === ID.barista)).toMatchObject({ x: 300, y: 50 })
    // carry: false moves the section alone.
    expect(arrange(ctx, { items: [SEC.plane], by: [50, 0], carry: false }).writes.map((w) => w.id)).toEqual([SEC.plane])
  })

  it('a section on the canvas carries its text and the pieces inside it (their spot), not the others', () => {
    const ctx = ctxOf()
    const plan = arrange(ctx, { to: [{ id: SEC.canvas, x: -50, y: -100 }] })
    const ws = run(ctx, [plan])
    expect(label(ws, ID.heading)).toMatchObject({ x: 0, y: 0 })
    expect(ws.pieces.find((p) => p.id === ID.planeA)).toMatchObject({ x: 0, y: 200 })
    expect(ws.pieces.find((p) => p.id === ID.deck)).toMatchObject({ x: 0, y: 700 })
    expect(plan.writes.map((w) => w.coll).sort()).toEqual(['labels', 'labels', 'pieces'])
  })

  it("moves a card's place on another plane, a piece's spot on another canvas; refuses what is not there", () => {
    const ctx = ctxOf()
    const p = arrange(ctx, { items: [ID.anna], plane: ID.planeB, by: [25, 0] })
    expect(p.writes).toEqual([{ coll: 'places', id: `${ID.planeB}_${ID.anna}`, patch: { x: 75, y: 300 } }])
    const s = arrange(ctx, { items: [ID.planeB], canvas: SEC.canvas2, by: [0, 25] })
    expect(s.writes).toEqual([{ coll: 'pieceSpots', id: `${SEC.canvas2}_${ID.planeB}`, patch: { x: 0, y: 25 } }])
    run(ctx, [p, s])
    throwsRefused(() => arrange(ctx, { items: ['ghost'], by: [1, 1] }), /no text, card or piece ghost/)
    throwsRefused(() => arrange(ctx, { items: [ID.queue], plane: ID.planeB, by: [1, 1] }), /isn't on plane/)
    throwsRefused(() => arrange(ctx, { items: [ID.note] }), /needs where things go/)
    throwsRefused(() => arrange(ctx, { items: [ID.note], by: [1] as never }), /two numbers/)
  })
})

describe('arrange carries what is folded in and a package\'s members', () => {
  // QR ordering gets a part, folded into it.
  const PART = 'feat0000000000000009'
  function foldedWs(folded: boolean) {
    const d = fixtureDocs()
    d.features.push({ id: PART, title: 'Scan at the table', pieceId: ID.planeB, x: 300, y: 500, createdAt: T, updatedAt: T })
    d.edges.push({ id: 'edge0000000000000009', fromId: PART, fromType: 'feature', toId: ID.qr, toType: 'feature', kind: 'part-of' })
    const qr = d.features.find((f) => f.id === ID.qr)!
    if (folded) qr.folded = true
    return wsFrom(d)
  }

  it('an unfolded package brings its members (and their parts)', () => {
    const ctx = ctxOf(foldedWs(false))
    const plan = arrange(ctx, { items: [ID.pkg], by: [100, 50] })
    expect(plan).toMatchObject({ label: 'move a package', meta: { kind: 'package' } })
    const ws = run(ctx, [plan])
    const at = (id: string) => ws.cards.find((c) => c.id === id)!
    expect(at(ID.pkg)).toMatchObject({ x: 400, y: 350 })
    expect(at(ID.qr)).toMatchObject({ x: 400, y: 100 })
    expect(at(ID.loyalty)).toMatchObject({ x: 650, y: 100 })
    expect(at(PART)).toMatchObject({ x: 400, y: 550 })
    // carry: false: the package alone.
    expect(arrange(ctx, { items: [ID.pkg], by: [100, 50], carry: false }).writes.map((w) => w.id)).toEqual([ID.pkg])
  })

  it('a folded card brings its parts; unfolded it moves alone', () => {
    const ctx = ctxOf(foldedWs(true))
    const plan = arrange(ctx, { items: [ID.qr], by: [0, 100] })
    expect(plan.label).toBe('move a card and its parts')
    const ws = run(ctx, [plan])
    expect(ws.cards.find((c) => c.id === PART)).toMatchObject({ x: 300, y: 600 })
    expect(arrange(ctxOf(foldedWs(false)), { items: [ID.qr], by: [0, 100] }).writes.map((w) => w.id)).toEqual([ID.qr])
  })
})

describe('registry and batches', () => {
  it('a section made round cards, then moved, in one batch by handle', () => {
    const ctx = ctxOf()
    const plans = buildBatch(ctx, [
      { op: 'create_text', args: { kind: 'section', plane: ID.planeA, text: 'Problems', around: [ID.queue, ID.menu], handle: '$s' } },
      { op: 'arrange', args: { items: ['$s'], by: [0, 200] } },
    ])
    const ws = run(ctx, plans)
    expect(ws.cards.find((c) => c.id === ID.queue)).toMatchObject({ y: 425 })
    expect(ws.cards.find((c) => c.id === ID.menu)).toMatchObject({ y: 425 })
    for (const name of ['create_text', 'update_text', 'arrange']) expect(REGISTRY.get(name)?.args.type).toBe('object')
    expect(REGISTRY.get('create_text')!.args.properties!.kind.enum).toEqual(['heading', 'paragraph', 'sticky', 'section', 'title'])
    expect(REGISTRY.get('update_text')!.args.properties!.kicker.type).toEqual(['string', 'null'])
    // Moving is arrange, sizing a resize op (S6): not in update_text's schema; no author in create_text's.
    for (const k of ['w', 'h', 'x', 'y']) expect(REGISTRY.get('update_text')!.args.properties).not.toHaveProperty(k)
    expect(REGISTRY.get('create_text')!.args.properties).not.toHaveProperty('author')
  })
})
