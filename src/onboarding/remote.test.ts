// The remote paths of the seen-state (src/data/onboarding.ts + progress.ts) over a mocked Firestore.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SeenState } from './seenMerge'

type Listener = { next: (s: unknown) => void; error: (e: unknown) => void; unsub: ReturnType<typeof vi.fn> }
const fsm = vi.hoisted(() => ({
  listeners: [] as Listener[],
  writes: [] as Record<string, unknown>[],
  refuse: false,
}))

vi.mock('../data/firebase', () => ({ firebase: { firestore: {} } }))
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  onSnapshot: (_ref: unknown, _opts: unknown, next: Listener['next'], error: Listener['error']) => {
    const l: Listener = { next, error, unsub: vi.fn() }
    fsm.listeners.push(l)
    return l.unsub
  },
  setDoc: (_ref: unknown, data: Record<string, unknown>) => {
    fsm.writes.push(JSON.parse(JSON.stringify(data)))
    return fsm.refuse ? Promise.reject(new Error('permission-denied')) : Promise.resolve()
  },
}))

// Node has no browser: a localStorage, a document (visibility) and a window (storage events).
const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  get length() {
    return mem.size
  },
} as Storage
const docTarget = Object.assign(new EventTarget(), { visibilityState: 'visible' })
const win = new EventTarget()
Object.assign(globalThis, { document: docTarget, window: win })

const data = await import('../data/onboarding')
const { useProgress } = await import('./progress')
const { freshState } = await import('./seenMerge')

const snap = (d: object | null, meta: { fromCache?: boolean; pending?: boolean } = {}) => ({
  exists: () => d != null,
  data: () => d,
  metadata: { fromCache: meta.fromCache ?? false, hasPendingWrites: meta.pending ?? false },
})
const state = (patch: Partial<SeenState> = {}): SeenState => ({ ...freshState('new', 'launch', 1000), ...patch })
const P = () => useProgress.getState()
const last = () => fsm.listeners[fsm.listeners.length - 1]
const flushAll = async () => {
  await vi.advanceTimersByTimeAsync(2500)
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(10_000)
  await P().stop()
  fsm.listeners.length = 0
  fsm.writes.length = 0
  fsm.refuse = false
  mem.clear()
  docTarget.visibilityState = 'visible'
})
afterEach(async () => {
  await P().stop()
  vi.useRealTimers()
})

describe('seenWriter', () => {
  it('at most one write per 2 s, the last state pushed', async () => {
    const w = data.seenWriter('u')
    w.push(state({ seen: { a: 1 } }))
    await vi.advanceTimersByTimeAsync(0)
    expect(fsm.writes).toHaveLength(1)
    w.push(state({ seen: { b: 1 } }))
    w.push(state({ seen: { c: 1 } }))
    await vi.advanceTimersByTimeAsync(1999)
    expect(fsm.writes).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fsm.writes).toHaveLength(2)
    expect(fsm.writes[1].seen).toEqual({ c: 1 })
    await w.stop()
  })

  it('flushes when the page is hidden', async () => {
    const w = data.seenWriter('u')
    w.push(state())
    await vi.advanceTimersByTimeAsync(0)
    w.push(state({ seen: { a: 1 } }))
    docTarget.visibilityState = 'hidden'
    docTarget.dispatchEvent(new Event('visibilitychange'))
    expect(fsm.writes).toHaveLength(2)
    await w.stop()
  })

  it('a refusal turns writing off', async () => {
    fsm.refuse = true
    const w = data.seenWriter('u')
    w.push(state())
    await vi.advanceTimersByTimeAsync(0)
    w.push(state({ seen: { a: 1 } }))
    await flushAll()
    expect(fsm.writes).toHaveLength(1)
    await w.stop()
  })

  it('stop: the waiting state goes, then nothing, and the page listener is gone', async () => {
    const remove = vi.spyOn(docTarget, 'removeEventListener')
    const w = data.seenWriter('u')
    w.push(state())
    await vi.advanceTimersByTimeAsync(0)
    w.push(state({ seen: { a: 1 } }))
    await w.stop()
    expect(fsm.writes).toHaveLength(2)
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    w.push(state({ seen: { b: 1 } }))
    await flushAll()
    expect(fsm.writes).toHaveLength(2)
    remove.mockRestore()
  })
})

