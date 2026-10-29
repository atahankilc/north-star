import { afterEach, describe, expect, it } from 'vitest'
import { attach, DEDUPE_MS, EMITS, IDLE_AFTER_MS, learn, onLearn, startEvents, stepEvents, stopEvents, type Sources, type StepLike, type WsLike } from './events'
import { EVENTS } from './lessons'
import type { LearnEvent } from './queue'

// A zustand-like store: subscribe gets (next, prev); a set with nothing changed still tells (as zustand's does when
// a new object is set), which is what the watchers must not take as a new occurrence.
function store<T extends object>(first: T) {
  let s = first
  const subs = new Set<(n: T, p: T) => void>()
  return {
    getState: () => s,
    subscribe: (fn: (n: T, p: T) => void) => (subs.add(fn), () => void subs.delete(fn)),
    set: (patch: Partial<T>) => {
      const p = s
      s = { ...s, ...patch }
      subs.forEach((fn) => fn(s, p))
    },
  }
}

const snap = (path: string, data: Record<string, unknown> | null) => ({ ref: { path }, data })

function fakes() {
  let t = 1_000_000
  let search = ''
  let ws: WsLike | null = null
  const wsSubs = new Set<() => void>()
  const tracked = new Set<(label: string, meta?: { created?: string[]; actor?: 'person' | 'agent' }) => void>()
  const tickers: Array<() => void> = []
  const inputs = new Set<() => void>()
  const canvasView = store({ editing: [] as string[], confirming: null as string | null, deleting: null, bringing: null, toCanvas: null, cardSelected: null as string | null, cardMulti: [] as string[], linkSelected: null, linking: null as unknown, drawing: null, packing: null })
  const history = store({ past: [] as StepLike[], future: [] as StepLike[], notice: null as { text: string; at: number } | null })
  const curtain = store({ revealed: false })
  let loaded = true
  const s: Sources = {
    canvasView,
    curtain,
    ws: { get: () => ws, subscribe: (fn) => (wsSubs.add(fn), () => void wsSubs.delete(fn)) },
    history,
    onTracked: (fn) => (tracked.add(fn), () => void tracked.delete(fn)),
    side: store({ open: false }),
    presence: store({ peers: [] as { uid: string }[], following: null as string | null }),
    find: store({ open: false }),
    threads: store({ inbox: false, openId: null, draft: null }),
    planeFilter: store({ byPlane: {} }),
    shelf: store({ filter: false }),
    matrixUi: store({ wizard: false, setup: false }),
    tableUi: store({ wizard: false, setup: null }),
    kanbanUi: store({ wizard: false, setup: null }),
    docUi: store({ readers: [] as string[] }),
    search: () => search,
    onPopState: () => () => {},
    settingsPage: () => null,
    menuOpen: () => false,
    onInput: (fn) => (inputs.add(fn), () => void inputs.delete(fn)),
    uid: () => 'me',
    seenCount: () => 0,
    firstCanvas: () => true,
    progressLoaded: () => loaded,
    timelineDecks: () => [],
    now: () => t,
    every: (_ms, fn) => (tickers.push(fn), () => {}),
  }
  const log: LearnEvent[] = []
  const off = onLearn((e) => log.push(e))
  const setWs = (w: WsLike | null) => {
    ws = w
    wsSubs.forEach((fn) => fn())
  }
  // A recorded step, as history.ts' record() does it: pushed (or merged), then onTracked told.
  const write = (step: StepLike, meta?: { created?: string[]; actor?: 'person' | 'agent' }, merge = false) => {
    const past = history.getState().past
    history.set({ past: merge ? [...past.slice(0, -1), step] : [...past, step], future: [] })
    tracked.forEach((fn) => fn(step.label, meta))
  }
  return {
    s,
    log,
    names: () => log.map((e) => e.event),
    off,
    canvasView,
    history,
    curtain,
    setWs,
    write,
    setSearch: (q: string) => void (search = q),
    setLoaded: (v: boolean) => void (loaded = v),
    advance: (ms: number) => void (t += ms),
    tick: () => tickers.forEach((fn) => fn()),
    input: () => inputs.forEach((fn) => fn()),
  }
}

