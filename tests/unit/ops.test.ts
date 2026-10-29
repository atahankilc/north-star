import { describe, expect, it } from 'vitest'
import { fromDocs, WS_COLLECTIONS, type Docs, type RawDoc } from '../../src/model/fromDocs'
import { autoId, counterIds } from '../../src/ops/newId'
import { project } from '../../src/ops/project'
import { validate } from '../../src/ops/validate'
import { diff } from '../../src/ops/diff'
import { DELETE, type Plan, type Write } from '../../src/ops/types'
import { ALICE, BOB, CAROL, fixtureDocs, fixtureWs, ID, T, WID, WORKSPACE, wsFrom } from './fixtures/ws'

const plan = (op: string, writes: Write[], ids: Record<string, string> = {}): Plan => ({ op, label: op.replace(/_/g, ' '), writes, ids })

// ---- A tiny fake Firestore, written apart from src/ops/docs.ts on purpose: set replaces, update merges top-level keys
// and dotted paths (making maps on the way) and fails on a doc that isn't there, the delete sentinel removes a field,
// delete removes the doc; a collection lists its docs by id.
class FakeFirestore {
  data = new Map<string, Record<string, unknown>>()
  constructor(docs: Docs, workspace: RawDoc) {
    for (const c of WS_COLLECTIONS) for (const d of docs[c]) this.data.set(`${c}/${d.id}`, strip(d))
    this.data.set(`workspace/${workspace.id}`, strip(workspace))
  }
  run(w: Write) {
    const key = `${w.coll}/${w.id}`
    if (w.del) this.data.delete(key)
    else if (w.set && w.merge) this.data.set(key, merged(this.data.get(key) ?? {}, w.set))
    else if (w.set) this.data.set(key, structuredClone(w.set))
    else if (w.patch) {
      const cur = this.data.get(key)
      if (!cur) throw new Error(`NOT_FOUND ${key}`)
      const next = structuredClone(cur)
      for (const [path, v] of Object.entries(w.patch)) {
        const parts = path.split('.')
        let o = next as Record<string, unknown>
        for (const p of parts.slice(0, -1)) {
          if (typeof o[p] !== 'object' || o[p] === null) o[p] = {}
          o = o[p] as Record<string, unknown>
        }
        const last = parts[parts.length - 1]
        if (v && typeof v === 'object' && (v as { $delete?: boolean }).$delete) delete o[last]
        else o[last] = structuredClone(v)
      }
      this.data.set(key, next)
    }
  }
  // What the listeners would get: `{ ...data, id }` per collection, by id.
  docs(): Docs {
    const out = Object.fromEntries(WS_COLLECTIONS.map((c) => [c, [] as RawDoc[]])) as Docs
    for (const [key, d] of this.data) {
      const [c, id] = key.split('/') as [keyof Docs, string]
      if (c in out) out[c].push({ ...d, id })
    }
    for (const c of WS_COLLECTIONS) out[c].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return out
  }
  workspace() {
    return { ...this.data.get(`workspace/${WID}`)!, id: WID }
  }
}
const strip = ({ id: _, ...rest }: RawDoc) => structuredClone(rest)
const isDel = (v: unknown) => !!v && typeof v === 'object' && (v as { $delete?: boolean }).$delete === true
function merged(cur: Record<string, unknown>, d: Record<string, unknown>): Record<string, unknown> {
  const out = structuredClone(cur)
  for (const [k, v] of Object.entries(d)) {
    if (isDel(v)) delete out[k]
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = merged(typeof out[k] === 'object' && out[k] && !Array.isArray(out[k]) ? (out[k] as Record<string, unknown>) : {}, v as Record<string, unknown>)
    else out[k] = structuredClone(v)
  }
  return out
}

