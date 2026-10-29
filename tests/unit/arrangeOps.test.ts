// S9's layouts (R10): arrange with layout + where on a crowded plane and a canvas, pure. No overlaps on five layouts ×
// three sizes; line up / space out equal the panel's maths; in a section it grows; what things carry rides along; a
// batch of creates beside one thing doesn't stack. Undo of an arrange plan through apply: tests/unit/apply.test.ts.
import { describe, expect, it } from 'vitest'
import { counterIds } from '../../src/ops/newId'
import { validate } from '../../src/ops/validate'
import { project } from '../../src/ops/project'
import { OpsRefused, type OpCtx, type Plan } from '../../src/ops/types'
import { arrangeAny } from '../../src/ops/arrange'
import { buildBatch, REGISTRY } from '../../src/ops/registry'
import { labelBox } from '../../src/model/labelBox'
import { CARD, type Card } from '../../src/model/cards'
import { cardsOn } from '../../src/model/placement'
import { foldsOf, packageBox } from '../../src/model/cardInside'
import { piecesShown } from '../../src/model/textPlace'
import { alignTo, spreadTo, type Box } from '../../src/model/layout'
import { snap } from '../../src/model/grid'
import type { WorkspaceCtx } from '../../src/state/wsStore'
import type { RawDoc } from '../../src/model/fromDocs'
import { ALICE, fixtureDocs, ID, T, wsFrom } from './fixtures/ws'

const NOW = T + 1000
const times = { createdAt: T, updatedAt: T }
const ctxOf = (ws: WorkspaceCtx): OpCtx => ({ ws, actor: ALICE, now: NOW, newId: counterIds('new') })
function run(ctx: OpCtx, plans: Plan[]) {
  expect(validate(plans, ctx.ws, ctx.actor)).toEqual({ ok: true })
  return project(ctx.ws, plans)
}

// A seeded random, so the scatter is the same every run.
function rand(seed: number) {
  let s = seed
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff)
}

const COLL: Record<string, string> = { customer: 'customers', problem: 'problems', idea: 'ideas', feature: 'features' }
const TYPES = ['customer', 'problem', 'idea', 'feature']
const STATUS = ['hypothesis', 'testing', 'validated']
const TAGS = ['smb', 'mobile', 'pay']

// The fixture with plane A crowded: 18 cards that stay in an uneven grid, two sticky notes, a paragraph, a section round
// some of them, and `n` cards to arrange scattered over it all (overlapping what's there); the canvas with 8 extra tables
// and `n` documents lists to arrange.
const PLANE_SECTION = 'labl0000000000000099'
function crowded(n: number) {
  const d = fixtureDocs()
  const r = rand(n * 7 + 3)
  const push = (type: string, doc: RawDoc) => (d as unknown as Record<string, RawDoc[]>)[COLL[type]].push(doc)
  for (let i = 0; i < 18; i++) push(TYPES[i % 4], { id: `stay${String(i).padStart(16, '0')}`, title: `stay ${i}`, pieceId: ID.planeA, x: 50 + (i % 6) * 275 + (i % 2) * 25, y: 400 + Math.floor(i / 6) * 175, ...times })
  d.labels.push(
    { id: 'labl0000000000000090', pieceId: ID.planeA, text: 'Remember the Sunday crowd', kind: 'sticky', x: 800, y: 225, uid: 'u-alice', author: 'Alice', ...times },
    { id: 'labl0000000000000091', pieceId: ID.planeA, text: 'Prices up in Q2', kind: 'sticky', x: 1200, y: 100, uid: 'u-alice', author: 'Alice', ...times },
    { id: 'labl0000000000000092', pieceId: ID.planeA, text: 'Mornings are the whole business.', size: 'note', w: 500, x: 1100, y: 975, ...times },
    { id: PLANE_SECTION, pieceId: ID.planeA, text: 'Later', kind: 'section', x: 1050, y: 0, w: 625, h: 350, ...times },
  )
  const items: string[] = []
  for (let i = 0; i < n; i++) {
    const id = `move${String(i).padStart(16, '0')}`
    items.push(id)
    push(TYPES[i % 4], { id, title: `move ${i}`, pieceId: ID.planeA, x: snap(r() * 1400), y: snap(r() * 900), tags: [TAGS[i % 3]], ...(i % 4 === 3 ? {} : { validation: STATUS[i % 3] }), ...times })
  }
  for (let i = 0; i < 8; i++) d.pieces.push({ id: `tabl${String(i).padStart(16, '0')}`, kind: 'table', x: -900 + (i % 4) * 900, y: 1300 + Math.floor(i / 4) * 500, w: 800, h: 400, name: `T${i}`, ...times })
  const pieces: string[] = []
  for (let i = 0; i < n; i++) {
    const id = `docs${String(i).padStart(16, '0')}`
    pieces.push(id)
    d.pieces.push({ id, kind: 'documents', x: snap(r() * 3000 - 1000), y: snap(r() * 2000), w: 800, h: 450, name: `D${i}`, ...times })
  }
  return { ws: wsFrom(d), items, pieces }
}

