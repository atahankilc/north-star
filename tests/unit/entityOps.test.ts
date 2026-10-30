// S4's entity ops on the fixture workspace, pure: each op's plan validated and projected (valid, refused with a fix,
// cascades), batches with handles, and the registry. Undo of the same plans through apply: tests/unit/wrappers.test.ts.
import { describe, expect, it } from 'vitest'
import { counterIds } from '../../src/ops/newId'
import { validate } from '../../src/ops/validate'
import { project } from '../../src/ops/project'
import { OpsRefused, type OpCtx, type Plan } from '../../src/ops/types'
import { createCard, createPackage, deleteThings, duplicate, updateCard } from '../../src/ops/cards'
import { link, unlink, updateLink } from '../../src/ops/edges'
import { createEvidence, updateEvidence } from '../../src/ops/evidence'
import { createCompetitorFeature, updateCompetitorFeature } from '../../src/ops/features'
import { placeOn, placeOnPlan, takeOff, takeOffPlan } from '../../src/ops/places'
import { OPS, REGISTRY, buildBatch } from '../../src/ops/registry'
import { CARD } from '../../src/model/cards'
import { overlaps } from '../../src/model/placement'
import type { WorkspaceCtx } from '../../src/state/wsStore'
import { ALICE, fixtureWs, ID, T } from './fixtures/ws'

const NOW = T + 1000
const ctxOf = (ws: WorkspaceCtx = fixtureWs()): OpCtx => ({ ws, actor: ALICE, now: NOW, newId: counterIds('new') })

// Validated, then projected.
function run(ctx: OpCtx, plans: Plan[]) {
  const v = validate(plans, ctx.ws, ctx.actor)
  expect(v).toEqual({ ok: true })
  return project(ctx.ws, plans)
}
const refused = (ctx: OpCtx, plans: Plan[]) => {
  const v = validate(plans, ctx.ws, ctx.actor)
  expect(v.ok).toBe(false)
  if (v.ok) throw new Error('not refused')
  for (const e of v.errors) expect(e.fix.length).toBeGreaterThan(3)
  return v.errors
}
const throwsRefused = (f: () => unknown, re: RegExp) => {
  try {
    f()
  } catch (e) {
    expect(e).toBeInstanceOf(OpsRefused)
    expect((e as OpsRefused).errors[0].message).toMatch(re)
    expect((e as OpsRefused).errors[0].fix).toBeTruthy()
    return
  }
  throw new Error('did not refuse')
}
// Every id a plan says it made is new: undo deletes what a step made, so an existing id there would be lost.
const onlyNewIds = (ws: WorkspaceCtx, plans: Plan[]) => {
  const old = new Set([...ws.cards, ...ws.edges, ...ws.evidence, ...ws.places, ...ws.labels, ...ws.competitorFeatures, ...ws.comparisons].map((x) => x.id))
  for (const p of plans) for (const id of Object.values(p.ids)) expect(old.has(id)).toBe(false)
}

