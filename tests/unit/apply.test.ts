// apply (src/ops/firestore.ts) on a fake Firestore: the gate "apply of N plans = one undo step".
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---- The fake: docs by path; a batch applies to it when committed (as Firestore applies to its local cache at once).
const fake = vi.hoisted(() => {
  const DEL = { __deleteField: true }
  const data = new Map<string, Record<string, unknown>>()
  const commits = { n: 0, batches: [] as number[] }
  // As Firestore is: the cache has nothing for a doc that never existed; offline, a read past it fails. `failAt`: the
  // commit (counted from 1) the server refuses.
  const net = { offline: false, failAt: 0, slow: false }
  type Ref = { path: string; id: string; parent: { id: string } }
  const ref = (path: string): Ref => {
    const parts = path.split('/')
    return { path, id: parts[parts.length - 1], parent: { id: parts[parts.length - 2] ?? '' } }
  }
  const patch = (cur: Record<string, unknown>, fields: Record<string, unknown>) => {
    const next = structuredClone(cur)
    for (const [path, v] of Object.entries(fields)) {
      const parts = path.split('.')
      let o = next
      for (const p of parts.slice(0, -1)) o = (o[p] ??= {}) as Record<string, unknown>
      const last = parts[parts.length - 1]
      if (v === DEL) delete o[last]
      else o[last] = structuredClone(v)
    }
    return next
  }
  // Set with merge: maps merged key by key, the rest replaced, the sentinel removes.
  const merge = (cur: Record<string, unknown>, d: Record<string, unknown>): Record<string, unknown> => {
    const out = structuredClone(cur)
    for (const [k, v] of Object.entries(d)) {
      if (v === DEL) delete out[k]
      else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = merge((out[k] as Record<string, unknown>) ?? {}, v as Record<string, unknown>)
      else out[k] = structuredClone(v)
    }
    return out
  }
  return { DEL, data, commits, net, ref, patch, merge }
})

vi.mock('../../src/data/firebase', () => ({ db: () => ({}), firebase: null, useEmulators: false }))
vi.mock('firebase/firestore', () => {
  const snap = (path: string) => ({ exists: () => fake.data.has(path), data: () => structuredClone(fake.data.get(path)) })
  return {
    doc: (_db: unknown, ...segments: string[]) => fake.ref(segments.join('/')),
    deleteField: () => fake.DEL,
    getDocFromCache: async (r: { path: string }) => {
      if (fake.net.offline && !fake.data.has(r.path)) throw new Error('Failed to get document from cache')
      return snap(r.path)
    },
    getDoc: async (r: { path: string }) => {
      if (fake.net.offline) throw new Error('Failed to get document because the client is offline')
      return snap(r.path)
    },
    deleteDoc: async (r: { path: string }) => void fake.data.delete(r.path),
    writeBatch: () => {
      const ops: (() => void)[] = []
      const b = {
        set: (r: { path: string }, d: Record<string, unknown>, o?: { merge?: boolean }) => (ops.push(() => fake.data.set(r.path, o?.merge ? fake.merge(fake.data.get(r.path) ?? {}, d) : structuredClone(d))), b),
        update: (r: { path: string }, d: Record<string, unknown>) =>
          (ops.push(() => {
            const cur = fake.data.get(r.path)
            if (!cur) throw new Error(`NOT_FOUND ${r.path}`)
            fake.data.set(r.path, fake.patch(cur, d))
          }),
          b),
        delete: (r: { path: string }) => (ops.push(() => fake.data.delete(r.path)), b),
        commit: () => {
          fake.commits.n++
          fake.commits.batches.push(ops.length)
          if (fake.commits.n === fake.net.failAt) return fake.net.slow ? new Promise((_, no) => setTimeout(() => no(new Error('PERMISSION_DENIED')), 5)) : Promise.reject(new Error('PERMISSION_DENIED'))
          ops.forEach((op) => op())
          return Promise.resolve()
        },
      }
      return b
    },
  }
})

