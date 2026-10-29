// S13 (D-312; agent.md §4.5, §7.2 point 2): the agent's writes in the browser (src/agent/browser.ts) over the real apply on a
// fake Firestore (the same fake as apply.test.ts): a turn's accept is ONE undo step as the agent; auto-apply's applies with
// agent-turn:<id> + mergeAlways merge into one; the person is locked out during a turn (so nothing comes between them);
// the chat's [undo] restores the exact docs, and only while the step is the last.
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---- The fake: docs by path; a batch applies to it when committed (as Firestore applies to its local cache at once).
const fake = vi.hoisted(() => {
  const DEL = { __deleteField: true }
  const data = new Map<string, Record<string, unknown>>()
  const commits = { n: 0, batches: [] as number[] }
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
  return { DEL, data, commits, ref, patch, merge }
})

vi.mock('../../src/data/firebase', () => ({ db: () => ({}), firebase: null, useEmulators: false }))
vi.mock('firebase/firestore', () => {
  const snap = (path: string) => ({ exists: () => fake.data.has(path), data: () => structuredClone(fake.data.get(path)) })
  return {
    doc: (_db: unknown, ...segments: string[]) => fake.ref(segments.join('/')),
    deleteField: () => fake.DEL,
    getDocFromCache: async (r: { path: string }) => snap(r.path),
    getDoc: async (r: { path: string }) => snap(r.path),
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
          ops.forEach((op) => op())
          return Promise.resolve()
        },
      }
      return b
    },
  }
})

import { onTracked, setReadOnly, tracked, undo, useHistory } from '../../src/data/history'
import { WS_COLLECTIONS } from '../../src/model/fromDocs'
import { browserApply, lockTurn, unlockTurn, undoAgentStep, holdLock, releaseLock, locksHeld, lockPreview, releaseAgentLocks, PREVIEW_LOCK } from '../../src/agent/browser'
import { redo } from '../../src/data/history'
import { fromDocs } from '../../src/model/fromDocs'
import type { WorkspaceCtx } from '../../src/state/wsStore'
import { addCall, accept, emptyChangeset } from '../../src/agent/changeset'
import { AGENT_LOCK } from '../../src/agent/workflow'
import { counterIds } from '../../src/ops/newId'
import { ALICE, fixtureDocs, fixtureWs, ID, WID, WORKSPACE } from './fixtures/ws'

const path = (coll: string, id: string) => `workspaces/${WID}/${coll}/${id}`

function seed() {
  fake.data.clear()
  const docs = fixtureDocs()
  for (const c of WS_COLLECTIONS) for (const { id, ...d } of docs[c]) fake.data.set(path(c, id), d)
  const { id: _, ...w } = WORKSPACE
  fake.data.set(`workspaces/${WID}`, structuredClone(w))
  useHistory.setState({ wid: WID, past: [], future: [], notice: null })
}

let newId = counterIds('brw')
const ctx = () => ({ live: fixtureWs(), actor: { ...ALICE, agent: true }, now: 1_790_000_000_500, newId })
const pending = (ops: { op: string; args: Record<string, unknown> }[]) => {
  const r = addCall(emptyChangeset(), ops, ctx())
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.cs
}
const TWO = [
  { op: 'create_card', args: { type: 'idea', plane: ID.planeA, title: 'Tip jar', handle: '$a' } },
  { op: 'link', args: { from: '$a', to: ID.queue, kind: 'solves' } },
]