const W = (over: Partial<WsLike> = {}): WsLike => ({
  wid: 'w1',
  canvas: 'main',
  pieces: [{ id: 'p1', kind: 'plane' }],
  cards: [],
  labels: [],
  edges: [],
  tasks: [],
  threads: [],
  ...over,
})

let cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.forEach((f) => f())
  cleanup = []
})

function started() {
  const f = fakes()
  const detach = attach(f.s)
  cleanup.push(detach, f.off)
  return f
}

describe('events', () => {
  it('EMITS are all known events', () => {
    for (const e of EMITS) expect(EVENTS).toContain(e)
  })

  it('learn drops the same event and payload sent twice at once', () => {
    const f = started()
    learn('linking')
    learn('linking')
    learn('cards-multi', { count: 2 })
    learn('cards-multi', { count: 3 })
    expect(f.names()).toEqual(['linking', 'cards-multi', 'cards-multi'])
    f.advance(DEDUPE_MS + 1)
    learn('linking')
    expect(f.names()).toEqual(['linking', 'cards-multi', 'cards-multi', 'linking'])
  })

  it('canvas-open once per workspace open, after the curtain', () => {
    const f = started()
    f.setWs(W({ pieces: [] }))
    expect(f.names()).toEqual([])
    f.curtain.set({ revealed: true })
    f.setWs(W({ pieces: [] }))
    f.tick()
    expect(f.log).toEqual([{ event: 'canvas-open', payload: { first: true, empty: true } }])
    f.setWs(null)
    f.setWs(W())
    expect(f.log[1]).toEqual({ event: 'canvas-open', payload: { first: true, empty: false } })
  })

  it('focus-in and focus-out from the address, once each, however often it is looked at', () => {
    const f = started()
    f.curtain.set({ revealed: true })
    f.setWs(W())
    f.setSearch('?focus=p1')
    f.tick()
    f.tick()
    f.canvasView.set({})
    f.setSearch('')
    f.tick()
    f.tick()
    expect(f.log.slice(1)).toEqual([
      { event: 'focus-in', payload: { kind: 'plane', empty: true } },
      { event: 'focus-out', payload: { kind: 'plane' } },
    ])
  })

  it('canvas-view changes fire once, not on repeated sets', () => {
    const f = started()
    f.setWs(W({ cards: [{ id: 'c1', type: 'competitor', pieceId: 'p1' }] }))
    f.canvasView.set({ editing: ['p1'] })
    f.canvasView.set({ editing: ['p1'] })
    f.canvasView.set({ cardSelected: 'c1' })
    f.canvasView.set({ cardSelected: 'c1' })
    f.canvasView.set({ linking: { from: 'c1' } })
    f.canvasView.set({ linking: { from: 'c1', to: [1, 2] } })
    f.canvasView.set({ editing: [] })
    expect(f.log).toEqual([
      { event: 'edit-on', payload: { kind: 'plane' } },
      { event: 'card-selected', payload: { kind: 'competitor' } },
      { event: 'linking' },
      { event: 'edit-off', payload: { kind: 'plane' } },
    ])
  })

  it('a write step: what it made, once; a merged step only what it adds; the agent never', () => {
    const f = started()
    const made: StepLike = { label: 'add a customer', before: [snap('workspaces/w1/customers/c1', null)], after: [snap('workspaces/w1/customers/c1', { title: '' })] }
    f.write(made)
    const named: StepLike = { ...made, after: [snap('workspaces/w1/customers/c1', { title: 'Shops' })] }
    f.write(named, undefined, true)
    f.write({ label: 'add a deck', before: [snap('workspaces/w1/pieces/k1', null)], after: [snap('workspaces/w1/pieces/k1', { kind: 'kanban', kanban: { holds: 'cards' } })] }, { actor: 'agent' })
    f.write({ label: 'link', before: [snap('workspaces/w1/edges/e1', null)], after: [snap('workspaces/w1/edges/e1', { kind: 'for' })] })
    expect(f.log).toEqual([
      { event: 'card-made', payload: { kind: 'customer' } },
      { event: 'link-made', payload: { kind: 'for' } },
    ])
  })

  it('undo from the history store', () => {
    const f = started()
    const st: StepLike = { label: 'link', before: [], after: [] }
    f.history.set({ past: [st] })
    f.history.set({ past: [], future: [st] })
    f.history.set({ past: [], future: [st] })
    expect(f.names()).toEqual(['undo'])
  })

  it('task-given only for a task newly given to you', () => {
    const f = started()
    f.curtain.set({ revealed: true })
    f.setWs(W({ tasks: [{ id: 't0', pieceId: 'k', assignee: 'me', givenAt: 5, givenBy: 'bob' }] }))
    f.setWs(W({ tasks: [{ id: 't0', pieceId: 'k', assignee: 'me', givenAt: 5, givenBy: 'bob' }, { id: 't1', pieceId: 'k', assignee: 'me', givenAt: 2_000_000, givenBy: 'bob' }] }))
    f.setWs(W({ tasks: [{ id: 't0', pieceId: 'k', assignee: 'me', givenAt: 5, givenBy: 'bob' }, { id: 't1', pieceId: 'k', assignee: 'me', givenAt: 2_000_000, givenBy: 'bob' }] }))
    expect(f.log.slice(1)).toEqual([{ event: 'task-given', payload: { byOther: true } }])
  })

  it('idle once after 3 min and 10 s quiet, again only after input', () => {
    const f = started()
    f.curtain.set({ revealed: true })
    f.setWs(W())
    f.advance(IDLE_AFTER_MS)
    f.tick()
    f.tick()
    expect(f.names().filter((n) => n === 'idle').length).toBe(1)
    f.input()
    f.tick()
    expect(f.names().filter((n) => n === 'idle').length).toBe(1)
    f.advance(11_000)
    f.tick()
    expect(f.names().filter((n) => n === 'idle').length).toBe(2)
    expect(f.log.find((e) => e.event === 'idle')?.payload).toEqual({ pieces: 1, cards: 0, seen: 0, decks: 0, peerFor: 0 })
  })
})