describe('create_card', () => {
  it('makes a whole card in one plan: title, fields, links, parts, evidence; at a clear spot', () => {
    const ctx = ctxOf()
    const plan = createCard(ctx, {
      type: 'idea',
      plane: ID.planeA,
      title: 'Tip jar',
      fields: { validation: 'testing', tags: ['money'], notes: 'from the street' },
      links: [{ to: ID.queue }, { to: ID.anna, kind: 'for' }],
      parts: ['Tip by QR'],
      evidence: [{ kind: 'quote', text: 'I would tip', stance: 'supports' }],
      handle: '$a',
    })
    onlyNewIds(ctx.ws, [plan])
    expect(plan.label).toBe('add an idea')
    expect(plan.meta?.kind).toBe('idea')
    const ws = run(ctx, [plan])
    const card = ws.cards.find((c) => c.id === plan.ids.$a)!
    expect(card).toMatchObject({ type: 'idea', title: 'Tip jar', validation: 'testing', tags: ['money'], notes: 'from the street', pieceId: ID.planeA })
    // Nowhere over the plane's other cards.
    for (const o of ctx.ws.cards.filter((c) => c.pieceId === ID.planeA)) expect(overlaps(card, o)).toBe(false)
    expect(ws.edges.filter((e) => e.fromId === card.id).map((e) => [e.toId, e.kind])).toEqual([
      [ID.queue, 'solves'],
      [ID.anna, 'for'],
    ])
    const part = ws.cards.find((c) => c.title === 'Tip by QR')!
    expect(ws.edges.some((e) => e.fromId === part.id && e.toId === card.id && e.kind === 'part-of')).toBe(true)
    expect(ws.evidence.find((e) => e.nodeId === card.id)).toMatchObject({ text: 'I would tip', nodeType: 'idea' })
  })

  it("the UI's spot: centred on `at`, snapped, moved right past what's there", () => {
    const ctx = ctxOf()
    const plan = createCard(ctx, { type: 'customer', plane: ID.planeA, where: { at: [150, 100] } })
    const set = plan.writes[0].set!
    // Anna is at 50,50: the new card would cover her, so it goes right past her (and past the barista at 300).
    expect([set.x, set.y]).toEqual([525, 50])
    expect(set.title).toBe('')
    run(ctx, [plan])
  })

  it('refuses a plane that is not one, a type that is not one, a status that is not one', () => {
    const ctx = ctxOf()
    const errs = refused(ctx, [createCard(ctx, { type: 'idea', plane: ID.matrix, title: 'x' })])
    expect(errs[0].message).toMatch(/is a matrix, not a plane/)
    throwsRefused(() => createCard(ctx, { type: 'gadget' as 'idea', plane: ID.planeA }), /isn't a card type/)
    const bad = refused(ctx, [createCard(ctx, { type: 'idea', plane: ID.planeA, fields: { validation: 'maybe' as 'testing' } })])
    expect(bad[0].message).toMatch(/validation/)
  })
})

describe('update_card', () => {
  it('title and fields on the card; null takes a field away; notes as body', () => {
    const ctx = ctxOf()
    const plan = updateCard(ctx, { card: ID.anna, title: 'Anna K.', fields: { tags: null, notes: 'Three cafés now.' } })
    expect(plan.ids).toEqual({})
    const anna = run(ctx, [plan]).cards.find((c) => c.id === ID.anna)!
    expect(anna).toMatchObject({ title: 'Anna K.', notes: 'Three cafés now.' })
    expect(anna.tags).toBeUndefined()
    expect(plan.writes[0].patch).toMatchObject({ body: 'Three cafés now.', updatedAt: NOW })
  })

  it("a move on a plane it's on besides its home moves its place there, with no updatedAt", () => {
    const ctx = ctxOf()
    const plan = updateCard(ctx, { card: ID.anna, plane: ID.planeB, x: 75, y: 325 })
    expect(plan.label).toBe('move a customer')
    expect(plan.writes).toEqual([{ coll: 'places', id: `${ID.planeB}_${ID.anna}`, patch: { x: 75, y: 325 } }])
    const ws = run(ctx, [plan])
    expect(ws.places.find((p) => p.cardId === ID.anna)).toMatchObject({ x: 75, y: 325 })
    expect(ws.cards.find((c) => c.id === ID.anna)).toMatchObject({ x: 50, y: 50 })
  })

  it('folds a package with its spot; refuses a bad status and a card that is not there', () => {
    const ctx = ctxOf()
    const fold = updateCard(ctx, { card: ID.pkg, folded: true, x: 300, y: 300 })
    expect(fold.label).toBe('fold a package')
    expect(run(ctx, [fold]).cards.find((c) => c.id === ID.pkg)?.folded).toBe(true)
    expect(refused(ctx, [updateCard(ctx, { card: ID.queue, fields: { validation: 'sure' } })])[0].message).toMatch(/validation/)
    throwsRefused(() => updateCard(ctx, { card: 'ghost', title: 'x' }), /no card ghost/)
  })
})

describe('delete', () => {
  it('a card takes its links, places, evidence with it; tasks, cells and packages naming it stay (D-141)', () => {
    const ctx = ctxOf()
    const plan = deleteThings(ctx, { ids: [ID.anna], everywhere: true })
    expect(plan.label).toBe('delete a customer')
    expect(plan.ids).toEqual({})
    const ws = run(ctx, [plan])
    expect(ws.cards.some((c) => c.id === ID.anna)).toBe(false)
    expect(ws.edges.some((e) => e.id === ID.e1)).toBe(false)
    expect(ws.places.some((p) => p.cardId === ID.anna)).toBe(false)
    expect(ws.evidence.some((e) => e.id === ID.ev1)).toBe(false)
    expect(ws.tasks.find((t) => t.id === ID.task1)?.cardId).toBe(ID.anna)
  })

  it('a competitor takes its features and the matches naming it', () => {
    const ctx = ctxOf()
    const ws = run(ctx, [deleteThings(ctx, { ids: [ID.orderly] })])
    expect(ws.competitorFeatures).toEqual([])
    expect(ws.comparisons).toEqual([])
    expect(ws.edges.some((e) => e.id === ID.e3)).toBe(false)
    expect(ws.cells).toHaveLength(2)
  })

  it('a feature takes the matches naming it; its package keeps listing it', () => {
    const ctx = ctxOf()
    const ws = run(ctx, [deleteThings(ctx, { ids: [ID.qr] })])
    expect(ws.comparisons).toEqual([])
    expect(ws.competitorFeatures).toHaveLength(1)
    expect(ws.cards.find((c) => c.id === ID.pkg)?.memberIds).toEqual([ID.qr, ID.loyalty])
  })

  it('on a plane: a card also elsewhere comes off (its home moves), the rest go, text too', () => {
    const ctx = ctxOf()
    const plan = deleteThings(ctx, { ids: [ID.anna, ID.barista, ID.note], plane: ID.planeA })
    expect(plan.label).toBe('remove 3 things')
    const ws = run(ctx, [plan])
    expect(ws.cards.find((c) => c.id === ID.anna)).toMatchObject({ pieceId: ID.planeB, x: 50, y: 300 })
    expect(ws.places.some((p) => p.cardId === ID.anna)).toBe(false)
    expect(ws.evidence).toHaveLength(1)
    expect(ws.cards.some((c) => c.id === ID.barista)).toBe(false)
    expect(ws.labels.some((l) => l.id === ID.note)).toBe(false)
    expect(deleteThings(ctx, { ids: [ID.anna], plane: ID.planeB }).label).toBe('take a card off this plane')
  })

  it('links, evidence, competitor features (matches unmatched) and matches; refuses what it cannot find', () => {
    const ctx = ctxOf()
    expect(deleteThings(ctx, { ids: [ID.e2] }).label).toBe('unlink')
    expect(deleteThings(ctx, { ids: [ID.ev1] }).label).toBe('remove evidence')
    const cf = deleteThings(ctx, { ids: [ID.cf1] })
    expect(cf.label).toBe('remove a competitor feature')
    const ws = run(ctx, [cf])
    expect(ws.comparisons[0].competitorFeatureId).toBeUndefined()
    expect(ws.comparisons[0].criteria).toEqual({ c1: 'part' })
    expect(deleteThings(ctx, { ids: [`${ID.qr}_${ID.orderly}`] }).label).toBe('unmatch')
    throwsRefused(() => deleteThings(ctx, { ids: ['ghost'] }), /nothing with the id ghost/)
  })
})

describe('duplicate', () => {
  it('copies cards with the links between them, moved by two grid steps; not evidence or places', () => {
    const ctx = ctxOf()
    const plan = duplicate(ctx, { ids: [ID.anna, ID.queue], to: ID.planeA, handle: '$c' })
    expect(plan.label).toBe('paste 2 things')
    onlyNewIds(ctx.ws, [plan])
    const ws = run(ctx, [plan])
    const copy = ws.cards.find((c) => c.id === plan.ids.$c)!
    expect(copy).toMatchObject({ title: 'Anna, café owner', x: 100, y: 100, validation: 'testing', tags: ['smb'], notes: 'Runs two cafés in Berlin.' })
    expect(ws.edges.filter((e) => e.toId === copy.id)).toHaveLength(1)
    expect(ws.evidence.filter((e) => e.nodeId === copy.id)).toEqual([])
    expect(ws.places.filter((p) => p.cardId === copy.id)).toEqual([])
  })

  it('a package copied alone keeps the same members; text is copied too', () => {
    const ctx = ctxOf()
    const plan = duplicate(ctx, { ids: [ID.pkg], to: ID.planeB })
    expect(run(ctx, [plan]).cards.find((c) => c.id === plan.ids.$new)?.memberIds).toEqual([ID.qr, ID.loyalty])
    const t = duplicate(ctx, { ids: [ID.note], to: ID.planeA })
    expect(t.label).toBe('paste text')
    expect(run(ctx, [t]).labels.find((l) => l.id === t.ids.$new)).toMatchObject({ text: 'Ask Anna about Sundays', kind: 'sticky', x: 650, y: 100 })
  })
})

describe('links', () => {
  it('link (kind as drawn), update_link (label, kind, turn round), unlink', () => {
    const ctx = ctxOf()
    const l = link(ctx, { from: ID.preorder, to: ID.menu, handle: '$l' })
    expect(l.label).toBe('link')
    expect(run(ctx, [l]).edges.find((e) => e.id === l.ids.$l)).toMatchObject({ kind: 'solves', fromId: ID.preorder })
    expect(link(ctx, { from: ID.menu, to: ID.barista }).label).toBe('tag')
    const r = updateLink(ctx, { link: ID.e2, reverse: true })
    expect(r.label).toBe('reverse link')
    expect(run(ctx, [r]).edges.find((e) => e.id === ID.e2)).toMatchObject({ fromId: ID.queue, toId: ID.preorder })
    const lab = updateLink(ctx, { link: ID.e3, label: null })
    expect(lab.label).toBe('link label')
    expect(run(ctx, [lab]).edges.find((e) => e.id === ID.e3)?.label).toBeUndefined()
    expect(run(ctx, [unlink(ctx, { link: ID.e1 })]).edges.some((e) => e.id === ID.e1)).toBe(false)
  })

  it('refuses a link to a missing card (the builder), and one to a card deleted earlier in the batch', () => {
    const ctx = ctxOf()
    throwsRefused(() => link(ctx, { from: ID.anna, to: 'ghost' }), /no card ghost/)
    throwsRefused(() => buildBatch(ctx, [{ op: 'delete', args: { ids: [ID.menu] } }, { op: 'link', args: { from: ID.preorder, to: ID.menu } }]), /no card/)
    // A hand-made link plan to a card the batch deletes: validate refuses it.
    const errs = refused(ctx, [deleteThings(ctx, { ids: [ID.menu] }), link(ctx, { from: ID.preorder, to: ID.menu })])
    expect(errs[0].message).toMatch(/isn't a card in the workspace/)
  })
})

describe('evidence', () => {
  it('create, update (empty takes a field away), refuse on a feature', () => {
    const ctx = ctxOf()
    const c = createEvidence(ctx, { card: ID.queue, kind: 'data', text: '12 min average wait', stance: 'supports', source: '', handle: '$e' })
    expect(c.label).toBe('add evidence')
    expect(c.writes[0].set).not.toHaveProperty('source')
    expect(run(ctx, [c]).evidence.find((e) => e.id === c.ids.$e)).toMatchObject({ nodeId: ID.queue, nodeType: 'problem' })
    const u = updateEvidence(ctx, { evidence: ID.ev1, fields: { stance: 'contradicts', date: '' } })
    const e = run(ctx, [u]).evidence.find((x) => x.id === ID.ev1)!
    expect(e.stance).toBe('contradicts')
    expect(e.date).toBeUndefined()
    expect(refused(ctx, [createEvidence(ctx, { card: ID.qr, kind: 'data', text: 'x', stance: 'supports' })])[0].message).toMatch(/must be a customer or problem or idea/)
    expect(refused(ctx, [updateEvidence(ctx, { evidence: ID.ev1, fields: { stance: 'meh' } })])[0].message).toMatch(/stance|isn't a valid/)
  })
})

describe('competitor features', () => {
  it('create with a match; change the match (the old one unmatched); delete', () => {
    const ctx = ctxOf()
    const c = createCompetitorFeature(ctx, { competitor: ID.orderly, name: 'Stamps', availability: 'free', ours: ID.loyalty, handle: '$f' })
    let ws = run(ctx, [c])
    expect(ws.competitorFeatures.find((f) => f.id === c.ids.$f)).toMatchObject({ name: 'Stamps', competitorId: ID.orderly })
    expect(ws.comparisons.find((x) => x.id === `${ID.loyalty}_${ID.orderly}`)?.competitorFeatureId).toBe(c.ids.$f)
    // cf1 matched to loyalty instead of qr: qr's comparison is unmatched (its criteria kept).
    const m = updateCompetitorFeature(ctx, { feature: ID.cf1, ours: ID.loyalty })
    expect(m.label).toBe('match a feature')
    ws = run(ctx, [m])
    expect(ws.comparisons.find((x) => x.id === `${ID.qr}_${ID.orderly}`)).toMatchObject({ criteria: { c1: 'part' } })
    expect(ws.comparisons.find((x) => x.id === `${ID.qr}_${ID.orderly}`)?.competitorFeatureId).toBeUndefined()
    expect(ws.comparisons.find((x) => x.id === `${ID.loyalty}_${ID.orderly}`)?.competitorFeatureId).toBe(ID.cf1)
    const u = updateCompetitorFeature(ctx, { feature: ID.cf1, fields: { category: '', name: 'Table QR codes' } })
    expect(u.label).toBe('edit a competitor feature')
    const f = run(ctx, [u]).competitorFeatures[0]
    expect(f.name).toBe('Table QR codes')
    expect(f).not.toHaveProperty('category')
    throwsRefused(() => createCompetitorFeature(ctx, { competitor: ID.qr, name: 'x' }), /not a competitor/)
    throwsRefused(() => createCompetitorFeature(ctx, { competitor: ID.orderly, name: 'x', ours: ID.preorder }), /is an idea, not a feature/)
  })
})

describe('places', () => {
  it("place_on brings a card (not one already there); with move its home moves; members come along", () => {
    const ctx = ctxOf()
    expect(placeOnPlan(ctx, { cards: [ID.anna], plane: ID.planeB }).list).toEqual([])
    const p = placeOn(ctx, { cards: [ID.barista], plane: ID.planeB })
    expect(p.label).toBe('bring a card here')
    onlyNewIds(ctx.ws, [p])
    let ws = run(ctx, [p])
    expect(ws.places.find((x) => x.cardId === ID.barista)).toMatchObject({ planeId: ID.planeB, type: 'customer' })
    const mv = placeOn(ctx, { cards: [ID.barista], plane: ID.planeB, move: true })
    expect(mv.label).toBe('move a card here')
    expect(mv.ids).toEqual({})
    ws = run(ctx, [mv])
    expect(ws.cards.find((c) => c.id === ID.barista)?.pieceId).toBe(ID.planeB)
    const pk = placeOnPlan(ctx, { cards: [ID.pkg], plane: ID.planeA })
    expect(pk.list.map((c) => c.id).sort()).toEqual([ID.pkg, ID.qr, ID.loyalty].sort())
    ws = run(ctx, [pk.plan])
    const here = ws.places.filter((x) => x.planeId === ID.planeA)
    expect(here).toHaveLength(3)
    // Laid out as on their plane, clear of the cards already there.
    for (const a of here) for (const o of ctx.ws.cards.filter((c) => c.pieceId === ID.planeA)) expect(overlaps(a, o)).toBe(false)
    expect(pk.box!.w).toBeGreaterThanOrEqual(CARD.w)
  })

  it("take_off: off a plane it's on besides its home; off its home (the home moves); a card on one plane isn't touched", () => {
    const ctx = ctxOf()
    const a = takeOffPlan(ctx, { cards: [ID.anna], plane: ID.planeB })
    expect(a.n).toBe(1)
    expect(run(ctx, [a.plan]).places).toEqual([])
    const home = takeOff(ctx, { cards: [ID.anna], plane: ID.planeA })
    expect(run(ctx, [home]).cards.find((c) => c.id === ID.anna)).toMatchObject({ pieceId: ID.planeB, x: 50, y: 300 })
    const none = takeOffPlan(ctx, { cards: [ID.barista], plane: ID.planeA })
    expect(none.n).toBe(0)
    expect(none.plan.writes).toEqual([])
  })
})

describe('create_package', () => {
  it('named Package N at its members’ top-left', () => {
    const ctx = ctxOf()
    const p = createPackage(ctx, { cards: [ID.anna, ID.barista] })
    expect(p.label).toBe('package these')
    expect(run(ctx, [p]).cards.find((c) => c.id === p.ids.$new)).toMatchObject({ title: 'Package 2', x: 50, y: 50, memberIds: [ID.anna, ID.barista], pieceId: ID.planeA })
  })
})

describe('refused with a fix', () => {
  it('each op refuses what it names that is not there or not allowed', () => {
    const ctx = ctxOf()
    throwsRefused(() => createPackage(ctx, { cards: [] }), /needs cards/)
    throwsRefused(() => createPackage(ctx, { cards: ['ghost'] }), /no card ghost/)
    throwsRefused(() => duplicate(ctx, { ids: ['ghost'], to: ID.planeA }), /no card or text ghost/)
    throwsRefused(() => unlink(ctx, { link: 'ghost' }), /no link ghost/)
    throwsRefused(() => updateLink(ctx, { link: 'ghost', label: 'x' }), /no link ghost/)
    throwsRefused(() => updateLink(ctx, { link: ID.e1, kind: 'loves' }), /isn't a kind of link/)
    throwsRefused(() => link(ctx, { from: ID.anna, to: ID.queue, kind: 'loves' }), /isn't a kind of link/)
    throwsRefused(() => updateCompetitorFeature(ctx, { feature: 'ghost', ours: null }), /no competitor feature ghost/)
    throwsRefused(() => updateCompetitorFeature(ctx, { feature: ID.cf1, ours: ID.anna }), /is a customer, not a feature/)
    throwsRefused(() => updateCard(ctx, { card: ID.barista, plane: ID.planeB, x: 0, y: 0 }), /isn't on plane/)
    throwsRefused(() => placeOn(ctx, { cards: ['ghost'], plane: ID.planeB }), /no card ghost/)
    expect(refused(ctx, [placeOn(ctx, { cards: [ID.barista], plane: ID.matrix })])[0].message).toMatch(/is a matrix, not a plane/)
    throwsRefused(() => takeOff(ctx, { cards: ['ghost'], plane: ID.planeA }), /no card ghost/)
    throwsRefused(() => updateCard(ctx, { card: ID.anna, fields: { title: 'x' } as never }), /isn't one of a card's fields/)
    throwsRefused(() => createCard(ctx, { type: 'idea', plane: ID.planeB, where: { near: ID.queue } }), /isn't on plane/)
    throwsRefused(() => updateEvidence(ctx, { evidence: 'ghost', fields: {} }), /no piece of evidence ghost/)
    throwsRefused(() => createEvidence(ctx, { card: 'ghost', kind: 'data', text: 'x', stance: 'supports' }), /no card ghost/)
  })
})

describe('batches and the registry', () => {
  it('handles: later ops name what earlier ones made; each sees the workspace as the ones before left it', () => {
    const ctx = ctxOf()
    const plans = buildBatch(ctx, [
      { op: 'create_card', args: { type: 'idea', plane: ID.planeA, title: 'Order by text', handle: '$a' } },
      { op: 'link', args: { from: '$a', to: ID.queue } },
      { op: 'create_evidence', args: { card: '$a', kind: 'observation', text: 'People text cafés already', stance: 'supports' } },
      { op: 'create_card', args: { type: 'idea', plane: ID.planeA, title: 'Order by voice' } },
    ])
    onlyNewIds(ctx.ws, plans)
    const ws = run(ctx, plans)
    const a = plans[0].ids.$a
    expect(ws.edges.find((e) => e.id === plans[1].ids.$2)).toMatchObject({ fromId: a, toId: ID.queue, kind: 'solves' })
    expect(ws.evidence.find((e) => e.id === plans[2].ids.$3)?.nodeId).toBe(a)
    // The second card saw the first: they don't overlap.
    const b = ws.cards.find((c) => c.id === plans[3].ids.$4)!
    expect(overlaps(b, ws.cards.find((c) => c.id === a)!)).toBe(false)
  })

  it('every op has a name, a kind, a summary, args and a builder; names follow the naming rule', () => {
    expect(OPS.length).toBe(REGISTRY.size)
    for (const o of OPS) {
      expect(o.name).toMatch(/^(create_|update_)?[a-z_]+$/)
      expect(o.summary.length).toBeGreaterThan(10)
      expect(o.args.type).toBe('object')
      expect(typeof o.build).toBe('function')
    }
    expect([...REGISTRY.keys()].sort()).toEqual(
      ['arrange', 'create_card', 'create_competitor_feature', 'create_evidence', 'create_package', 'create_text', 'delete', 'duplicate', 'link', 'place_on', 'take_off', 'unlink', 'update_card', 'update_competitor_feature', 'update_evidence', 'update_link', 'update_text', 'create_piece', 'update_piece', 'rename', 'resize', 'create_canvas', 'move_canvas', 'move_to_canvas', 'update_matrix', 'update_table', 'axis_add', 'axis_remove', 'axis_update', 'update_cell', 'create_task', 'update_task', 'move_task', 'update_deck', 'create_deck_column', 'update_deck_column', 'move_deck_column', 'update_timeline', 'update_notes'].sort(),
    )
  })
})
