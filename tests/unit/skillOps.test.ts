// S17's ops for the skills (D-312; agent.md §4.10): merge_cards (/dedupe) and create_document (the document skills), on
// the fixture workspace, pure: valid, refused with a fix, cascades. Undo through the real apply: wrappers.test.ts; the
// agent's accept recording actor 'agent': the last block here (the loop on the medium fixture).
import { describe, expect, it, vi } from 'vitest'
import { counterIds } from '../../src/ops/newId'
import { validate } from '../../src/ops/validate'
import { project } from '../../src/ops/project'
import { OpsRefused, type OpCtx, type Plan } from '../../src/ops/types'
import { mergeCards } from '../../src/ops/merge'
import { createDocument } from '../../src/ops/document'
import { REGISTRY } from '../../src/ops/registry'
import type { WorkspaceCtx } from '../../src/state/wsStore'
import { ALICE, BOB, CAROL, fixtureDocs, fixtureWs, ID, T, wsFrom } from './fixtures/ws'
import { runTurn } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { AGENT_TOOLS } from '../../src/agent/tools'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'

const NOW = T + 1000
const ctxOf = (ws: WorkspaceCtx = fixtureWs(), actor = ALICE): OpCtx => ({ ws, actor, now: NOW, newId: counterIds('new') })