import { apply } from '../../src/ops/firestore'
import { onTracked, redo, setReadOnly, undo, useHistory } from '../../src/data/history'
import { ATOMIC_WRITE_BYTES, ATOMIC_WRITE_MAX } from '../../src/model/limits'
import { WS_COLLECTIONS } from '../../src/model/fromDocs'
import { DELETE } from '../../src/ops/types'
import { wsFrom } from './fixtures/ws'
import { OpsRefused, type Plan } from '../../src/ops/types'
import { project } from '../../src/ops/project'
import { arrangeAny } from '../../src/ops/arrange'
import { counterIds } from '../../src/ops/newId'
import type { Docs, RawDoc } from '../../src/model/fromDocs'
import { ALICE, CAROL, fixtureDocs, fixtureWs, ID, T, WID, WORKSPACE } from './fixtures/ws'

const path = (coll: string, id: string) => `workspaces/${WID}/${coll}/${id}`

function seed() {
  fake.data.clear()
  fake.commits.n = 0
  fake.commits.batches = []
  fake.net.offline = false
  fake.net.failAt = 0
  fake.net.slow = false
  const docs = fixtureDocs()
  for (const c of WS_COLLECTIONS) for (const { id, ...d } of docs[c]) fake.data.set(path(c, id), d)
  const { id: _, ...w } = WORKSPACE
  fake.data.set(`workspaces/${WID}`, structuredClone(w))
  useHistory.setState({ wid: WID, past: [], future: [], notice: null })
}

// The fake store as the listeners would read it.
function listened() {
  const docs = Object.fromEntries(WS_COLLECTIONS.map((c) => [c, [] as RawDoc[]])) as Docs
  const prefix = `workspaces/${WID}/`
  for (const [p, d] of fake.data) {
    if (!p.startsWith(prefix)) continue
    const [c, id] = p.slice(prefix.length).split('/') as [keyof Docs, string]
    docs[c].push({ ...structuredClone(d), id })
  }
  for (const c of WS_COLLECTIONS) docs[c].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return wsFrom(docs, { ...structuredClone(fake.data.get(`workspaces/${WID}`)!), id: WID })
}

const plans = (): Plan[] => [
  { op: 'create_card', label: 'add an idea', writes: [{ coll: 'ideas', id: 'idNew000000000000001', set: { title: 'Tip jar', pieceId: ID.planeA, x: 50, y: 400, createdAt: T, updatedAt: T } }], ids: { $a: 'idNew000000000000001' }, meta: { kind: 'card' } },
  { op: 'link', label: 'link', writes: [{ coll: 'edges', id: 'edNew000000000000001', set: { fromId: 'idNew000000000000001', fromType: 'idea', toId: ID.queue, toType: 'problem', kind: 'solves' } }], ids: { $b: 'edNew000000000000001' } },
  { op: 'update_card', label: 'edit a problem', writes: [{ coll: 'problems', id: ID.menu, patch: { title: 'Menus change hourly', updatedAt: T + 1 } }], ids: {} },
  { op: 'unlink', label: 'unlink', writes: [{ coll: 'edges', id: ID.e4, del: true }], ids: {} },
  { op: 'rename', label: 'rename the workspace', writes: [{ coll: 'workspace', id: WID, patch: { name: 'Tablebook GmbH' } }], ids: {} },
]