// What's drawn on a plane, as boxes: every card shown (a folded part none; an unfolded package its frame) and its text.
function planeBoxes(ws: WorkspaceCtx, plane: string) {
  const cards = cardsOn(ws.cards, ws.places, plane)
  const folds = foldsOf(cards, ws.edges)
  const out: (Box & { id: string; frame?: boolean })[] = []
  for (const c of cards) {
    if (folds.hidden.has(c.id)) continue
    if (c.type === 'package' && !c.folded) {
      const f = packageBox((folds.members.get(c.id) ?? []).map((m: Card) => ({ x: m.x, y: m.y, w: CARD.w, h: CARD.h })))
      if (f) out.push({ id: c.id, ...f, frame: true })
      continue
    }
    out.push({ id: c.id, x: c.x, y: c.y, w: CARD.w, h: CARD.h })
  }
  for (const l of ws.labels.filter((x) => x.pieceId === plane)) out.push({ id: l.id, ...labelBox(l), ...(l.kind === 'section' ? { frame: true } : {}) })
  return out
}
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const wholly = (a: Box, s: Box) => a.x >= s.x && a.y >= s.y && a.x + a.w <= s.x + s.w && a.y + a.h <= s.y + s.h
// Every pair (one of them moved) that overlaps; a section only when cut through.
function overlapsOf(boxes: (Box & { id: string; frame?: boolean })[], moved: Set<string>) {
  const bad: string[] = []
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i], boxes[j]]
      if (!moved.has(a.id) && !moved.has(b.id)) continue
      if (a.frame || b.frame) {
        const [f, o] = a.frame ? [a, b] : [b, a]
        if (hit(f, o) && !wholly(o, f) && !wholly(f, o)) bad.push(`${o.id} cuts ${f.id}`)
      } else if (hit(a, b)) bad.push(`${a.id} × ${b.id}`)
    }
  return bad
}
const onGrid = (ws: WorkspaceCtx, ids: string[]) => ids.every((id) => {
  const c = ws.cards.find((x) => x.id === id) ?? ws.pieces.find((x) => x.id === id)
  return c && c.x % 25 === 0 && c.y % 25 === 0
})