function run(ctx: OpCtx, plans: Plan[]) {
  const v = validate(plans, ctx.ws, ctx.actor)
  expect(v).toEqual({ ok: true })
  return project(ctx.ws, plans)
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

// A second "Anna" on the market plane (a near-duplicate), with its own link, evidence, task, package membership,
// matrix cell and a table/deck mention.
const DUP = 'cust0000000000000099'
function dupWs(): WorkspaceCtx {
  const d = fixtureDocs()
  d.customers.push({ id: DUP, title: 'Anna (café owner)', pieceId: ID.planeB, x: 700, y: 300, tags: ['berlin', 'smb'], body: 'Met at the fair.', createdAt: T, updatedAt: T } as never)
  d.edges.push({ id: 'edge0000000000000099', fromId: ID.menu, fromType: 'problem', toId: DUP, toType: 'customer', kind: 'for' } as never)
  // A repeat of ID.e1 (queue → anna, for) once merged: goes.
  d.edges.push({ id: 'edge0000000000000098', fromId: ID.queue, fromType: 'problem', toId: DUP, toType: 'customer', kind: 'for' } as never)
  d.evidence.push({ id: 'evid0000000000000099', nodeId: DUP, nodeType: 'customer', kind: 'quote', text: 'I would pre-order', stance: 'supports', createdAt: T, updatedAt: T } as never)
  d.tasks.push({ id: 'task0000000000000099', pieceId: ID.deck, col: 'todo', order: 2, title: 'Call Anna back', uid: 'u-alice', cardId: DUP, cardType: 'customer', createdAt: T, updatedAt: T } as never)
  d.packages[0] = { ...d.packages[0], memberIds: [ID.qr, ID.loyalty, DUP] } as never
  const m = d.pieces.find((p) => p.id === ID.matrix) as Record<string, unknown>
  m.matrix = { rows: { type: 'competitor', items: [] }, cols: { items: [{ id: 'it1', cardId: DUP, cardType: 'customer' }, { id: 'it2', cardId: ID.anna, cardType: 'customer' }], hide: [DUP] }, cell: 'scale', steps: (m.matrix as { steps: unknown }).steps }
  d.cells.push({ id: `${ID.matrix}_${ID.orderly}_${DUP}`, matrixId: ID.matrix, row: ID.orderly, col: DUP, value: 'full', updatedAt: T } as never)
  for (const c of Object.keys(d)) (d as Record<string, { id: string }[]>)[c].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return wsFrom(d)
}

describe('merge_cards', () => {
  it('folds a duplicate into the kept card: links (repeats and self-links go), evidence, tasks, packages, planes, setups, cells, fields; then deletes it', () => {
    const ctx = ctxOf(dupWs())
    const plan = mergeCards(ctx, { keep: ID.anna, merge: [DUP] })
    expect(plan.label).toBe('merge a card into "Anna, café owner"')
    const ws = run(ctx, [plan])
    expect(ws.cards.find((c) => c.id === DUP)).toBeUndefined()
    const anna = ws.cards.find((c) => c.id === ID.anna)!
    // Its tags joined, a missing field filled, notes added under its own.
    expect(anna.tags).toEqual(['smb', 'berlin'])
    expect(anna.notes).toBe('Runs two cafés in Berlin.\n\nMet at the fair.')
    expect(anna.validation).toBe('testing')
    // Links: the menu's for now points at Anna; the repeat of queue → Anna went.
    expect(ws.edges.find((e) => e.id === 'edge0000000000000099')).toMatchObject({ fromId: ID.menu, toId: ID.anna, toType: 'customer' })
    expect(ws.edges.find((e) => e.id === 'edge0000000000000098')).toBeUndefined()
    expect(ws.edges.filter((e) => e.fromId === ID.queue && e.toId === ID.anna)).toHaveLength(1)
    expect(ws.evidence.find((e) => e.id === 'evid0000000000000099')?.nodeId).toBe(ID.anna)
    expect(ws.tasks.find((t) => t.id === 'task0000000000000099')?.cardId).toBe(ID.anna)
    expect(ws.cards.find((c) => c.id === ID.pkg)?.memberIds).toEqual([ID.qr, ID.loyalty, ID.anna])
    // Anna was already on the market plane (a place): no second place; the duplicate's spot isn't needed.
    expect(ws.places.filter((p) => p.cardId === ID.anna)).toHaveLength(1)
    // The matrix's hand-added column for the duplicate is Anna's (once), and its cell moved where free.
    const m = ws.pieces.find((p) => p.id === ID.matrix)!.matrix!
    expect(m.cols.items.map((i) => i.cardId)).toEqual([ID.anna])
    // The duplicate was taken out of the axis, Anna wasn't: she stays shown, the duplicate's hidden state goes with it.
    expect(m.cols.hide ?? []).toEqual([])
    expect(ws.cells.find((c) => c.row === ID.orderly && c.col === ID.anna)?.value).toBe('full')
    expect(ws.cells.some((c) => c.col === DUP)).toBe(false)
  })

  it("keeps the kept card's own shown/hidden state in a matrix: hidden stays hidden, the merged one's hide goes", () => {
    const d = fixtureDocs()
    d.customers.push({ id: DUP, title: 'Anna again', pieceId: ID.planeB, x: 700, y: 300, createdAt: T, updatedAt: T } as never)
    const m = d.pieces.find((p) => p.id === ID.matrix) as Record<string, unknown>
    m.matrix = { ...(m.matrix as object), cols: { type: 'customer', items: [], hide: [ID.anna] } }
    const ctx = ctxOf(wsFrom(d))
    const ws = run(ctx, [mergeCards(ctx, { keep: ID.anna, merge: [DUP] })])
    expect(ws.pieces.find((p) => p.id === ID.matrix)!.matrix!.cols.hide).toEqual([ID.anna])
  })

  it('places the kept card on a plane only the duplicate was on, at its spot', () => {
    const d = fixtureDocs()
    d.places = []
    d.customers.push({ id: DUP, title: 'Anna again', pieceId: ID.planeB, x: 700, y: 300, createdAt: T, updatedAt: T } as never)
    const ctx = ctxOf(wsFrom(d))
    const ws = run(ctx, [mergeCards(ctx, { keep: ID.anna, merge: DUP, title: 'Anna, who runs two cafés' })])
    expect(ws.places.find((p) => p.cardId === ID.anna && p.planeId === ID.planeB)).toMatchObject({ x: 700, y: 300 })
    expect(ws.cards.find((c) => c.id === ID.anna)?.title).toBe('Anna, who runs two cafés')
  })

  it('a competitor merge moves its features and matches', () => {
    const d = fixtureDocs()
    const twin = 'comp0000000000000099'
    d.competitors.push({ id: twin, name: 'Orderly GmbH', pieceId: ID.planeB, x: 50, y: 500, createdAt: T, updatedAt: T } as never)
    d.competitorFeatures.push({ id: 'cfea0000000000000099', competitorId: twin, name: 'Stamps', createdAt: T, updatedAt: T } as never)
    d.comparisons.push({ id: `${ID.loyalty}_${twin}`, featureId: ID.loyalty, competitorId: twin, updatedAt: T } as never)
    const ctx = ctxOf(wsFrom(d))
    const ws = run(ctx, [mergeCards(ctx, { keep: twin, merge: [ID.orderly] })])
    expect(ws.competitorFeatures.filter((f) => f.competitorId === twin).map((f) => f.name).sort()).toEqual(['Stamps', 'Table QR'])
    expect(ws.comparisons.map((c) => `${c.featureId}_${c.competitorId}`).sort()).toEqual([`${ID.loyalty}_${twin}`, `${ID.qr}_${twin}`].sort())
    expect(ws.cards.find((c) => c.id === twin)?.regions).toEqual(['Germany'])
  })

  it('refuses with a fix: different types, a package, itself, nothing to merge, an unknown card', () => {
    const ctx = ctxOf()
    throwsRefused(() => mergeCards(ctx, { keep: ID.anna, merge: [ID.queue] }), /only cards of one type merge/)
    throwsRefused(() => mergeCards(ctx, { keep: ID.pkg, merge: [ID.qr] }), /packages/)
    throwsRefused(() => mergeCards(ctx, { keep: ID.anna, merge: [ID.anna] }), /also in merge/)
    throwsRefused(() => mergeCards(ctx, { keep: ID.anna, merge: [] }), /nothing to merge/)
    throwsRefused(() => mergeCards(ctx, { keep: ID.anna, merge: ['nope'] }), /no card nope/)
  })

  it('is a delete for the change tool (needs why) and validated refused for a viewer', () => {
    expect(REGISTRY.get('merge_cards')?.kind).toBe('card')
    const ctx = ctxOf(dupWs())
    const v = validate([mergeCards(ctx, { keep: ID.anna, merge: [DUP] })], ctx.ws, CAROL)
    expect(v.ok).toBe(false)
  })
})

describe('create_document', () => {
  it("writes the person's own markdown document and its body, private unless shared; the agent's says origin assistant", () => {
    const ctx = ctxOf(fixtureWs(), { ...BOB, name: 'Bob', agent: true })
    const plan = createDocument(ctx, { title: 'SWOT: Tablebook', text: '# SWOT\n\n- Strength: c1 "Anna, café owner" loses 20 orders a morning', handle: '$d' })
    const id = plan.ids.$d
    const ws = run(ctx, [plan]) as WorkspaceCtx & { bodies?: Record<string, { text?: string }> }
    const doc = ws.documents.find((d) => d.id === id)!
    expect(doc).toMatchObject({ kind: 'markdown', title: 'SWOT: Tablebook', origin: 'assistant', uid: 'u-bob', name: 'Bob', shared: false, contentType: 'text/markdown', words: 13 })
    expect(ws.bodies?.[id]?.text).toContain('loses 20 orders')
    const shared = createDocument(ctxOf(), { title: 'One-pager', text: 'Hello', share: true })
    expect(shared.writes[0].set).toMatchObject({ shared: true, origin: 'upload' })
  })

  it('refuses with a fix: no title, no text, too long', () => {
    throwsRefused(() => createDocument(ctxOf(), { title: ' ', text: 'x' }), /needs a title/)
    throwsRefused(() => createDocument(ctxOf(), { title: 'x', text: '  ' }), /no text/)
    throwsRefused(() => createDocument(ctxOf(), { title: 'x', text: 'é'.repeat(460_000) }), /over 900 KB/)
  })

  it("validate refuses a document that isn't the actor's, one already there, a patch, a stray field, a body alone", () => {
    const ctx = ctxOf()
    const plan = createDocument(ctx, { title: 'Pitch', text: 'Hi', handle: '$d' })
    const id = plan.ids.$d
    const other = { ...plan, writes: [{ ...plan.writes[0], set: { ...plan.writes[0].set, uid: 'u-bob' } }, plan.writes[1]] }
    expect(validate([other], ctx.ws, ALICE).ok).toBe(false)
    const stray = { ...plan, writes: [{ ...plan.writes[0], set: { ...plan.writes[0].set, role: 'agent-notes' } }, plan.writes[1]] }
    expect(validate([stray], ctx.ws, ALICE).ok).toBe(false)
    const lone = { ...plan, writes: [plan.writes[1]] }
    expect(validate([lone], ctx.ws, ALICE).ok).toBe(false)
    const after = project(ctx.ws, [plan])
    expect(validate([createDocument({ ...ctx, ws: after, newId: () => id }, { title: 'Again', text: 'x' })], after, ALICE).ok).toBe(false)
    expect(validate([{ op: 'x', label: 'x', writes: [{ coll: 'documents', id, patch: { title: 'y' } }], ids: {} }], after, ALICE).ok).toBe(false)
    expect(validate([plan], ctx.ws, CAROL).ok).toBe(false)
  })
})

describe("the agent's merges and documents are applied as the agent", () => {
  it('a turn proposing create_document and merge_cards: accepted as one step, meta.actor agent', async () => {
    const e = makeEnv(loadFixture('medium'))
    const spy = vi.spyOn(e, 'apply')
    const m = stubModel([
      { calls: [{ name: 'get', args: { ids: ['c9', 'c2'] } }] },
      {
        calls: [
          {
            name: 'change',
            args: {
              ops: [
                { op: 'merge_cards', args: { keep: 'c9', merge: ['c2'] }, why: 'two cards for the same farmers' },
                { op: 'create_document', args: { title: 'SWOT: Pazar', text: '# SWOT\n- c9 "Organic farmers who pay cash"' } },
              ],
            },
          },
        ],
      },
      { answer: 'Proposed.' },
    ])
    const { turn } = await runTurn(m, e, AGENT_TOOLS, [], '/dedupe')
    expect(turn.steps[1].results[0].ok).toBe(true)
    expect(e.changes?.items.map((i) => i.op)).toEqual(['merge_cards', 'create_document'])
    expect(e.changes?.items[1].diff?.every((l) => l.sign === '+')).toBe(true)
    await e.accept()
    expect(spy.mock.calls[0][1]).toMatchObject({ actor: 'agent' })
    expect(e.steps.map((s) => s.actor)).toEqual(['agent'])
  })

  it('merge_cards without a why is refused by the change tool', async () => {
    const e = makeEnv(loadFixture('medium'))
    const m = stubModel([{ calls: [{ name: 'change', args: { ops: [{ op: 'merge_cards', args: { keep: 'c9', merge: ['c2'] } }] } }] }, { answer: 'x' }])
    const { turn } = await runTurn(m, e, AGENT_TOOLS, [], 'merge')
    expect(turn.steps[0].results[0].ok).toBe(false)
    expect(turn.steps[0].results[0].text).toMatch(/needs a why/)
  })
})
