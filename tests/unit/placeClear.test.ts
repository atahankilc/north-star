// Where the app puts new cards and packages (S11 fix round, docs/specs/agent.md §2 point 4, §4.4): create_card without
// `where` or with `near` lands clear of everything on the plane (cards, text, package frames, sections as frames), and a
// new package whose frame would cut a neighbour moves clear with its members as one, in the same plan.
import { describe, expect, it } from 'vitest'
import { counterIds } from '../../src/ops/newId'
import { validate } from '../../src/ops/validate'
import { project } from '../../src/ops/project'
import type { OpCtx, Plan } from '../../src/ops/types'
import { createCard, createPackage } from '../../src/ops/cards'
import { sceneOf } from '../../src/ops/arrange'
import { CARD } from '../../src/model/cards'
import { labelBox } from '../../src/model/labelBox'
import { kindOf } from '../../src/model/labels'
import { cardsOn } from '../../src/model/placement'
import { clashes, overlap, within, type Box } from '../../src/model/layout'
import { kindOfPiece } from '../../src/model/pieces'
import type { WorkspaceCtx } from '../../src/state/wsStore'
import { ALICE, fixtureDocs, ID, T, wsFrom } from './fixtures/ws'
import { mediumWs } from './fixtures/workspaces'

const ctxOf = (ws: WorkspaceCtx): OpCtx => ({ ws, actor: ALICE, now: T + 1000, newId: counterIds('new') })
const run = (ctx: OpCtx, plans: Plan[]) => {
  expect(validate(plans, ctx.ws, ctx.actor)).toEqual({ ok: true })
  return project(ctx.ws, plans)
}

// The medium read fixture as an ops snapshot (as evals/fixtures does it).
function medium(): WorkspaceCtx {
  const r = mediumWs()
  const roles = (r.workspace?.roles ?? {}) as Record<string, string>
  const owner = Object.keys(roles).find((u) => roles[u] === 'owner') ?? ''
  const workspace = { id: r.wid ?? 'ws', name: r.workspace?.name ?? 'W', ownerId: owner, memberIds: r.workspace?.memberIds ?? [], roles, inviteCode: 'EVAL00', createdAt: 0 }
  return { ...r, wid: workspace.id, workspace, canvas: r.canvas ?? 'main' } as unknown as WorkspaceCtx
}
const planesOf = (ws: WorkspaceCtx) => ws.pieces.filter((p) => kindOfPiece(p) === 'plane').map((p) => p.id)

// A new card's box against every other thing on the plane, read straight from the data: text by labelBox (sections as
// frames: wholly inside or clear), other cards as arrange draws them (folded heights, package frames).
function clearOfAll(ws: WorkspaceCtx, plane: string, id: string): string[] {
  const c = cardsOn(ws.cards, ws.places, plane).find((x) => x.id === id)!
  const box: Box = { x: c.x, y: c.y, w: CARD.w, h: CARD.h }
  const bad: string[] = []
  for (const l of ws.labels.filter((x) => x.pieceId === plane)) {
    const b = labelBox(l)
    if (kindOf(l) === 'section' ? overlap(box, b) && !within(box, b) : overlap(box, b)) bad.push(`${kindOf(l)} ${l.id}`)
  }
  const scene = sceneOf(ctxOf(ws), { plane, canvas: '' })
  for (const t of scene.things) if (t.kind === 'card' && t.id !== id && t.shown && overlap(box, t.shown) && !(t.card?.type === 'package' && within(box, t.shown))) bad.push(`card ${t.id}`)
  return bad
}