describe('readSeenSnap', () => {
  it('missing in the cache is unavailable, missing on the server is none', () => {
    expect(data.readSeenSnap(snap(null, { fromCache: true }) as never)).toEqual({ status: 'unavailable' })
    expect(data.readSeenSnap(snap(null) as never)).toEqual({ status: 'none' })
  })
  it('a doc that is not a seen-state is unavailable; own pending writes say nothing', () => {
    expect(data.readSeenSnap(snap({ v: 9 }) as never)).toEqual({ status: 'unavailable' })
    expect(data.readSeenSnap(snap(state(), { pending: true }) as never)).toBeNull()
    expect(data.readSeenSnap(snap(state()) as never)?.status).toBe('found')
  })
})

describe('progress over Firestore', () => {
  it('a refused read never writes', async () => {
    P().startFor('u1')
    last().error(new Error('permission-denied'))
    expect(P().loaded).toBe(true)
    P().begin('new', 'launch')
    P().markSeen('focus', 1)
    await flushAll()
    expect(fsm.writes).toHaveLength(0)
    expect(P().seen).toEqual({ focus: 1 })
  })

  it('a cache miss waits for the server; the timeout means unavailable, and still no write', async () => {
    P().startFor('u1')
    last().next(snap(null, { fromCache: true }))
    expect(P().loaded).toBe(false)
    await vi.advanceTimersByTimeAsync(8000)
    expect(P().loaded).toBe(true)
    expect(P().hadDoc).toBe(false)
    P().begin('new', 'launch')
    await flushAll()
    expect(fsm.writes).toHaveLength(0)
  })

  it('a doc that is not a seen-state: a known person is never made new or written over', async () => {
    P().startFor('u1')
    last().next(snap({ v: 9, mystery: true }))
    P().begin('new', 'launch')
    await flushAll()
    expect(fsm.writes).toHaveLength(0)
  })

  it('no doc on the server: begin() creates it', async () => {
    P().startFor('u1')
    last().next(snap(null))
    P().begin('invited', 'launch')
    await flushAll()
    expect(fsm.writes).toHaveLength(1)
    expect(fsm.writes[0].audience).toBe('invited')
    expect(fsm.writes[0].at).toBeUndefined()
  })

  it('a found doc is merged, and written back only when it differs', async () => {
    const remote = state({ seen: { focus: 1 } })
    mem.set('north-star:onboarding:u1', JSON.stringify(remote))
    P().startFor('u1')
    last().next(snap(remote))
    await flushAll()
    expect(fsm.writes).toHaveLength(0)
    await P().stop()

    mem.set('north-star:onboarding:u1', JSON.stringify(state({ seen: { plus: 2 } })))
    P().startFor('u1')
    last().next(snap(remote))
    await flushAll()
    expect(fsm.writes).toHaveLength(1)
    expect(fsm.writes[0].seen).toEqual({ plus: 2, focus: 1 })
  })

  it('changes before the read wait for it: real settings are not beaten by early writes', async () => {
    P().startFor('u1')
    P().markSeen('focus', 1)
    P().begin('new', '')
    expect(P().state).toBeNull()
    last().next(snap({ ...state(), tipsOff: true, lastRelease: 'launch', at: undefined }))
    expect(P().tipsOff).toBe(true)
    expect(P().lastRelease).toBe('launch')
    expect(P().seen).toEqual({ focus: 1 })
    await flushAll()
    expect(fsm.writes.at(-1)?.tipsOff).toBe(true)
    expect(fsm.writes.at(-1)?.lastRelease).toBe('launch')
  })

  it("a stale tab A merges tab B's newer doc before it writes: B's settings survive", async () => {
    P().startFor('u1')
    last().next(snap(state()))
    // B (another device) turns tips off and moves lastRelease; its write comes in as a snapshot.
    last().next(snap(state({ tipsOff: true, lastRelease: '2026-11', armed: ['deck@2'], at: { tipsOff: 5000, lastRelease: 5000 }, updatedAt: 5000 })))
    P().markSeen('focus', 1)
    await flushAll()
    const w = fsm.writes.at(-1)!
    expect(w.tipsOff).toBe(true)
    expect(w.lastRelease).toBe('2026-11')
    expect(w.armed).toEqual(['deck@2'])
    expect(w.at).toEqual({ tipsOff: 5000, lastRelease: 5000 })
    expect(w.seen).toEqual({ focus: 1 })
  })

  it('localStorage: a stale tab writing keeps the newer tab\'s settings; a storage event merges in', async () => {
    const newer = state({ tipsOff: true, at: { tipsOff: 5000 } })
    mem.set('north-star:onboarding:u1', JSON.stringify(newer))
    const kept = data.writeLocalSeen('u1', state({ seen: { focus: 1 } }))
    expect(kept.tipsOff).toBe(true)
    expect(JSON.parse(mem.get('north-star:onboarding:u1')!).tipsOff).toBe(true)

    mem.clear()
    P().startFor('u1')
    last().next(snap(null))
    P().begin('new', 'launch')
    mem.set('north-star:onboarding:u1', JSON.stringify(state({ welcome: 'done', at: { welcome: 6000 } })))
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'north-star:onboarding:u1', newValue: 'x' }))
    expect(P().welcome).toBe('done')
  })

  it('switching accounts drops the old read and leaves no listener or writer behind', async () => {
    const add = vi.spyOn(docTarget, 'addEventListener')
    const remove = vi.spyOn(docTarget, 'removeEventListener')
    P().startFor('u1')
    const old = last()
    P().startFor('u2')
    expect(old.unsub).toHaveBeenCalled()
    old.next(snap(state({ tipsOff: true, at: { tipsOff: 5000 } })))
    expect(P().uid).toBe('u2')
    expect(P().tipsOff).toBe(false)
    expect(P().loaded).toBe(false)
    await P().stop()
    expect(last().unsub).toHaveBeenCalled()
    expect(add.mock.calls.length).toBe(remove.mock.calls.length)
    await flushAll()
    expect(fsm.writes).toHaveLength(0)
    add.mockRestore()
    remove.mockRestore()
  })
})

