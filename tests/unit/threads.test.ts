// src/data/threads.ts on a fake Firestore that keeps what each call wrote (the audit's P1 #1, #7, #8): the task read
// marks never touch `seen`, a deleted newest message hands the preview back, a long thread is deleted to the end.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => {
  const DEL = { __deleteField: true }
  const INC = (n: number) => ({ __increment: n })
  const data = new Map<string, Record<string, unknown>>()
  const calls: { op: string; path: string; fields?: Record<string, unknown> }[] = []
  const batches: string[][] = []
  let auto = 0
  const ref = (path: string) => ({ path, id: path.split('/').pop()! })
  // Firestore's own set-with-merge: a map value replaces what was there when it's empty (no leaf to merge).
  const merge = (cur: Record<string, unknown>, d: Record<string, unknown>) => {
    const out = structuredClone(cur)
    for (const [k, v] of Object.entries(d)) {
      if (v === DEL) delete out[k]
      else if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0)
        out[k] = merge((out[k] as Record<string, unknown>) ?? {}, v as Record<string, unknown>)
      else out[k] = structuredClone(v)
    }
    return out
  }
  const update = (cur: Record<string, unknown>, d: Record<string, unknown>) => {
    const out = structuredClone(cur)
    for (const [k, v] of Object.entries(d)) {
      if (v === DEL) delete out[k]
      else if (v && typeof v === 'object' && '__increment' in v) out[k] = ((out[k] as number) ?? 0) + (v as { __increment: number }).__increment
      else out[k] = structuredClone(v)
    }
    return out
  }
  return { DEL, INC, data, calls, batches, ref, merge, update, next: () => `auto${++auto}` }
})

vi.mock('../../src/data/firebase', () => ({ db: () => ({}), firebase: { auth: { currentUser: { uid: 'u-alice', displayName: 'Alice' } } } }))
vi.mock('../../src/data/hooks', () => ({ useDoc: () => null, useQuery: () => null, useWorkspaceCollection: () => null }))
vi.mock('firebase/firestore', () => {
  type Q = { path: string; order?: 'asc' | 'desc'; max?: number }
  const children = (q: Q) => {
    const prefix = `${q.path}/`
    let rows = [...fake.data].filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    rows.sort(([, a], [, b]) => (a.createdAt as number) - (b.createdAt as number))
    if (q.order === 'desc') rows.reverse()
    if (q.max !== undefined) rows = rows.slice(0, q.max)
    const docs = rows.map(([p, d]) => ({ id: p.split('/').pop()!, ref: fake.ref(p), data: () => structuredClone(d) }))
    return { docs, empty: docs.length === 0, size: docs.length }
  }
  return {
    collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
    doc: (base: { path?: string }, ...segments: string[]) =>
      typeof base?.path === 'string' ? fake.ref(`${base.path}/${segments[0] ?? fake.next()}`) : fake.ref(segments.join('/')),
    query: (c: { path: string }, ...parts: Partial<Q>[]) => Object.assign({ path: c.path }, ...parts),
    orderBy: (_f: string, order: 'asc' | 'desc' = 'asc') => ({ order }),
    limit: (max: number) => ({ max }),
    getDocs: async (q: Q) => children(q),
    deleteField: () => fake.DEL,
    increment: (n: number) => fake.INC(n),
    arrayUnion: (...v: unknown[]) => v,
    setDoc: async (r: { path: string }, d: Record<string, unknown>) => {
      fake.calls.push({ op: 'set', path: r.path, fields: d })
      fake.data.set(r.path, fake.merge(fake.data.get(r.path) ?? {}, d))
    },
    updateDoc: async (r: { path: string }, d: Record<string, unknown>) => {
      fake.calls.push({ op: 'update', path: r.path, fields: d })
      const cur = fake.data.get(r.path)
      if (!cur) throw Object.assign(new Error('No document to update'), { code: 'not-found' })
      fake.data.set(r.path, fake.update(cur, d))
    },
    writeBatch: () => {
      const ops: (() => void)[] = []
      const paths: string[] = []
      const b = {
        set: (r: { path: string }, d: Record<string, unknown>) => (paths.push(`set ${r.path}`), ops.push(() => fake.data.set(r.path, d)), b),
        update: (r: { path: string }, d: Record<string, unknown>) => (
          paths.push(`update ${r.path}`), ops.push(() => fake.data.set(r.path, fake.update(fake.data.get(r.path)!, d))), b
        ),
        delete: (r: { path: string }) => (paths.push(`delete ${r.path}`), ops.push(() => fake.data.delete(r.path)), b),
        commit: async () => {
          ops.forEach((op) => op())
          fake.batches.push(paths)
        },
      }
      return b
    },
  }
})