// The fixture's first plane crowded with text where cards would go: a sticky note, a heading and a paragraph in the
// first free row, and a section (its name strip on top) round the right.
function crowded(): WorkspaceCtx {
  const d = fixtureDocs()
  const times = { createdAt: T, updatedAt: T }
  d.labels.push(
    { id: 'lablCrowd00000000001', pieceId: ID.planeA, text: 'Loose ends', kind: 'sticky', x: 50, y: 375, ...times },
    { id: 'lablCrowd00000000002', pieceId: ID.planeA, text: 'Who pays', size: 'heading', x: 225, y: 375, ...times },
    { id: 'lablCrowd00000000003', pieceId: ID.planeA, text: 'A long paragraph about the morning rush and what it costs.', size: 'note', w: 300, x: 50, y: 525, ...times },
    { id: 'lablCrowd00000000004', pieceId: ID.planeA, text: 'Later', kind: 'section', x: 525, y: 350, w: 400, h: 225, ...times },
  )
  return wsFrom(d)
}

describe('create_card finds room clear of everything', () => {
  it('with no where, on a plane crowded with text: clear of every box', () => {
    const ctx = ctxOf(crowded())
    const plans: Plan[] = []
    let ws = ctx.ws
    for (let i = 0; i < 6; i++) {
      const c = { ...ctxOf(ws), newId: counterIds(`n${i}`) }
      const p = createCard(c, { type: 'idea', plane: ID.planeA, title: `Idea ${i}` })
      ws = run(c, [p])
      plans.push(p)
      expect(clearOfAll(ws, ID.planeA, p.ids.$new)).toEqual([])
    }
  })

  it('near a card: beside it, nudged clear of the text there', () => {
    const d = fixtureDocs()
    // A sticky note right of the problem where the card would go.
    d.labels.push({ id: 'lablCrowd00000000005', pieceId: ID.planeA, text: 'Ask about Sundays', kind: 'sticky', x: 300, y: 225, createdAt: T, updatedAt: T })
    d.problems = d.problems.filter((p) => p.id !== ID.menu)
    const ctx = ctxOf(wsFrom(d))
    const p = createCard(ctx, { type: 'idea', plane: ID.planeA, where: { near: ID.queue } })
    const ws = run(ctx, [p])
    expect(clearOfAll(ws, ID.planeA, p.ids.$new)).toEqual([])
    const c = ws.cards.find((x) => x.id === p.ids.$new)!
    // Still near it.
    expect(Math.hypot(c.x - 300, c.y - 225)).toBeLessThan(400)
  })

  it('its parts land clear too', () => {
    const ctx = ctxOf(crowded())
    const p = createCard(ctx, { type: 'feature', plane: ID.planeA, title: 'Pickup', parts: ['Slot', 'Reminder', 'Receipt'] })
    const ws = run(ctx, [p])
    for (const k of ['$new', '$new.part1', '$new.part2', '$new.part3']) expect(clearOfAll(ws, ID.planeA, p.ids[k])).toEqual([])
  })

  it('on every plane of the medium fixture, with no where and near its first card', () => {
    const base = medium()
    for (const plane of planesOf(base)) {
      const ctx = ctxOf(base)
      const a = createCard(ctx, { type: 'idea', plane, title: 'Free spot' })
      expect(clearOfAll(run(ctx, [a]), plane, a.ids.$new)).toEqual([])
      const first = cardsOn(base.cards, base.places, plane).find((c) => c.type !== 'package')
      if (!first) continue
      const ctx2 = ctxOf(base)
      const b = createCard(ctx2, { type: 'idea', plane, title: 'Beside', where: { near: first.id } })
      expect(clearOfAll(run(ctx2, [b]), plane, b.ids.$new)).toEqual([])
    }
  })

  it("the UI's explicit spots are unchanged: x/y as given, `at` moved right past cards only", () => {
    const ctx = ctxOf(crowded())
    const xy = createCard(ctx, { type: 'idea', plane: ID.planeA, where: { x: 60, y: 380 } })
    expect(xy.writes[0].set).toMatchObject({ x: 60, y: 380 })
    // Centred on (150, 425): (50, 375), on the sticky note, which the UI's drop doesn't look at.
    const at = createCard(ctx, { type: 'idea', plane: ID.planeA, where: { at: [150, 425] } })
    expect(at.writes[0].set).toMatchObject({ x: 50, y: 375 })
  })
})