// A batch that touches most kinds: a new plane with a card on it, links to it, the card placed on a second plane, a
// patch with a dotted path and DELETE, deletes, a moved task, a renamed workspace, a new canvas and a spot.
function bigBatch(): Plan[] {
  const id = counterIds('new')
  const plane = id()
  const card = id()
  const link = id()
  const canvas = id()
  return [
    plan('create_piece', [{ coll: 'pieces', id: plane, set: { kind: 'plane', x: 0, y: 1400, w: 960, h: 600, name: 'Pricing', createdAt: T, updatedAt: T } }], { $p: plane }),
    plan('create_card', [{ coll: 'ideas', id: card, set: { title: 'Pay per order', pieceId: plane, x: 50, y: 50, validation: 'hypothesis', createdAt: T, updatedAt: T } }], { $c: card }),
    plan('link', [{ coll: 'edges', id: link, set: { fromId: card, fromType: 'idea', toId: ID.queue, toType: 'problem', kind: 'solves' } }], { $l: link }),
    plan('place_on', [{ coll: 'places', id: `${ID.planeA}_${ID.qr}`, set: { planeId: ID.planeA, cardId: ID.qr, type: 'feature', x: 700, y: 400, createdAt: T + 1 } }]),
    plan('update_card', [{ coll: 'customers', id: ID.anna, patch: { title: 'Anna, owner of two cafés', tags: DELETE, validation: 'validated', updatedAt: T + 2 } }]),
    plan('setup', [{ coll: 'pieces', id: ID.matrix, patch: { 'matrix.cell': 'number', 'matrix.unit': '€', updatedAt: T + 2 } }]),
    plan('move_task', [{ coll: 'tasks', id: ID.task1, patch: { col: 'doing', order: 2, updatedAt: T + 3 } }]),
    plan('unlink', [{ coll: 'edges', id: ID.e4, del: true }]),
    plan('take_off', [{ coll: 'places', id: `${ID.planeB}_${ID.anna}`, del: true }]),
    plan('rename', [{ coll: 'workspace', id: WID, patch: { name: 'Tablebook GmbH' } }]),
    plan('create_canvas', [{ coll: 'canvases', id: canvas, set: { name: 'Marketing', order: 1, createdAt: T } }], { $v: canvas }),
    plan('set_cell', [{ coll: 'cells', id: `${ID.matrix}_${ID.orderly}_${ID.loyalty}`, merge: true, set: { value: 'full', confidence: DELETE, updatedAt: T + 4 } }]),
    plan('set_cell', [{ coll: 'cells', id: `${ID.matrix}_${ID.orderly}_new001`, merge: true, set: { matrixId: ID.matrix, row: ID.orderly, col: 'new001', value: 'none', updatedAt: T } }]),
    plan('setup', [{ coll: 'pieces', id: ID.deck, merge: true, set: { kanban: { rows: 'assignee' }, updatedAt: T + 4 } }]),
    plan('put_on_canvas', [{ coll: 'pieceSpots', id: `${canvas}_${ID.planeB}`, set: { canvasId: canvas, pieceId: ID.planeB, x: 0, y: 0, createdAt: T } }]),
  ]
}

describe('fixture', () => {
  it('reads back as itself: fromDocs(toDocs(ws)) is ws, and every untouched item keeps its object', () => {
    const ws = fixtureWs()
    const same = project(ws, [])
    expect(same).toEqual(ws)
    for (const k of ['pieces', 'labels', 'edges', 'tasks', 'cells', 'evidence', 'places'] as const) ws[k].forEach((x, i) => expect(same[k][i]).toBe(x))
    // Cards not on a second plane are the very same objects too.
    for (const c of ws.cards.filter((c) => !c.planes)) expect(same.cards.find((x) => x.id === c.id)).toBe(c)
    expect(ws.cards.find((c) => c.id === ID.anna)?.planes).toEqual([ID.planeA, ID.planeB])
  })

  it('every fixture doc passes validate when rewritten as it is', () => {
    const docs = fixtureDocs()
    const writes: Write[] = WS_COLLECTIONS.flatMap((c) => docs[c].map(({ id, ...set }) => ({ coll: c, id, set })))
    expect(validate([plan('rewrite', writes)], fixtureWs(), ALICE)).toEqual({ ok: true })
  })
})