describe('apply', () => {
  beforeEach(seed)

  it('apply of N plans = one undo step', async () => {
    const heard: { label: string; meta?: object }[] = []
    const off = onTracked((label, meta) => heard.push({ label, meta }))
    const before = new Map(fake.data)
    const res = await apply(WID, plans(), { ws: fixtureWs(), by: ALICE, actor: 'agent' })
    off()

    // project equals what apply writes, through the real adapter: the fake store read by the listeners' converters.
    expect(listened()).toEqual(project(fixtureWs(), plans()))

    // The ids at once, the step recorded, the writes issued locally.
    expect(res.ids).toEqual({ $a: 'idNew000000000000001', $b: 'edNew000000000000001' })
    expect(fake.data.get(path('ideas', 'idNew000000000000001'))).toMatchObject({ title: 'Tip jar' })
    expect(fake.data.get(path('problems', ID.menu))).toMatchObject({ title: 'Menus change hourly' })
    expect(fake.data.has(path('edges', ID.e4))).toBe(false)
    expect(fake.data.get(`workspaces/${WID}`)).toMatchObject({ name: 'Tablebook GmbH', roles: WORKSPACE.roles })
    await res.written

    // Exactly one step, its refs every written doc, before and after.
    const { past } = useHistory.getState()
    expect(past).toHaveLength(1)
    const step = past[0]
    expect(step.key).toBe(res.step!.key)
    expect(step.key).toMatch(/^ops:/)
    expect(step.label).toBe('add an idea, link, edit a problem, unlink, rename the workspace')
    const refs = [path('ideas', 'idNew000000000000001'), path('edges', 'edNew000000000000001'), path('problems', ID.menu), path('edges', ID.e4), `workspaces/${WID}`]
    expect(step.before.map((s) => s.ref.path)).toEqual(refs)
    expect(step.after.map((s) => s.ref.path)).toEqual(refs)
    expect(step.before.map((s) => s.data === null)).toEqual([true, true, false, false, false])
    expect(step.after.map((s) => s.data === null)).toEqual([false, false, false, true, false])
    // The workspace doc: only its name and description are tracked.
    expect(step.before[4].data).toEqual({ name: 'Tablebook', description: WORKSPACE.description })

    // onTracked heard it once, with the ops, the new ids and the actor.
    expect(heard).toEqual([
      {
        label: step.label,
        meta: {
          op: 'create_card,link,update_card,unlink,rename',
          ops: ['create_card', 'link', 'update_card', 'unlink', 'rename'],
          ids: ['idNew000000000000001', 'edNew000000000000001', ID.menu, ID.e4, WID],
          created: ['idNew000000000000001', 'edNew000000000000001'],
          actor: 'agent',
        },
      },
    ])

    // Undo puts every doc back as it was, in one go.
    await undo()
    await Promise.resolve()
    expect(useHistory.getState().past).toHaveLength(0)
    expect(new Map(fake.data)).toEqual(before)
  })

  it('two applies are two steps (unique keys never merge), each write one batch', async () => {
    const many: Plan = {
      op: 'set_cell',
      label: 'fill 500 cells',
      ids: {},
      writes: Array.from({ length: 500 }, (_, i) => ({ coll: 'cells' as const, id: `${ID.matrix}_${ID.orderly}_r${i}`, set: { matrixId: ID.matrix, row: ID.orderly, col: `r${i}`, value: 'full', updatedAt: T } })),
    }
    const a = await apply(WID, [plans()[2]], { ws: fixtureWs(), by: ALICE })
    const b = await apply(WID, [many], { ws: fixtureWs(), by: ALICE })
    await b.written
    expect(a.step!.key).not.toBe(b.step!.key)
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['edit a problem', 'fill 500 cells'])
    expect(fake.commits.batches).toEqual([1, 500])
    expect(useHistory.getState().past[1].after.every((s) => s.data)).toBe(true)
  })

  it('a set with merge merges into the doc (or makes it), DELETE takes a field away; undo puts it back', async () => {
    const cell = `${ID.matrix}_${ID.orderly}_${ID.loyalty}`
    const fresh = `${ID.matrix}_${ID.orderly}_${ID.qr}x`
    const ps: Plan[] = [
      { op: 'set_cell', label: 'set a cell', ids: {}, writes: [{ coll: 'cells', id: cell, merge: true, set: { value: 'full', confidence: DELETE, updatedAt: T + 5 } }] },
      { op: 'set_cell', label: 'set a cell', ids: {}, writes: [{ coll: 'cells', id: fresh, merge: true, set: { matrixId: ID.matrix, row: ID.orderly, col: `${ID.qr}x`, value: 'none', updatedAt: T } }] },
    ]
    const before = new Map(fake.data)
    const res = await apply(WID, ps, { ws: fixtureWs(), by: ALICE })
    expect(fake.data.get(path('cells', cell))).toEqual({ matrixId: ID.matrix, row: ID.orderly, col: ID.loyalty, value: 'full', updatedAt: T + 5 })
    expect(listened()).toEqual(project(fixtureWs(), ps))
    await res.written
    // The new cell isn't one the plans named as made: its before was read (nothing there).
    expect(useHistory.getState().past[0].before.map((s) => s.data === null)).toEqual([false, true])
    await undo()
    expect(new Map(fake.data)).toEqual(before)
  })

  it('reads the before of every written doc the plans did not make, even one missing from the snapshot', async () => {
    // A doc another tab made a moment ago: not in the snapshot, but in the cache. Undo must put it back, not delete it.
    fake.data.set(path('labels', 'fromElsewhere0000001'), { pieceId: 'canvas', text: 'hi', x: 0, y: 0, createdAt: T })
    const p: Plan = { op: 'add_text', label: 'add text', ids: {}, writes: [{ coll: 'labels', id: 'fromElsewhere0000001', set: { pieceId: 'canvas', text: 'mine', x: 0, y: 0, createdAt: T } }] }
    const res = await apply(WID, [p], { ws: fixtureWs(), by: ALICE })
    await res.written
    expect(useHistory.getState().past[0].before[0].data).toMatchObject({ text: 'hi' })
  })

  it('returns step null when writes are refused between its check and tracked', async () => {
    // The lock comes on after apply's own writable() check: the plan's writes are read once by validate, then again
    // by apply after its check, and that second read locks.
    const p = plans()[2]
    let reads = 0
    const sneaky = {
      ...p,
      get writes() {
        if (++reads === 2) setReadOnly('Previewing', 'flip')
        return p.writes
      },
    } as Plan
    const res = await apply(WID, [sneaky], { ws: fixtureWs(), by: ALICE })
    setReadOnly(null, 'flip')
    expect(reads).toBe(2)
    expect(res.step).toBeNull()
    expect(fake.commits.n).toBe(0)
    expect(useHistory.getState().past).toHaveLength(0)
  })

  it('refuses what validate refuses, writing nothing', async () => {
    const bad: Plan = { op: 'link', label: 'link', ids: {}, writes: [{ coll: 'edges', id: 'e9', set: { fromId: ID.anna, fromType: 'customer', toId: 'ghost', toType: 'idea', kind: 'relates' } }] }
    await expect(apply(WID, [bad], { ws: fixtureWs(), by: ALICE })).rejects.toBeInstanceOf(OpsRefused)
    await expect(apply(WID, plans(), { ws: fixtureWs(), by: CAROL })).rejects.toThrow(/viewers can only read/)
    expect(fake.commits.n).toBe(0)
    expect(useHistory.getState().past).toHaveLength(0)
  })

  it('respects setReadOnly: nothing written, no step', async () => {
    setReadOnly('Previewing', 'test')
    const res = await apply(WID, plans(), { ws: fixtureWs(), by: ALICE })
    setReadOnly(null, 'test')
    expect(res.step).toBeNull()
    expect(fake.commits.n).toBe(0)
    expect(useHistory.getState().past).toHaveLength(0)
  })

  it('onTracked hears UI writes too, with their meta or none', async () => {
    const { tracked } = await import('../../src/data/history')
    const heard: unknown[] = []
    const off = onTracked((label, meta) => heard.push([label, meta]))
    const r = fake.ref(path('ideas', ID.preorder))
    await tracked('rename an idea', [r as never], async () => fake.data.set(r.path, { ...fake.data.get(r.path), title: 'x' }))
    await tracked('move an idea', [r as never], async () => {}, { meta: { kind: 'card', ids: [ID.preorder] } })
    off()
    expect(heard).toEqual([
      ['rename an idea', undefined],
      ['move an idea', { kind: 'card', ids: [ID.preorder] }],
    ])
  })
  it('an arrange by layout (S9): moves, carried members, headings made and a section grown are one step; undo puts all back', async () => {
    const ctx = { ws: fixtureWs(), actor: ALICE, now: T + 9, newId: counterIds('lay') }
    const ps = [
      arrangeAny(ctx, { items: [ID.anna, ID.barista, ID.queue, ID.menu, ID.preorder], layout: 'cluster', headings: true, where: { at: 'clear' } }),
      arrangeAny(ctx, { items: [ID.pkg, ID.orderly], layout: 'column' }),
    ]
    expect(ps[0].meta?.ids?.length).toBe(3)
    const before = new Map(fake.data)
    const res = await apply(WID, ps, { ws: fixtureWs(), by: ALICE, actor: 'agent' })
    await res.written
    expect(listened()).toEqual(project(fixtureWs(), ps))
    expect(useHistory.getState().past).toHaveLength(1)
    await undo()
    await Promise.resolve()
    expect(new Map(fake.data)).toEqual(before)
  })
  it('plans that write nothing (an arrange with nothing to move) record no step', async () => {
    const ctx = { ws: fixtureWs(), actor: ALICE, now: T + 9, newId: counterIds('lay') }
    // Anna alone in a row where she is: nothing moves.
    const plan = arrangeAny(ctx, { items: [ID.anna], layout: 'row' })
    expect(plan.writes).toEqual([])
    const res = await apply(WID, [plan], { ws: fixtureWs(), by: ALICE })
    await res.written
    expect(res.step).toBeNull()
    expect(useHistory.getState().past).toHaveLength(0)
    expect(fake.commits.n).toBe(0)
  })

  it('a doc a plan makes under a worked-out id (Plan.made) is not read first: offline, the write still goes', async () => {
    fake.net.offline = true
    const fresh = `${ID.matrix}_${ID.orderly}_${ID.qr}y`
    const p: Plan = { op: 'set_cell', label: 'set a cell', ids: {}, made: [fresh], writes: [{ coll: 'cells', id: fresh, merge: true, set: { matrixId: ID.matrix, row: ID.orderly, col: `${ID.qr}y`, value: 'full', updatedAt: T } }] }
    const res = await apply(WID, [p], { ws: fixtureWs(), by: ALICE })
    await res.written
    expect(fake.data.get(path('cells', fresh))).toMatchObject({ value: 'full' })
    expect(useHistory.getState().past[0].before[0].data).toBeNull()
    expect(res.ids).toEqual({})
  })

  // `n` new cells, each with `pad` characters of text.
  const cells = (n: number, tag: string, pad = 0): Plan => ({
    op: 'set_cell',
    label: `fill ${n} cells`,
    ids: {},
    writes: Array.from({ length: n }, (_, i) => ({ coll: 'cells' as const, id: `${ID.matrix}_${ID.orderly}_${tag}${i}`, set: { matrixId: ID.matrix, row: ID.orderly, col: `${tag}${i}`, value: 'full', notes: 'x'.repeat(pad), updatedAt: T } })),
  })
  const settled = () => new Promise((r) => setTimeout(r))

  it('up to ATOMIC_WRITE_MAX docs go as one batch: refused, nothing is written and no step stays', async () => {
    const before = new Map(fake.data)
    fake.net.failAt = 1
    const res = await apply(WID, [cells(ATOMIC_WRITE_MAX, 'a')], { ws: fixtureWs(), by: ALICE })
    await expect(res.written).rejects.toThrow('PERMISSION_DENIED')
    await settled()
    expect(fake.commits.batches).toEqual([ATOMIC_WRITE_MAX])
    expect(new Map(fake.data)).toEqual(before)
    expect(useHistory.getState().past).toHaveLength(0)
  })

  it("the undo and redo of a write past 450 docs are one batch each", async () => {
    const res = await apply(WID, [cells(600, 'u')], { ws: fixtureWs(), by: ALICE })
    await res.written
    await undo()
    await settled()
    await redo()
    await settled()
    expect(fake.commits.batches).toEqual([600, 600, 600])
  })

  it('past ATOMIC_WRITE_MAX docs it is cut in batches of at most 450', async () => {
    const res = await apply(WID, [cells(ATOMIC_WRITE_MAX + 100, 'o')], { ws: fixtureWs(), by: ALICE })
    await res.written
    expect(fake.commits.batches).toEqual([450, 450, 200])
  })

  it('past ATOMIC_WRITE_BYTES it is cut by size too, however few docs', async () => {
    const res = await apply(WID, [cells(300, 'b', 20_000)], { ws: fixtureWs(), by: ALICE })
    await res.written
    expect(fake.commits.batches.length).toBeGreaterThan(1)
    expect(Math.max(...fake.commits.batches)).toBeLessThanOrEqual(Math.ceil(ATOMIC_WRITE_BYTES / 20_000))
  })

  it("a delete counts the size of what it deletes, and an undo's deletes what they delete", async () => {
    const made = await apply(WID, [cells(300, 'd', 20_000)], { ws: fixtureWs(), by: ALICE })
    await made.written
    fake.commits.batches = []
    const gone: Plan = { op: 'delete', label: 'delete cells', ids: {}, writes: cells(300, 'd').writes.map(({ coll, id }) => ({ coll, id, del: true })) }
    const res = await apply(WID, [gone], { ws: listened(), by: ALICE })
    await res.written
    expect(fake.commits.batches.length).toBeGreaterThan(1)
    // Taking the making back: the undo only says `delete`, the step's `after` knows how big they are.
    fake.commits.batches = []
    useHistory.setState({ past: useHistory.getState().past.slice(0, 1), future: [] })
    await undo()
    await settled()
    expect(fake.commits.batches.length).toBeGreaterThan(1)
  })

  it('split in batches, some refused: the step stays and undo takes back what went through', async () => {
    const before = new Map(fake.data)
    fake.net.failAt = 2
    const res = await apply(WID, [cells(ATOMIC_WRITE_MAX + 100, 'p')], { ws: fixtureWs(), by: ALICE })
    await expect(res.written).rejects.toThrow(/only part of it was saved/)
    await Promise.resolve()
    expect(useHistory.getState().past.map((s) => s.label)).toEqual([`fill ${ATOMIC_WRITE_MAX + 100} cells`])
    expect(useHistory.getState().notice?.text).toMatch(/^Only part of fill 1100 cells was saved/)
    await undo()
    await Promise.resolve()
    expect(new Map(fake.data)).toEqual(before)
  })

  it('an undo the server refuses changes nothing: its step stays to undo, nothing is left to redo', async () => {
    const res = await apply(WID, [cells(600, 'r')], { ws: fixtureWs(), by: ALICE })
    await res.written
    const step = useHistory.getState().past[0]
    fake.net.failAt = fake.commits.n + 1
    await undo()
    await settled()
    expect(useHistory.getState().past).toEqual([step])
    expect(useHistory.getState().future).toHaveLength(0)
    expect(useHistory.getState().notice?.text).toBe("Couldn't undo fill 600 cells")
  })

  it('a refused undo goes back where it was, under what was written since', async () => {
    const first = await apply(WID, [cells(1, 'f')], { ws: fixtureWs(), by: ALICE })
    await first.written
    // The server answers after the next write is recorded.
    fake.net.failAt = fake.commits.n + 1
    fake.net.slow = true
    await undo()
    const next = await apply(WID, [cells(2, 'n')], { ws: fixtureWs(), by: ALICE })
    await next.written
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['fill 2 cells'])
    await new Promise((r) => setTimeout(r, 10))
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['fill 1 cells', 'fill 2 cells'])
  })

  it('a redo the server refuses changes nothing: its step stays to redo', async () => {
    const res = await apply(WID, [cells(3, 'e')], { ws: fixtureWs(), by: ALICE })
    await res.written
    await undo()
    await settled()
    const step = useHistory.getState().future[0]
    fake.net.failAt = fake.commits.n + 1
    await redo()
    await settled()
    expect(useHistory.getState().past).toHaveLength(0)
    expect(useHistory.getState().future).toEqual([step])
    expect(useHistory.getState().notice?.text).toBe("Couldn't redo fill 3 cells")
  })

  it('an undo that lands in part says so, and redo puts it all back', async () => {
    const res = await apply(WID, [cells(ATOMIC_WRITE_MAX + 100, 'q')], { ws: fixtureWs(), by: ALICE })
    await res.written
    const all = new Map(fake.data)
    fake.net.failAt = fake.commits.n + 2
    await undo()
    await settled()
    expect(useHistory.getState().notice?.text).toMatch(/^Only part of the undo of fill 1100 cells was saved/)
    expect(useHistory.getState().future).toHaveLength(1)
    await redo()
    await settled()
    expect(new Map(fake.data)).toEqual(all)
  })

  it('every batch refused: nothing went through, the step goes', async () => {
    fake.net.failAt = 1
    const res = await apply(WID, [plans()[2]], { ws: fixtureWs(), by: ALICE })
    await expect(res.written).rejects.toThrow('PERMISSION_DENIED')
    await Promise.resolve()
    expect(useHistory.getState().past).toHaveLength(0)
    expect(useHistory.getState().notice?.text).toBe("Couldn't edit a problem: the server refused it")
  })
})