describe('arrange: layouts never overlap (5 layouts × 3 sizes, a crowded plane)', () => {
  const LAYOUTS = [
    { layout: 'grid' as const },
    { layout: 'row' as const },
    { layout: 'column' as const },
    { layout: 'cluster' as const, headings: true },
    { layout: 'grid' as const, where: { near: ID.anna }, near: true },
  ]
  for (const n of [3, 12, 40])
    for (const args of LAYOUTS)
      it(`${args.layout}${'near' in args ? ' near a card' : ''} of ${n} cards`, () => {
        const { ws, items } = crowded(n)
        const ctx = ctxOf(ws)
        const { near: _near, ...given } = args as typeof args & { near?: boolean }
        const plan = arrangeAny(ctx, { items, plane: ID.planeA, ...given })
        const after = run(ctx, [plan])
        const moved = new Set([...items, ...(plan.meta?.ids ?? [])])
        expect(overlapsOf(planeBoxes(after, ID.planeA), moved)).toEqual([])
        expect(onGrid(after, items)).toBe(true)
        // Nothing that stays moved.
        for (const c of ws.cards.filter((x) => !moved.has(x.id))) expect(after.cards.find((x) => x.id === c.id)).toMatchObject({ x: c.x, y: c.y })
        // Laid out as said: a row on one line, a column on one x, a grid within the plane's width when it fits.
        const placed = items.map((id) => after.cards.find((c) => c.id === id)!)
        if (args.layout === 'row') expect(new Set(placed.map((c) => c.y)).size).toBe(1)
        if (args.layout === 'column') expect(new Set(placed.map((c) => c.x)).size).toBe(1)
        if (args.layout === 'grid' && !('near' in args)) expect(Math.max(...placed.map((c) => c.x + CARD.w)) - Math.min(...placed.map((c) => c.x))).toBeLessThanOrEqual(960 - 100)
        if (args.layout === 'cluster') expect(plan.meta?.ids?.length).toBe(Math.min(n, 4))
      })

  it('a canvas: pieces in a grid, a row and beside a plane, clear of every piece and the text there', () => {
    for (const n of [3, 12, 40])
      for (const args of [{ layout: 'grid' as const }, { layout: 'row' as const }, { layout: 'grid' as const, where: { near: ID.planeB } }, { layout: 'cluster' as const }, { layout: 'column' as const }]) {
        const { ws, pieces } = crowded(n)
        const ctx = ctxOf(ws)
        const plan = arrangeAny(ctx, { items: pieces, ...args })
        const after = run(ctx, [plan])
        const boxes = [...piecesShown('main', after.pieces, after.spots).map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h })), ...after.labels.filter((l) => l.pieceId === 'canvas').map((l) => ({ id: l.id, ...labelBox(l) }))]
        expect(overlapsOf(boxes, new Set(pieces)), `${args.layout} ${n}`).toEqual([])
        expect(onGrid(after, pieces)).toBe(true)
      }
  })

  it('a plane carries what is stuck to it; the block keeps clear of it', () => {
    const { ws } = crowded(3)
    const ctx = ctxOf(ws)
    // Plane A with its deck (stuck) and the matrix, in a row.
    const plan = arrangeAny(ctx, { items: [ID.planeA, ID.matrix], layout: 'row' })
    const after = run(ctx, [plan])
    const [a0, d0] = [ws.pieces.find((p) => p.id === ID.planeA)!, ws.pieces.find((p) => p.id === ID.deck)!]
    const [a1, d1] = [after.pieces.find((p) => p.id === ID.planeA)!, after.pieces.find((p) => p.id === ID.deck)!]
    expect([d1.x - a1.x, d1.y - a1.y]).toEqual([d0.x - a0.x, d0.y - a0.y])
    const boxes = piecesShown('main', after.pieces, after.spots).map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h }))
    expect(overlapsOf(boxes, new Set([ID.planeA, ID.matrix, ID.deck]))).toEqual([])
  })
})