describe('the agent in the browser', () => {
  beforeEach(() => {
    seed()
    unlockTurn()
    newId = counterIds('brw')
  })

  it("a turn's accept is ONE undo step, the agent's, under the turn's lock; [undo] gives the docs back exactly", async () => {
    const heard: (string | undefined)[] = []
    const off = onTracked((_l, meta) => heard.push(meta?.actor))
    const before = new Map(fake.data)
    lockTurn()
    const a = await accept(pending(TWO), browserApply(WID, ALICE, fixtureWs))
    off()
    expect(a.ok).toBe(true)
    if (!a.ok) return
    const { past } = useHistory.getState()
    expect(past).toHaveLength(1)
    expect(past[0].label).toBe('agent: add an idea, link')
    expect(a.step?.key).toBe(past[0].key)
    expect(heard).toEqual(['agent'])
    expect(fake.data.get(path('ideas', 'brw001'))).toMatchObject({ title: 'Tip jar' })
    // Still locked for the person after the agent's write.
    expect(locksHeld()).toEqual(['agent'])
    await tracked('person edit', [], async () => {})
    expect(useHistory.getState().past).toHaveLength(1)
    expect(useHistory.getState().notice?.text).toBe(AGENT_LOCK)
    unlockTurn()
    expect(await undoAgentStep(a.step!.key)).toBe(true)
    await Promise.resolve()
    expect(new Map(fake.data)).toEqual(before)
  })

  it("auto-apply: two applies with agent-turn:<id> + mergeAlways are one step (onTracked told each time, as the agent; the step's before kept)", async () => {
    const heard: (string | undefined)[] = []
    const off = onTracked((_l, meta) => heard.push(meta?.actor))
    const before = new Map(fake.data)
    lockTurn()
    const apply = browserApply(WID, ALICE, fixtureWs)
    const one = await accept(pending([TWO[0]]), apply, { key: 'agent-turn:7', mergeAlways: true })
    const first = useHistory.getState().past[0]
    const two = await accept(pending([{ op: 'create_card', args: { type: 'idea', plane: ID.planeA, title: 'Coffee card' } }]), apply, { key: 'agent-turn:7', mergeAlways: true })
    expect(fake.data.size).toBe(before.size + 2)
    off()
    expect([one.ok, two.ok]).toEqual([true, true])
    const { past } = useHistory.getState()
    expect(past).toHaveLength(1)
    expect(past[0].key).toBe('agent-turn:7')
    expect(past[0].before).toBe(first.before)
    expect(heard).toEqual(['agent', 'agent'])
    unlockTurn()
    await undo()
    await Promise.resolve()
    // The merged step holds both batches' docs (history.ts joins new docs into a merged step), so one undo gives the
    // exact start back.
    expect(past[0].before.map((b) => b.ref.path)).toEqual([path('ideas', 'brw001'), path('ideas', 'brw002')])
    expect(past[0].after).toHaveLength(2)
    expect(new Map(fake.data)).toEqual(before)
  })

  it('a person write while the agent works is refused; another lock (a viewer) refuses the agent too; [undo] only while last', async () => {
    lockTurn()
    await tracked('x', [], async () => {})
    expect(useHistory.getState().notice?.text).toBe(AGENT_LOCK)
    await undo()
    expect(useHistory.getState().notice?.text).toBe(AGENT_LOCK)
    unlockTurn()
    // A lock the agent doesn't hold (the viewer's) stays: the apply is refused, nothing recorded.
    holdLock('agent', AGENT_LOCK)
    releaseLock('agent')

    setReadOnly('You can only view this workspace', 'viewer')
    const r = await browserApply(WID, ALICE, fixtureWs)(pending(TWO).plans, { actor: 'agent' })
    setReadOnly(null, 'viewer')
    expect(r.ok).toBe(false)
    expect(useHistory.getState().past).toHaveLength(0)
    // [undo] refuses when the step isn't the last.
    const a = await accept(pending(TWO), browserApply(WID, ALICE, fixtureWs))
    if (!a.ok) throw new Error('refused')
    await tracked('person after', [], async () => {}, { key: 'p' })
    expect(await undoAgentStep(a.step!.key)).toBe(false)
  })

  it('a refused plan comes back as errors, never thrown', async () => {
    const plans = [{ op: 'update_card', label: 'x', writes: [{ coll: 'ideas' as const, id: 'nope', patch: { title: 'x' } }], ids: {} }]
    const r = await browserApply(WID, ALICE, fixtureWs)(plans, { actor: 'agent' })
    expect(r.ok).toBe(false)
  })

  it('a merged step whose second batch changes only the first one\'s card: undo then redo bring back every doc (the link too)', async () => {
    lockTurn()
    const apply = browserApply(WID, ALICE, live)
    const before = new Map(fake.data)
    const one = await accept(pending(TWO), apply, { key: 'agent-turn:c1:2', mergeAlways: true })
    expect(one.ok).toBe(true)
    const r = addCall(emptyChangeset(), [{ op: 'update_card', args: { card: 'brw001', title: 'Tip jar 2' } }], { ...ctx(), live: live() })
    if (!r.ok) throw new Error(JSON.stringify(r.errors))
    const two = await accept(r.cs, apply, { key: 'agent-turn:c1:2', mergeAlways: true })
    expect(two.ok).toBe(true)
    const step = useHistory.getState().past[0]
    expect(useHistory.getState().past).toHaveLength(1)
    expect(step.after.map((a) => a.ref.path).sort()).toEqual([path('edges', 'brw002'), path('ideas', 'brw001')].sort())
    const after = new Map(fake.data)
    unlockTurn()
    await undo()
    await Promise.resolve()
    expect(new Map(fake.data)).toEqual(before)
    await redo()
    await Promise.resolve()
    expect(fake.data.get(path('edges', 'brw002'))).toBeTruthy()
    expect(fake.data.get(path('ideas', 'brw001'))).toMatchObject({ title: 'Tip jar 2' })
    expect(new Map(fake.data)).toEqual(after)
  })

  it('releaseAgentLocks frees every lock the agent holds (the turn and the preview, its own message)', async () => {
    lockTurn()
    lockPreview()
    await tracked('x', [], async () => {})
    expect([AGENT_LOCK, PREVIEW_LOCK]).toContain(useHistory.getState().notice?.text)
    expect(locksHeld().sort()).toEqual(['agent', 'preview'])
    releaseAgentLocks()
    expect(locksHeld()).toEqual([])
    await tracked('person', [], async () => {})
    expect(useHistory.getState().past.map((p) => p.label)).toEqual(['person'])
  })
})

// The fake store as the listeners would read it (for a second batch built on the first's result).
function live(): WorkspaceCtx {
  const docs = Object.fromEntries(WS_COLLECTIONS.map((c) => [c, [] as Record<string, unknown>[]])) as Record<string, Record<string, unknown>[]>
  const prefix = `workspaces/${WID}/`
  for (const [p, d] of fake.data) {
    if (!p.startsWith(prefix)) continue
    const [c, id] = p.slice(prefix.length).split('/')
    docs[c].push({ ...structuredClone(d), id })
  }
  for (const c of WS_COLLECTIONS) docs[c].sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1))
  const base = fixtureWs()
  return { ...base, ...fromDocs(docs as never, base.documents) }
}