describe('create_package never cuts a neighbour', () => {
  // The fixture with the menu card one grid step right of the queue card: a package round the queue would cut it.
  function tight() {
    const d = fixtureDocs()
    d.problems = d.problems.map((p) => (p.id === ID.menu ? { ...p, x: 275 } : p))
    return wsFrom(d)
  }
  const frameOf = (ws: WorkspaceCtx, plane: string, id: string) => sceneOf(ctxOf(ws), { plane, canvas: '' }).things.find((t) => t.id === id)!.shown!

  it('moves the members clear as one, in the same plan', () => {
    const ctx = ctxOf(tight())
    const p = createPackage(ctx, { cards: [ID.queue] })
    const ws = run(ctx, [p])
    const id = p.ids.$new
    const scene = sceneOf(ctxOf(ws), { plane: ID.planeA, canvas: '' })
    const frame = frameOf(ws, ID.planeA, id)
    expect(clashes([frame], scene.obstacles(new Set([id, ID.queue])))).toBe(false)
    // The neighbour stayed, the member moved, the package's own spot went with it (into the doc it makes).
    expect(ws.cards.find((c) => c.id === ID.menu)).toMatchObject({ x: 275, y: 225 })
    const q = ws.cards.find((c) => c.id === ID.queue)!
    expect([q.x, q.y]).not.toEqual([50, 225])
    expect(ws.cards.find((c) => c.id === id)).toMatchObject({ x: q.x, y: q.y })
    expect(p.writes.filter((w) => w.coll === 'packages')).toHaveLength(1)
    expect(p.writes.map((w) => `${w.coll}/${w.id}`).sort()).toEqual([`packages/${id}`, `problems/${ID.queue}`].sort())
  })

  it('two members keep their places relative to each other', () => {
    const d = fixtureDocs()
    d.problems = d.problems.map((p) => (p.id === ID.menu ? { ...p, x: 275, y: 225 } : p))
    d.customers = d.customers.map((c) => (c.id === ID.anna ? { ...c, x: 50, y: 375 } : c))
    const ctx = ctxOf(wsFrom(d))
    const p = createPackage(ctx, { cards: [ID.queue, ID.anna] })
    const ws = run(ctx, [p])
    const [q, a] = [ID.queue, ID.anna].map((id) => ws.cards.find((c) => c.id === id)!)
    expect([a.x - q.x, a.y - q.y]).toEqual([0, 150])
    const scene = sceneOf(ctxOf(ws), { plane: ID.planeA, canvas: '' })
    expect(clashes([frameOf(ws, ID.planeA, p.ids.$new)], scene.obstacles(new Set([p.ids.$new, ID.queue, ID.anna])))).toBe(false)
  })

  it('stays where it is when its frame is clear', () => {
    const ctx = ctxOf(wsFrom(fixtureDocs()))
    const p = createPackage(ctx, { cards: [ID.queue] })
    expect(p.writes).toHaveLength(1)
    expect(p.writes[0].set).toMatchObject({ x: 50, y: 225 })
  })

  it('every one-card package on the medium fixture: no frame cuts anything', () => {
    const base = medium()
    let made = 0
    for (const plane of planesOf(base)) {
      const scene0 = sceneOf(ctxOf(base), { plane, canvas: '' })
      for (const t of scene0.things) {
        if (t.kind !== 'card' || !t.shown || t.card!.type === 'package' || scene0.packageHolding(t.id)) continue
        const ctx = ctxOf(base)
        const p = createPackage(ctx, { cards: [t.id], plane })
        const ws = run(ctx, [p])
        const scene = sceneOf(ctxOf(ws), { plane, canvas: '' })
        const id = p.ids.$new
        const frame = scene.things.find((x) => x.id === id)!.shown!
        // What it holds: the card, and its parts (a member brings them).
        const moving = new Set([id, ...scene.carries(id)])
        expect(clashes([frame], scene.obstacles(moving)), `${plane} ${t.id}`).toBe(false)
        made++
      }
    }
    expect(made).toBeGreaterThan(50)
  })
})