describe('arrange: line up and space out', () => {
  it('equal the panel maths when nothing is in the way', () => {
    const d = fixtureDocs()
    // Three cards far apart, alone on plane B's empty bottom.
    const ids = ['idea0000000000000091', 'idea0000000000000092', 'idea0000000000000093']
    const spots = [
      [100, 800],
      [400, 1000],
      [700, 1225],
    ]
    ids.forEach((id, i) => d.ideas.push({ id, title: `i${i}`, pieceId: ID.planeB, x: spots[i][0], y: spots[i][1], ...times }))
    const ws = wsFrom(d)
    const ctx = ctxOf(ws)
    const boxes = ids.map((id, i) => ({ id, x: spots[i][0], y: spots[i][1], w: CARD.w, h: CARD.h }))
    for (const layout of ['align-left', 'align-centre', 'align-right', 'align-top', 'align-middle', 'align-bottom', 'spread-x', 'spread-y'] as const) {
      const want = layout.startsWith('align') ? alignTo(boxes, layout as never) : spreadTo(boxes, layout === 'spread-y' ? 'y' : 'x')
      // The panel's own words (CardPanel.tsx' ManyInside): left = min x; centre = (l + r) / 2 − w / 2; spread evenly.
      if (layout === 'align-left') expect([...want.values()].map((s) => s.x)).toEqual([100, 100, 100])
      if (layout === 'align-centre') expect([...want.values()].map((s) => s.x)).toEqual([400, 400, 400])
      if (layout === 'spread-x') expect([...want.values()].map((s) => s.x)).toEqual([100, 400, 700])
      const plan = arrangeAny(ctx, { items: ids, layout })
      expect(plan.label).toMatch(layout.startsWith('align') ? /^line up 3 things$/ : /^space out 3 things$/)
      const after = run(ctx, [plan])
      for (const id of ids) expect(after.cards.find((c) => c.id === id), layout).toMatchObject(want.get(id)!)
    }
  })

  it('things lined up on top of each other step apart the other way, never overlapping', () => {
    const { ws, items } = crowded(12)
    const ctx = ctxOf(ws)
    for (const layout of ['align-left', 'spread-x'] as const) {
      const after = run(ctx, [arrangeAny(ctx, { items, layout })])
      expect(overlapsOf(planeBoxes(after, ID.planeA), new Set(items)), layout).toEqual([])
    }
    // Twelve lined up along the top would step apart past the plane's right edge: refused, not run off the plane.
    expect(() => arrangeAny(ctx, { items, layout: 'align-top' })).toThrow(/past the plane's right edge/)
  })
})

describe('arrange: where', () => {
  it('in a section: inside it, which grows to hold them (one plan)', () => {
    const { ws: crowd, items } = crowded(12)
    // The section on open ground right of everything, so it has room to grow.
    const ws = { ...crowd, labels: crowd.labels.map((l) => (l.id === PLANE_SECTION ? { ...l, x: 1750 } : l)) }
    const ctx = ctxOf(ws)
    const plan = arrangeAny(ctx, { items, layout: 'grid', where: { in_section: PLANE_SECTION } })
    const after = run(ctx, [plan])
    const sec = after.labels.find((l) => l.id === PLANE_SECTION)!
    expect(sec.h).toBeGreaterThan(350)
    for (const id of items) expect(wholly({ ...after.cards.find((c) => c.id === id)!, w: CARD.w, h: CARD.h }, labelBox(sec))).toBe(true)
    expect(plan.writes.some((w) => w.id === PLANE_SECTION && w.patch?.h)).toBe(true)
    expect(overlapsOf(planeBoxes(after, ID.planeA), new Set(items))).toEqual([])
    // Arranged again: the section now holds them, nothing grows, they stay.
    const again = arrangeAny(ctxOf(after), { items, layout: 'grid', where: { in_section: PLANE_SECTION } })
    expect(again.writes).toEqual([])
  })

  it("near with a side; at: 'clear' takes the first clear area; left out, the block keeps its top-left when clear", () => {
    const { ws, items } = crowded(3)
    const ctx = ctxOf(ws)
    const anna = ws.cards.find((c) => c.id === ID.anna)!
    const below = run(ctx, [arrangeAny(ctx, { items, layout: 'row', where: { near: ID.anna, side: 'below' } })])
    const ys = items.map((id) => below.cards.find((c) => c.id === id)!.y)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(anna.y + CARD.h + 50)
    const clear = run(ctx, [arrangeAny(ctx, { items, where: { at: 'clear' } })])
    expect(overlapsOf(planeBoxes(clear, ID.planeA), new Set(items))).toEqual([])
    // On plane B's empty bottom: stays there.
    const d = fixtureDocs()
    d.ideas.push({ id: 'idea0000000000000091', title: 'a', pieceId: ID.planeB, x: 100, y: 800, ...times }, { id: 'idea0000000000000092', title: 'b', pieceId: ID.planeB, x: 700, y: 1100, ...times })
    const ws2 = wsFrom(d)
    const kept = run(ctxOf(ws2), [arrangeAny(ctxOf(ws2), { items: ['idea0000000000000091', 'idea0000000000000092'], layout: 'row' })])
    expect(kept.cards.find((c) => c.id === 'idea0000000000000091')).toMatchObject({ x: 100, y: 800 })
    expect(kept.cards.find((c) => c.id === 'idea0000000000000092')).toMatchObject({ x: 350, y: 800 })
  })

  it('cluster groups by type, tag, status or given groups, in the chain order, headings over them', () => {
    const { ws, items } = crowded(12)
    const ctx = ctxOf(ws)
    const plan = arrangeAny(ctx, { items, layout: 'cluster', headings: true })
    const after = run(ctx, [plan])
    const heads = plan.meta!.ids!.map((id) => after.labels.find((l) => l.id === id)!)
    expect(heads.map((h) => h.text)).toEqual(['Customers', 'Problems', 'Ideas', 'Features'])
    expect(heads.every((h) => h.size === 'minor' && h.pieceId === ID.planeA)).toBe(true)
    // In reading order (bands of groups wrap within the plane).
    const order = heads.map((h) => h.y * 10000 + h.x)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    const byTag = arrangeAny(ctx, { items, layout: 'cluster', group_by: 'tag', headings: true })
    expect(byTag.writes.filter((w) => w.set).map((w) => w.set!.text)).toEqual(['#mobile', '#pay', '#smb'])
    const byStatus = arrangeAny(ctx, { items, layout: 'cluster', group_by: 'status', headings: true })
    expect(byStatus.writes.filter((w) => w.set).map((w) => w.set!.text)).toEqual(['Hypothesis', 'Testing', 'Validated', 'No status'])
    const given = arrangeAny(ctx, { items, layout: 'cluster', group_by: [{ name: 'Now', items: items.slice(0, 2) }], headings: true })
    expect(given.writes.filter((w) => w.set).map((w) => w.set!.text)).toEqual(['Now', 'Other'])
    // Without headings: no text made.
    expect(arrangeAny(ctx, { items, layout: 'cluster' }).writes.some((w) => w.set)).toBe(false)
  })

  it('a package rides with its frame; a folded part rides with its card; parts named alone are left to their holder', () => {
    const d = fixtureDocs()
    // QR's part, folded into it.
    d.features.push({ id: 'feat0000000000000009', title: 'QR part', pieceId: ID.planeB, x: 800, y: 400, ...times })
    d.edges.push({ id: 'edge0000000000000009', fromId: 'feat0000000000000009', fromType: 'feature', toId: ID.qr, toType: 'feature', kind: 'part-of' })
    const ws = wsFrom(d)
    const ctx = ctxOf(ws)
    // The package (unfolded: its members ride along) and the competitor, in a column beside Anna's place on B.
    const plan = arrangeAny(ctx, { items: [ID.pkg, ID.orderly, ID.qr, 'feat0000000000000009'], layout: 'column' })
    const after = run(ctx, [plan])
    const was = (id: string) => ws.cards.find((c) => c.id === id)!
    const now = (id: string) => after.cards.find((c) => c.id === id)!
    // QR and loyalty move with the package by one distance.
    const dPkg = [now(ID.pkg).x - was(ID.pkg).x, now(ID.pkg).y - was(ID.pkg).y]
    expect([now(ID.qr).x - was(ID.qr).x, now(ID.qr).y - was(ID.qr).y]).toEqual(dPkg)
    expect([now(ID.loyalty).x - was(ID.loyalty).x, now(ID.loyalty).y - was(ID.loyalty).y]).toEqual(dPkg)
    expect(overlapsOf(planeBoxes(after, ID.planeB), new Set([ID.pkg, ID.orderly, ID.qr, ID.loyalty, 'feat0000000000000009']))).toEqual([])
  })

  it('refuses what it cannot do, with a fix', () => {
    const { ws, items } = crowded(3)
    const ctx = ctxOf(ws)
    const refused = (args: Parameters<typeof arrangeAny>[1], re: RegExp) => {
      try {
        arrangeAny(ctx, args)
      } catch (e) {
        expect(e).toBeInstanceOf(OpsRefused)
        expect((e as OpsRefused).errors[0].message).toMatch(re)
        return
      }
      throw new Error('did not refuse')
    }
    refused({ items, layout: 'near' as never }, /where, not a layout/)
    refused({ items: [...items, ID.planeB], layout: 'grid' }, /more than one space/)
    refused({ items, layout: 'grid', by: [1, 1] }, /places things itself/)
    refused({ items, layout: 'align-left', where: { at: 'clear' } }, /keeps things where/)
    refused({ items, layout: 'grid', where: { near: items[0] } }, /one of the things moving/)
    refused({ items, layout: 'grid', where: { in_section: ID.note } }, /isn't a section/)
    refused({ items, layout: 'diagonal' as never }, /isn't a layout/)
  })

  it('by still works through the registry, and so do layouts', () => {
    const { ws, items } = crowded(3)
    const ctx = ctxOf(ws)
    const def = REGISTRY.get('arrange')!
    expect(def.build(ctx, { items: [ID.anna], by: [25, 0] }).writes[0].patch).toMatchObject({ x: 75, y: 50 })
    expect(def.build(ctx, { items, layout: 'row' }).label).toBe('arrange 3 things in a row')
  })
})

describe('creates in one batch beside one thing do not stack', () => {
  it('five cards, five sticky notes, three pieces near the same thing', () => {
    const { ws } = crowded(3)
    const ctx = ctxOf(ws)
    const plans = buildBatch(ctx, [
      ...Array.from({ length: 5 }, (_, i) => ({ op: 'create_card', args: { type: 'idea', plane: ID.planeA, title: `n${i}`, where: { near: ID.anna } } })),
      ...Array.from({ length: 5 }, (_, i) => ({ op: 'create_text', args: { kind: 'sticky', plane: ID.planeA, text: `s${i}`, where: { near: ID.anna } } })),
      ...Array.from({ length: 3 }, () => ({ op: 'create_piece', args: { kind: 'table', canvas: 'main', where: { near: ID.planeB } } })),
    ])
    const after = run(ctx, plans)
    const made = new Set(plans.flatMap((p) => Object.values(p.ids)))
    const cards = after.cards.filter((c) => made.has(c.id)).map((c) => ({ id: c.id, x: c.x, y: c.y, w: CARD.w, h: CARD.h }))
    const notes = after.labels.filter((l) => made.has(l.id)).map((l) => ({ id: l.id, ...labelBox(l) }))
    // The new cards and notes don't overlap each other; the notes don't overlap any card or text there.
    expect(overlapsOf([...cards, ...notes], made).filter((x) => !x.includes('stay') && !x.includes('move'))).toEqual([])
    const pieces = after.pieces.filter((p) => made.has(p.id))
    expect(pieces).toHaveLength(3)
    expect(overlapsOf(piecesShown('main', after.pieces, after.spots).map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h })), made)).toEqual([])
  })
})