import { deleteMessage, deleteThread, markTasksSeen } from '../../src/data/threads'

const W = 'workspaces/w1'
const msg = (tid: string, id: string, uid: string, text: string, createdAt: number) =>
  fake.data.set(`${W}/threads/${tid}/messages/${id}`, { uid, name: uid === 'u-alice' ? 'Alice' : 'Bob', text, createdAt })

beforeEach(() => {
  fake.data.clear()
  fake.calls.length = 0
  fake.batches.length = 0
})

describe('markTasksSeen', () => {
  it("keeps the threads you've read", async () => {
    fake.data.set(`${W}/threadReads/u-alice`, { seen: { t1: 5, t2: 9 }, updatedAt: 1 })
    await markTasksSeen('w1', 100)
    expect(fake.data.get(`${W}/threadReads/u-alice`)).toMatchObject({ seen: { t1: 5, t2: 9 }, tasks: 100 })
    expect(fake.calls.every((c) => !('seen' in (c.fields ?? {})))).toBe(true)
  })

  it('makes the doc with an empty `seen` the first time', async () => {
    await markTasksSeen('w1', 100)
    expect(fake.data.get(`${W}/threadReads/u-alice`)).toMatchObject({ seen: {}, tasks: 100 })
  })
})

describe('deleteMessage', () => {
  beforeEach(() => {
    fake.data.set(`${W}/threads/t1`, { count: 2, lastAt: 20, lastUid: 'u-alice', lastName: 'Alice', lastText: 'mine, newest' })
    msg('t1', 'm1', 'u-bob', 'first, from Bob', 10)
    msg('t1', 'm2', 'u-alice', 'mine, newest', 20)
  })

  it('gives the preview back to the message before the newest', async () => {
    await deleteMessage('w1', 't1', 'm2', false)
    expect(fake.data.get(`${W}/threads/t1`)).toMatchObject({
      count: 1, lastMid: 'm1', lastAt: 10, lastUid: 'u-bob', lastName: 'Bob', lastText: 'first, from Bob',
    })
  })

  it('leaves the preview when an older message goes', async () => {
    msg('t1', 'm0', 'u-alice', 'older', 5)
    await deleteMessage('w1', 't1', 'm0', false)
    expect(fake.data.get(`${W}/threads/t1`)).toMatchObject({ count: 1, lastUid: 'u-alice', lastText: 'mine, newest' })
    expect(fake.data.get(`${W}/threads/t1`)).not.toHaveProperty('lastMid')
  })

  it('leaves out a text too long for the preview', async () => {
    msg('t1', 'm1', 'u-bob', 'x'.repeat(161), 10)
    await deleteMessage('w1', 't1', 'm2', false)
    const t = fake.data.get(`${W}/threads/t1`)!
    expect(t).toMatchObject({ lastMid: 'm1', lastUid: 'u-bob' })
    expect(t).not.toHaveProperty('lastText')
  })
})

describe('deleteThread', () => {
  it('deletes every message of a long thread, the thread in the first batch', async () => {
    fake.data.set(`${W}/threads/t1`, { count: 1000, lastAt: 1 })
    for (let i = 0; i < 1000; i++) msg('t1', `m${i}`, i % 2 ? 'u-bob' : 'u-alice', 'hi', i)
    await deleteThread('w1', 't1')
    expect([...fake.data.keys()].filter((p) => p.startsWith(`${W}/threads/t1`))).toEqual([])
    expect(fake.batches[0]).toContain(`delete ${W}/threads/t1`)
    expect(fake.batches.every((b) => b.length <= 450)).toBe(true)
  })

  it('takes a short thread in one batch', async () => {
    fake.data.set(`${W}/threads/t1`, { count: 2, lastAt: 1 })
    msg('t1', 'm1', 'u-alice', 'hi', 1)
    await deleteThread('w1', 't1')
    expect(fake.batches).toHaveLength(1)
  })
})