describe('stepEvents', () => {
  const ctx = { editing: [] as string[], focus: true, hazard: { ids: [] as string[], shared: false } }
  it('reads a piece made, stuck, unframed, moved', () => {
    expect(stepEvents([snap('a/w/pieces/k', null)], [snap('a/w/pieces/k', { kind: 'kanban' })], ctx)).toEqual([{ event: 'piece-made', payload: { kind: 'kanban', holds: 'tasks' } }])
    const was = { kind: 'table', x: 0, y: 0 }
    expect(stepEvents([snap('a/w/pieces/t', was)], [snap('a/w/pieces/t', { ...was, stuckTo: 'p', open: true })], ctx)).toEqual([
      { event: 'stuck', payload: { kind: 'table' } },
      { event: 'unframed', payload: { kind: 'table' } },
    ])
    expect(stepEvents([snap('a/w/pieces/t', was)], [snap('a/w/pieces/t', { ...was, x: 25 })], { ...ctx, editing: ['t'] })).toEqual([{ event: 'piece-moved', payload: { kind: 'table', editing: true } }])
  })
  it('reads text kinds, tasks with cards, a confirmed delete', () => {
    expect(stepEvents([], [snap('a/w/labels/l', { size: 'note' })], ctx)).toEqual([{ event: 'text-made', payload: { kind: 'paragraph' } }])
    expect(stepEvents([], [snap('a/w/labels/l', { kind: 'sticky' })], ctx)).toEqual([{ event: 'text-made', payload: { kind: 'sticky' } }])
    expect(stepEvents([snap('a/w/tasks/t', { title: 'x' })], [snap('a/w/tasks/t', { title: 'x', cardId: 'c' })], ctx)).toEqual([{ event: 'task-for-card' }])
    expect(stepEvents([snap('a/w/pieces/p', { kind: 'plane' })], [snap('a/w/pieces/p', null)], { ...ctx, hazard: { ids: ['p'], shared: false } })).toEqual([{ event: 'deleted', payload: { confirmed: true, shared: false } }])
    expect(stepEvents([snap('a/w/pieces/q', { kind: 'plane' })], [snap('a/w/pieces/q', null)], { ...ctx, hazard: { ids: ['p'], shared: false } })).toEqual([{ event: 'deleted', payload: { confirmed: false, shared: false } }])
  })
  it('one event per kind per step (a paste of five)', () => {
    const after = [1, 2, 3, 4, 5].map((i) => snap(`a/w/ideas/i${i}`, { title: 't' }))
    expect(stepEvents([], after, ctx)).toEqual([{ event: 'card-made', payload: { kind: 'idea' } }])
  })
  it('reads a task moved, and whether it landed in the finished column', () => {
    const t = { pieceId: 'k', col: 'a', title: 'x' }
    const doneCol = (deck: string, col: string) => deck === 'k' && col === 'z'
    expect(stepEvents([snap('a/w/tasks/t', t)], [snap('a/w/tasks/t', { ...t, col: 'b' })], { ...ctx, doneCol })).toEqual([{ event: 'task-moved', payload: { done: false } }])
    expect(stepEvents([snap('a/w/tasks/t', t)], [snap('a/w/tasks/t', { ...t, col: 'z' })], { ...ctx, doneCol })).toEqual([{ event: 'task-moved', payload: { done: true } }])
    expect(stepEvents([snap('a/w/tasks/t', t)], [snap('a/w/tasks/t', { ...t, order: 3 })], { ...ctx, doneCol })).toEqual([])
  })
})