describe('two tabs and begin()', () => {
  it('two tabs pushing their merges settle after one round', async () => {
    // Tab A is the store; tab B's copy arrives as the doc. They differ in order and in unstamped ties.
    mem.set('north-star:onboarding:u1', JSON.stringify(state({ armed: ['b@1', 'a@1'], lastRelease: '', seen: { z: 1 } })))
    const b = state({ armed: ['c@1', 'a@1'], lastRelease: 'launch', audience: 'invited', seen: { a: 1 } })
    P().startFor('u1')
    last().next(snap(b))
    await flushAll()
    expect(fsm.writes).toHaveLength(1)
    // B merges A's write into its copy and writes that back; A hears it: nothing more to write, on either side.
    const { mergeSeenState, sameSeenState } = await import('./seenMerge')
    const fromA = fsm.writes[0] as unknown as SeenState
    const bAfter = mergeSeenState(b, fromA)
    expect(sameSeenState(bAfter, fromA)).toBe(true)
    last().next(snap(bAfter))
    await flushAll()
    expect(fsm.writes).toHaveLength(1)
  })

  it('a change before begin(): begin() still fills audience, startedAt and lastRelease', async () => {
    P().startFor('u1')
    last().next(snap(null))
    vi.setSystemTime(20_000)
    P().markSeen('focus', 1)
    expect(P().state?.audience).toBe('new')
    expect(P().lastRelease).toBe('')
    P().begin('invited', 'launch')
    expect(P().state?.audience).toBe('invited')
    expect(P().lastRelease).toBe('launch')
    expect(P().seen).toEqual({ focus: 1 })
    // Once filled, a second begin() changes nothing.
    P().begin('new', 'other')
    expect(P().state?.audience).toBe('invited')
    await flushAll()
    expect(fsm.writes.at(-1)?.audience).toBe('invited')
  })

  it('begin() leaves a doc found on the server alone', async () => {
    P().startFor('u1')
    last().next(snap(state({ audience: 'invited', lastRelease: '2026-11' })))
    P().begin('new', 'launch')
    expect(P().state?.audience).toBe('invited')
    expect(P().lastRelease).toBe('2026-11')
  })
})