describe('project', () => {
  it('creates, patches and deletes docs into the items the listeners would make', () => {
    const ws = fixtureWs()
    const next = project(ws, bigBatch())
    const made = next.cards.find((c) => c.title === 'Pay per order')!
    expect(made).toMatchObject({ type: 'idea', pieceId: 'new001', x: 50, y: 50, validation: 'hypothesis' })
    expect(next.pieces.find((p) => p.id === 'new001')?.name).toBe('Pricing')
    // Patched: title, a field taken away, the place gone (Anna is home only now: no `planes`).
    const anna = next.cards.find((c) => c.id === ID.anna)!
    expect(anna).toMatchObject({ title: 'Anna, owner of two cafés', validation: 'validated' })
    expect(anna.tags).toBeUndefined()
    expect(anna.planes).toBeUndefined()
    // Placed: the QR feature is on two planes now.
    expect(next.cards.find((c) => c.id === ID.qr)?.planes).toEqual([ID.planeB, ID.planeA])
    // A dotted patch changes one field of the setup, the rest stays.
    const matrix = next.pieces.find((p) => p.id === ID.matrix)!
    expect(matrix.matrix).toMatchObject({ cell: 'number', unit: '€', rows: { type: 'competitor', items: [] } })
    expect(next.edges.map((e) => e.id)).not.toContain(ID.e4)
    expect(next.edges.find((e) => e.id === 'new003')).toMatchObject({ fromId: 'new002', toId: ID.queue, kind: 'solves' })
    expect(next.tasks.find((t) => t.id === ID.task1)).toMatchObject({ col: 'doing', order: 2 })
    expect(next.workspace.name).toBe('Tablebook GmbH')
    expect(next.workspace.roles).toEqual(WORKSPACE.roles)
    expect(next.canvases.map((c) => c.id)).toEqual(['main', 'new004'])
    expect(next.pieces.find((p) => p.id === ID.planeB)?.canvases).toEqual(['main', 'new004'])
    // A set with merge: the fields given, the rest kept, maps merged, DELETE takes one away; made when missing.
    expect(next.cells.find((c) => c.col === ID.loyalty)).toEqual({ id: `${ID.matrix}_${ID.orderly}_${ID.loyalty}`, matrixId: ID.matrix, row: ID.orderly, col: ID.loyalty, value: 'full', updatedAt: T + 4 })
    expect(next.cells.find((c) => c.col === 'new001')).toMatchObject({ value: 'none' })
    expect(next.pieces.find((p) => p.id === ID.deck)?.kanban).toMatchObject({ rows: 'assignee', cols: [{ id: 'todo' }, { id: 'doing' }, { id: 'done' }] })
    // The snapshot it started from is untouched.
    expect(ws.cards.find((c) => c.id === ID.anna)?.tags).toEqual(['smb'])
  })

  it('project equals what apply writes (the fake Firestore, read by the listeners\' converters)', () => {
    const plans = bigBatch()
    const fake = new FakeFirestore(fixtureDocs(), { ...WORKSPACE })
    for (const p of plans) for (const w of p.writes) fake.run(w)
    const listened = wsFrom(fake.docs(), fake.workspace())
    expect(project(fixtureWs(), plans)).toEqual(listened)
  })

  it('project equals what apply writes, for a set over an existing doc and a delete then re-create', () => {
    const plans = [
      plan('update_card', [{ coll: 'competitors', id: ID.orderly, set: { name: 'Orderly AG', pieceId: ID.planeB, x: 75, y: 75, createdAt: T, updatedAt: T } }]),
      plan('delete', [{ coll: 'labels', id: ID.note, del: true }]),
      plan('add_text', [{ coll: 'labels', id: ID.note, set: { pieceId: 'canvas', text: 'Back again', size: 'note', x: 0, y: 0, createdAt: T } }]),
    ]
    const fake = new FakeFirestore(fixtureDocs(), { ...WORKSPACE })
    for (const p of plans) for (const w of p.writes) fake.run(w)
    const out = project(fixtureWs(), plans)
    expect(out).toEqual(wsFrom(fake.docs(), fake.workspace()))
    // A set replaces: Orderly's regions and notes are gone.
    expect(out.cards.find((c) => c.id === ID.orderly)).toMatchObject({ title: 'Orderly AG', regions: undefined, notes: undefined })
    expect(fromDocs(fake.docs()).labels.find((l) => l.id === ID.note)?.text).toBe('Back again')
  })

  it('a patch on a doc that is not there throws, as Firestore refuses it', () => {
    expect(() => project(fixtureWs(), [plan('update_card', [{ coll: 'ideas', id: 'nope', patch: { title: 'x' } }])])).toThrow(/doesn't exist/)
  })
})

describe('validate', () => {
  it('passes a good batch, things made earlier in it included', () => {
    expect(validate(bigBatch(), fixtureWs(), BOB)).toEqual({ ok: true })
  })

  it('catches a dangling reference and says how to fix it', () => {
    const v = validate([plan('link', [{ coll: 'edges', id: 'e9', set: { fromId: ID.anna, fromType: 'customer', toId: 'ghost', toType: 'idea', kind: 'relates' } }])], fixtureWs(), ALICE)
    expect(v.ok).toBe(false)
    if (v.ok) return
    expect(v.errors[0]).toMatchObject({ op: 'link' })
    expect(v.errors[0].message).toMatch(/ghost isn't a card/)
    expect(v.errors[0].fix).toMatch(/existing card/)
  })

  it('catches references to things deleted in the same batch, a card on a deck, and a wrong type', () => {
    const v = validate(
      [
        plan('delete', [{ coll: 'pieces', id: ID.planeA, del: true }]),
        plan('create_card', [{ coll: 'ideas', id: 'i9', set: { title: 'x', pieceId: ID.planeA, x: 0, y: 0 } }]),
        plan('create_card', [{ coll: 'ideas', id: 'i8', set: { title: 'y', pieceId: ID.deck, x: 0, y: 0 } }]),
        plan('link', [{ coll: 'edges', id: 'e8', set: { fromId: ID.anna, fromType: 'problem', toId: ID.queue, toType: 'problem', kind: 'for' } }]),
      ],
      fixtureWs(),
      ALICE,
    )
    expect(v.ok).toBe(false)
    if (v.ok) return
    const text = v.errors.map((e) => e.message).join('\n')
    expect(text).toMatch(new RegExp(`${ID.planeA} isn't a piece`))
    expect(text).toMatch(/is a kanban, not a plane/)
    expect(text).toMatch(/is a customer, not a problem/)
    // The task and the deck stuck to the deleted plane are not this batch's writes: not reported.
    expect(v.errors.every((e) => e.op !== 'delete')).toBe(true)
  })

  it('refuses a viewer, plan by plan', () => {
    const v = validate([plan('rename', [{ coll: 'workspace', id: WID, patch: { name: 'Mine now' } }])], fixtureWs(), CAROL)
    expect(v).toMatchObject({ ok: false, errors: [{ op: 'rename', message: expect.stringMatching(/viewers can only read/) }] })
  })

  it('catches bad shapes: a wrong type, a field it cannot have, undefined, DELETE in a set, a patch on nothing', () => {
    const v = validate(
      [
        plan('create_card', [{ coll: 'features', id: 'f9', set: { title: 'x', pieceId: ID.planeB, x: '10', y: 0 } }]),
        plan('create_card', [{ coll: 'features', id: 'f8', set: { title: 'x', pieceId: ID.planeB, x: 0, y: 0, colour: 'red' } }]),
        plan('update_card', [{ coll: 'features', id: ID.qr, patch: { priority: 'P9' } }]),
        plan('update_card', [{ coll: 'ideas', id: ID.preorder, patch: { title: undefined } }]),
        plan('create_card', [{ coll: 'ideas', id: 'i7', set: { title: 'x', pieceId: ID.planeA, x: 0, y: 0, tags: DELETE } }]),
        plan('update_card', [{ coll: 'ideas', id: 'nothing', patch: { title: 'x' } }]),
        plan('rename', [{ coll: 'workspace', id: WID, patch: { roles: {} } }]),
        plan('create', [{ coll: 'nope' as never, id: 'x', set: {} }]),
      ],
      fixtureWs(),
      ALICE,
    )
    expect(v.ok).toBe(false)
    if (v.ok) return
    const by = (op: string) => v.errors.filter((e) => e.op === op).map((e) => e.message).join('\n')
    expect(by('create_card')).toMatch(/isn't a valid feature/)
    expect(by('create_card')).toMatch(/colour isn't a field/)
    expect(by('create_card')).toMatch(/DELETE \(tags\) only works in a patch or a set with merge/)
    expect(by('update_card')).toMatch(/priority isn't a field it can have, or its value is of the wrong type or not one it allows/)
    expect(by('update_card')).toMatch(/title is undefined/)
    expect(by('update_card')).toMatch(/isn't there to change/)
    expect(by('rename')).toMatch(/only the workspace's name and description/)
    expect(by('create')).toMatch(/no collection nope/)
    for (const e of v.errors) expect(e.fix.length).toBeGreaterThan(5)
  })

  it("refuses only what the plan brings in: a package whose member was deleted earlier can still move", () => {
    const docs = fixtureDocs()
    docs.features = docs.features.filter((f) => f.id !== ID.loyalty)
    const ws = wsFrom(docs)
    expect(validate([plan('move', [{ coll: 'packages', id: ID.pkg, patch: { x: 325, y: 325 } }])], ws, ALICE)).toEqual({ ok: true })
    // A NEW dangling member is still refused, with one clear error.
    const v = validate([plan('update_card', [{ coll: 'packages', id: ID.pkg, patch: { memberIds: [ID.qr, ID.loyalty, 'ghost'] } }])], ws, ALICE)
    expect(v.ok).toBe(false)
    if (v.ok) return
    expect(v.errors.map((e) => e.message)).toEqual([`packages/${ID.pkg}: member ghost isn't a card in the workspace`])
  })

  it("a field the cleaner would rewrite doesn't fail an unrelated patch: a deck with no columns can be renamed", () => {
    const docs = fixtureDocs()
    const deck = docs.pieces.find((p) => p.id === ID.deck)!
    deck.kanban = { cols: [] }
    deck.name = '  Build  '
    const ws = wsFrom(docs)
    expect(validate([plan('rename', [{ coll: 'pieces', id: ID.deck, patch: { w: 925 } }])], ws, ALICE)).toEqual({ ok: true })
    // Writing the bad field itself is refused.
    const v = validate([plan('setup', [{ coll: 'pieces', id: ID.deck, patch: { kanban: { cols: [{ id: 'a b c', name: 'x' }] } } }])], ws, ALICE)
    expect(v.ok).toBe(false)
  })

  it('a piece stuck to a missing piece gets one clear error', () => {
    const v = validate([plan('create_piece', [{ coll: 'pieces', id: 'm9', set: { kind: 'matrix', x: 0, y: 0, w: 800, h: 500, stuckTo: 'ghost', matrix: { rows: { items: [] }, cols: { items: [] }, cell: 'scale', steps: [] } } }])], fixtureWs(), ALICE)
    expect(v.ok).toBe(false)
    if (v.ok) return
    expect(v.errors.map((e) => e.message)).toEqual(["pieces/m9: points at piece ghost, which isn't in the workspace"])
  })

  it('a stale stuckTo (its host deleted long ago) does not fail a move; deleting the host in the batch does', () => {
    const docs = fixtureDocs()
    docs.pieces = docs.pieces.filter((p) => p.id !== ID.planeA)
    expect(validate([plan('move', [{ coll: 'pieces', id: ID.deck, patch: { x: 25 } }])], wsFrom(docs), ALICE)).toEqual({ ok: true })
    const v = validate([plan('delete', [{ coll: 'pieces', id: ID.planeA, del: true }]), plan('move', [{ coll: 'pieces', id: ID.deck, patch: { x: 25 } }])], fixtureWs(), ALICE)
    expect(v).toMatchObject({ ok: false, errors: [{ op: 'move', message: expect.stringMatching(/points at piece/) }] })
  })

  it('merge goes only with a set; DELETE is fine in a merged set', () => {
    expect(validate([plan('x', [{ coll: 'cells', id: `${ID.matrix}_${ID.orderly}_${ID.qr}`, merge: true, patch: { value: 'none' } }])], fixtureWs(), ALICE)).toMatchObject({ ok: false, errors: [{ message: expect.stringMatching(/merge goes with a set/) }] })
    expect(validate([plan('x', [{ coll: 'cells', id: `${ID.matrix}_${ID.orderly}_${ID.qr}`, merge: true, set: { notes: DELETE } }])], fixtureWs(), ALICE)).toEqual({ ok: true })
  })

  it('catches one handle naming two things', () => {
    const v = validate([plan('a', [], { $a: 'x1' }), plan('b', [], { $a: 'x2' })], fixtureWs(), ALICE)
    expect(v).toMatchObject({ ok: false, errors: [{ op: 'b', message: expect.stringMatching(/\$a names two/) }] })
  })
})

describe('diff', () => {
  it('classifies added, removed, changed and moved', () => {
    const ws = fixtureWs()
    const next = project(ws, [
      plan('create_card', [{ coll: 'ideas', id: 'i1', set: { title: 'New', pieceId: ID.planeA, x: 0, y: 400 } }]),
      plan('delete', [{ coll: 'edges', id: ID.e2, del: true }]),
      plan('update_card', [{ coll: 'problems', id: ID.menu, patch: { title: 'Menus change hourly' } }]),
      plan('move', [{ coll: 'problems', id: ID.queue, patch: { x: 75, y: 250 } }]),
      plan('move_card', [{ coll: 'ideas', id: ID.preorder, patch: { pieceId: ID.planeB } }]),
    ])
    const d = diff(ws, next)
    expect(d.get('i1')).toEqual({ kind: 'ideas', change: 'added' })
    expect(d.get(ID.e2)).toMatchObject({ kind: 'edges', change: 'removed', was: { id: ID.e2 } })
    expect(d.get(ID.menu)).toMatchObject({ kind: 'problems', change: 'changed', fields: ['title'], was: { title: 'Menus change daily' } })
    expect(d.get(ID.queue)).toMatchObject({ kind: 'problems', change: 'moved', fields: ['x', 'y'] })
    expect(d.get(ID.preorder)).toMatchObject({ change: 'moved', fields: ['pieceId'] })
    // Nothing else changed.
    expect([...d.keys()].sort()).toEqual(['i1', ID.e2, ID.menu, ID.preorder, ID.queue].sort())
  })
})

describe('autoId', () => {
  it('makes 20 characters of A–Z a–z 0–9, different each time', () => {
    const a = autoId()
    expect(a).toMatch(/^[A-Za-z0-9]{20}$/)
    expect(autoId()).not.toBe(a)
  })

  it('takes its random bytes from what it is given, and skips biased bytes', () => {
    // 248 and up are thrown away; 0 → 'A', 61 → '9', 62 → 'A' again.
    const bytes = (n: number) => new Uint8Array(n).map((_, i) => [255, 0, 61, 62][i % 4])
    expect(autoId(bytes)).toBe('A9A'.repeat(7).slice(0, 20))
  })
})