describe('events, fix round', () => {
  it('canvas-open waits for the seen-state as for the curtain', () => {
    const f = started()
    f.setLoaded(false)
    f.curtain.set({ revealed: true })
    f.setWs(W())
    f.tick()
    expect(f.names()).toEqual([])
    f.setLoaded(true)
    f.tick()
    f.tick()
    expect(f.names()).toEqual(['canvas-open'])
  })

  it('a delete is confirmed only for the ids the hazard confirm asked about; a cancel never counts', () => {
    const f = started()
    f.setWs(W({ pieces: [{ id: 'p1', kind: 'plane' }, { id: 'p2', kind: 'plane' }] }))
    const del = (id: string): StepLike => ({ label: 'delete', before: [snap(`workspaces/w1/pieces/${id}`, { kind: 'plane' })], after: [snap(`workspaces/w1/pieces/${id}`, null)] })
    // Asked about p1, cancelled; then p2 deleted some other way.
    f.canvasView.set({ confirming: 'p1' })
    f.canvasView.set({ confirming: null })
    f.write(del('p2'))
    // Asked about p1, confirmed: its delete is written as the confirm closes.
    f.canvasView.set({ confirming: 'p1' })
    f.canvasView.set({ confirming: null })
    f.write(del('p1'))
    expect(f.log.filter((e) => e.event === 'deleted').map((e) => e.payload)).toEqual([
      { confirmed: false, shared: false },
      { confirmed: true, shared: false },
    ])
  })

  it('a merged step tells only what it added, even with another step in between', () => {
    const f = started()
    const a: StepLike = { label: 'add a customer', before: [snap('workspaces/w1/customers/c1', null)], after: [snap('workspaces/w1/customers/c1', { title: '' })] }
    f.write(a)
    f.write({ label: 'link', before: [snap('workspaces/w1/edges/e1', null)], after: [snap('workspaces/w1/edges/e1', { kind: 'relates' })] })
    // Merged into the first (same before), as history.ts does it.
    f.write({ ...a, after: [snap('workspaces/w1/customers/c1', { title: 'Shops' })] }, undefined, true)
    expect(f.names()).toEqual(['card-made', 'link-made'])
  })

  it('a stop while the stores load ends that start', async () => {
    const f = fakes()
    cleanup.push(f.off)
    let resolve!: (s: Sources) => void
    const going = startEvents(() => new Promise<Sources>((r) => (resolve = r)))
    stopEvents(true)
    resolve(f.s)
    await going
    f.curtain.set({ revealed: true })
    f.setWs(W())
    expect(f.names()).toEqual([])
    // A start that isn't stopped attaches; its stop takes the watchers off.
    await startEvents(f.s)
    f.setWs(W())
    expect(f.names()).toEqual(['canvas-open'])
    stopEvents(true)
    f.setWs(null)
    f.setWs(W({ wid: 'w2' }))
    expect(f.names()).toEqual(['canvas-open'])
  })
})