describe('arrange: review fixes (sections, packages, headings, wrapping)', () => {
  const sectionWs = (extra: (d: ReturnType<typeof fixtureDocs>) => void) => {
    const d = fixtureDocs()
    // Plane B's empty bottom: a section, and ten ideas to put in it, scattered on plane B's right.
    d.labels.push({ id: 'labl0000000000000080', pieceId: ID.planeB, text: 'Bets', kind: 'section', x: 50, y: 500, w: 500, h: 300, ...times })
    for (let i = 0; i < 10; i++) d.ideas.push({ id: `idea00000000000001${String(i).padStart(2, '0')}`, title: `bet ${i}`, pieceId: ID.planeB, x: 2000 + i * 25, y: 2000 + i * 125, ...times })
    extra(d)
    return wsFrom(d)
  }
  const bets = Array.from({ length: 10 }, (_, i) => `idea00000000000001${String(i).padStart(2, '0')}`)

  it('in_section refuses rather than swallow a card just under the section, or one straddling its edge', () => {
    const under = sectionWs((d) => d.features.push({ id: 'feat0000000000000077', title: 'under', pieceId: ID.planeB, x: 100, y: 850, ...times }))
    expect(() => arrangeAny(ctxOf(under), { items: bets, where: { in_section: 'labl0000000000000080' } })).toThrow(/no room for them/)
    const straddle = sectionWs((d) => d.features.push({ id: 'feat0000000000000077', title: 'edge', pieceId: ID.planeB, x: 200, y: 750, ...times }))
    expect(() => arrangeAny(ctxOf(straddle), { items: bets, where: { in_section: 'labl0000000000000080' } })).toThrow(/no room for them/)
    // With nothing under it, it grows.
    const free = sectionWs(() => {})
    const plan = arrangeAny(ctxOf(free), { items: bets, where: { in_section: 'labl0000000000000080' } })
    expect(plan.writes.some((w) => w.id === 'labl0000000000000080' && w.patch?.h)).toBe(true)
  })

  it("a row in a section wraps at the plane's right edge; the block starts under the name strip", () => {
    const ws = sectionWs(() => {})
    const after = run(ctxOf(ws), [arrangeAny(ctxOf(ws), { items: bets, layout: 'row', where: { in_section: 'labl0000000000000080' } })])
    const sec = after.labels.find((l) => l.id === 'labl0000000000000080')!
    const placed = bets.map((id) => after.cards.find((c) => c.id === id)!)
    expect(new Set(placed.map((c) => c.y)).size).toBeGreaterThan(1)
    // Plane B is 960 wide: three to a row from x 100, the section grown sideways to hold them.
    expect(Math.max(...placed.map((c) => c.x + CARD.w))).toBeLessThanOrEqual(960 - 25)
    expect(new Set(placed.map((c) => c.x)).size).toBe(3)
    expect(sec.w).toBeGreaterThan(500)
    expect(Math.min(...placed.map((c) => c.y))).toBeGreaterThanOrEqual(sec.y + 75)
    // A column wraps at the plane's bottom (600): more than one x.
    const col = run(ctxOf(ws), [arrangeAny(ctxOf(ws), { items: bets, layout: 'column', where: { in_section: 'labl0000000000000080' } })])
    expect(new Set(bets.map((id) => col.cards.find((c) => c.id === id)!.x)).size).toBeGreaterThan(1)
  })

  it('sections nobody named are solid: a cluster with headings beside a section never lands in it or on its name', () => {
    const ws = sectionWs((d) => d.labels.push({ id: 'labl0000000000000081', pieceId: ID.planeB, text: 'Kept', kind: 'section', x: 600, y: 500, w: 350, h: 300, ...times }))
    const plan = arrangeAny(ctxOf(ws), { items: bets, layout: 'cluster', headings: true, where: { near: 'labl0000000000000080', side: 'right' } })
    const after = run(ctxOf(ws), [plan])
    const kept = labelBox(after.labels.find((l) => l.id === 'labl0000000000000081')!)
    const bet = labelBox(after.labels.find((l) => l.id === 'labl0000000000000080')!)
    for (const id of bets) {
      const c = after.cards.find((x) => x.id === id)!
      for (const s of [kept, bet]) expect(hit({ x: c.x, y: c.y, w: CARD.w, h: CARD.h }, s)).toBe(false)
    }
    for (const id of plan.meta!.ids!) {
      const h = labelBox(after.labels.find((l) => l.id === id)!)
      for (const s of [kept, bet]) expect(hit(h, s)).toBe(false)
    }
    // The headings by handle.
    expect(Object.keys(plan.ids)).toEqual(['$heading1'])
    expect(plan.ids.$heading1).toBe(plan.meta!.ids![0])
    expect(Object.keys(arrangeAny(ctxOf(ws), { items: bets, layout: 'cluster', headings: true, handle: '$g' }).ids)).toEqual(['$g_heading1'])
  })

  it("sticky notes cluster under 'Notes'", () => {
    const d = fixtureDocs()
    d.labels.push({ id: 'labl0000000000000070', pieceId: ID.planeB, text: 'a', kind: 'sticky', x: 100, y: 800, uid: 'u-alice', ...times })
    const ws = wsFrom(d)
    const plan = arrangeAny(ctxOf(ws), { items: ['labl0000000000000070', ID.orderly], layout: 'cluster', headings: true })
    expect(plan.writes.filter((w) => w.set).map((w) => w.set!.text)).toEqual(['Competitors', 'Notes'])
  })

  it('a member of an unfolded package is not moved out alone', () => {
    const ws = wsFrom(fixtureDocs())
    expect(() => arrangeAny(ctxOf(ws), { items: [ID.qr], where: { at: 'clear' } })).toThrow(/in package/)
    // With its package: fine (it rides along).
    expect(() => arrangeAny(ctxOf(ws), { items: [ID.qr, ID.pkg], where: { at: 'clear' } })).not.toThrow()
  })
})
