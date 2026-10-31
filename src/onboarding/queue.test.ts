import { beforeEach, describe, expect, it } from 'vitest'
import { LESSONS, type Lesson } from './lessons'
import { CALM_MS, COOLDOWN_MS, GIVE_UP_MS, PAUSE_CAP_MS, countsAsMenu, createQueue, hintWaits, matches, resetNudgeBudget, type Busy, type ProgressView } from './queue'
import type { Role } from './lessons'

const ALL: Role[] = ['owner', 'editor', 'viewer']
const page = (title: string, extra: object = {}) => ({ title, body: 'b', ...extra })
const L = (id: string, rest: Partial<Lesson> & { trigger: Lesson['trigger'] }): Lesson =>
  ({ id, v: 1, format: 'lesson', roles: ALL, area: 'canvas', since: 'D-315', pages: [page(id)], ...rest }) as Lesson

function setup(lessons: Lesson[], o: { role?: Role; progress?: Partial<ProgressView> } = {}) {
  let t = 1_000_000
  let busy: Busy = {}
  const progress: ProgressView = { seen: {}, armed: [], tipsOff: false, ...o.progress }
  const marked: string[] = []
  const nudges: number[] = []
  const gaveUp: string[] = []
  let role: Role | null = o.role ?? 'editor'
  let loaded = true
  const q = createQueue({
    lessons,
    now: () => t,
    getBusy: () => busy,
    getProgress: () => progress,
    getRole: () => role,
    isLoaded: () => loaded,
    markSeen: (id, v) => {
      marked.push(id)
      progress.seen = { ...progress.seen, [id]: v }
    },
    noteNudge: (at) => nudges.push(at),
    onGiveUp: (id) => gaveUp.push(id),
  })
  // Moves the clock, ticking every 100 ms like the coach.
  const wait = (ms: number) => {
    for (let i = 0; i < ms; i += 100) {
      t += Math.min(100, ms - i)
      q.tick()
    }
  }
  return {
    q,
    wait,
    marked,
    nudges,
    gaveUp,
    progress,
    setBusy: (b: Busy) => void (busy = b),
    setRole: (r: Role | null) => void (role = r),
    setLoaded: (v: boolean) => void (loaded = v),
    shown: () => q.current()?.lesson.id ?? null,
  }
}

beforeEach(() => resetNudgeBudget())

describe('queue', () => {
  it('shows a triggered lesson after 400 ms of calm', () => {
    const s = setup([L('a', { trigger: [{ event: 'linking' }] })])
    s.q.onEvent({ event: 'linking' })
    expect(s.shown()).toBe(null)
    s.wait(CALM_MS - 100)
    expect(s.shown()).toBe(null)
    s.wait(200)
    expect(s.shown()).toBe('a')
  })

  it('defers while busy, then shows after 400 ms calm', () => {
    const s = setup([L('a', { trigger: [{ event: 'linking' }] })])
    s.setBusy({ drag: true })
    s.q.onEvent({ event: 'linking' })
    s.wait(3000)
    expect(s.shown()).toBe(null)
    s.setBusy({})
    s.wait(300)
    expect(s.shown()).toBe(null)
    s.wait(200)
    expect(s.shown()).toBe('a')
  })

  it('a busy blip restarts the calm', () => {
    const s = setup([L('a', { trigger: [{ event: 'linking' }] })])
    s.q.onEvent({ event: 'linking' })
    s.wait(300)
    s.setBusy({ gliding: true })
    s.wait(100)
    s.setBusy({})
    s.wait(300)
    expect(s.shown()).toBe(null)
    s.wait(200)
    expect(s.shown()).toBe('a')
  })

  it('gives up after 10 s busy and stays due for the next trigger', () => {
    const s = setup([L('a', { trigger: [{ event: 'linking' }] })])
    s.setBusy({ typing: true })
    s.q.onEvent({ event: 'linking' })
    s.wait(GIVE_UP_MS + 200)
    expect(s.q.queued()).toEqual([])
    expect(s.gaveUp).toEqual(['a'])
    expect(s.marked).toEqual([])
    s.setBusy({})
    s.wait(2000)
    expect(s.shown()).toBe(null)
    s.q.onEvent({ event: 'linking' })
    s.wait(500)
    expect(s.shown()).toBe('a')
  })

  it('one queued per lesson: a newer trigger replaces it (its payload, its wait)', () => {
    const s = setup([L('a', { trigger: [{ event: 'edit-on' }] }), L('b', { trigger: [{ event: 'edit-on' }] })])
    s.setBusy({ drag: true })
    s.q.onEvent({ event: 'edit-on', payload: { kind: 'plane' } })
    s.wait(6000)
    s.q.onEvent({ event: 'edit-on', payload: { kind: 'table' } })
    expect(s.q.queued()).toEqual(['a', 'b'])
    // The first trigger's 10 s would be up here; the newer one's wait isn't.
    s.wait(6000)
    expect(s.q.queued()).toEqual(['a', 'b'])
    s.setBusy({})
    s.wait(500)
    expect(s.shown()).toBe('a')
    expect(s.q.current()?.payload).toEqual({ kind: 'table' })
  })

  it('one at a time: the next waits while one shows', () => {
    const s = setup([L('a', { trigger: [{ event: 'linking' }] }), L('b', { trigger: [{ event: 'packing' }] })])
    s.q.onEvent({ event: 'linking' })
    s.wait(500)
    s.q.onEvent({ event: 'packing' })
    s.wait(2000)
    expect(s.shown()).toBe('a')
    s.q.close('a', 'closed')
    s.wait(500)
    expect(s.shown()).toBe('b')
  })

  it('after: waits for a named lesson queued or showing, however long', () => {
    const s = setup([L('gen', { trigger: [{ event: 'focus-in' }] }), L('spec', { trigger: [{ event: 'focus-in', when: { kind: 'table' } }], after: ['gen'] })])
    s.q.onEvent({ event: 'focus-in', payload: { kind: 'table' } })
    s.wait(500)
    expect(s.shown()).toBe('gen')
    s.wait(GIVE_UP_MS * 2)
    expect(s.q.queued()).toEqual(['spec'])
    s.q.close('gen', 'closed')
    s.wait(500)
    expect(s.shown()).toBe('spec')
  })

  it("after: doesn't wait for one that isn't due", () => {
    const s = setup([L('gen', { trigger: [{ event: 'focus-in' }] }), L('spec', { trigger: [{ event: 'cell-picked' }], after: ['gen'] })], {
      progress: { seen: {} },
    })
    s.q.onEvent({ event: 'cell-picked' })
    s.wait(500)
    expect(s.shown()).toBe('spec')
  })

  it('after: a named lesson dropped by the busy wait no longer holds it', () => {
    const s = setup([
      L('gen', { trigger: [{ event: 'focus-in' }] }),
      L('spec', { trigger: [{ event: 'focus-in' }], after: ['gen'], within: 'finder' }),
    ])
    s.setBusy({ finder: true })
    s.q.onEvent({ event: 'focus-in' })
    s.wait(GIVE_UP_MS + 200)
    expect(s.gaveUp).toEqual(['gen'])
    s.wait(500)
    expect(s.shown()).toBe('spec')
  })

  it('unless: one of those seen retires it', () => {
    const s = setup([L('panel', { trigger: [{ event: 'card-selected' }], unless: ['made'] })], { progress: { seen: { made: 1 } } })
    s.q.onEvent({ event: 'card-selected' })
    s.wait(1000)
    expect(s.shown()).toBe(null)
    expect(s.marked).toEqual(['panel'])
  })

  it('within: that one busy source (and typing inside it) lets it through, no other', () => {
    const s = setup([L('f', { trigger: [{ event: 'finder-open' }], within: 'finder' })])
    s.setBusy({ finder: true, typing: true })
    s.q.onEvent({ event: 'finder-open' })
    s.wait(500)
    expect(s.shown()).toBe('f')

    const t = setup([L('f', { trigger: [{ event: 'finder-open' }], within: 'finder' })])
    t.setBusy({ finder: true, drag: true })
    t.q.onEvent({ event: 'finder-open' })
    t.wait(2000)
    expect(t.shown()).toBe(null)

    // Typing elsewhere (the finder not open) still holds it.
    const u = setup([L('f', { trigger: [{ event: 'finder-open' }], within: 'finder' })])
    u.setBusy({ typing: true })
    u.q.onEvent({ event: 'finder-open' })
    u.wait(2000)
    expect(u.shown()).toBe(null)
  })

  it('retires on done before it shows, while it waits, and while it shows', () => {
    const s = setup([L('n', { trigger: [{ event: 'idle' }], doneWhen: [{ event: 'focus-in' }] })])
    // Never triggered: done retires it anyway (TipKit's rule).
    s.q.onEvent({ event: 'focus-in' })
    expect(s.marked).toEqual(['n'])
    s.q.onEvent({ event: 'idle' })
    s.wait(COOLDOWN_MS)
    expect(s.shown()).toBe(null)

    const t = setup([L('p', { trigger: [{ event: 'piece-made' }], doneWhen: [{ event: 'edit-off' }] })])
    t.setBusy({ drag: true })
    t.q.onEvent({ event: 'piece-made' })
    t.q.onEvent({ event: 'edit-off' })
    expect(t.q.queued()).toEqual([])
    expect(t.marked).toEqual(['p'])

    const u = setup([L('p', { trigger: [{ event: 'piece-made' }], doneWhen: [{ event: 'edit-off' }] })])
    u.q.onEvent({ event: 'piece-made' })
    u.wait(500)
    expect(u.shown()).toBe('p')
    u.q.onEvent({ event: 'edit-off' })
    expect(u.q.current()?.doneAt).toBeDefined()
    u.wait(1500)
    expect(u.shown()).toBe(null)
  })

  it('never retires the welcome or the kind guide on done', () => {
    const w = L('welcome', { format: 'welcome', trigger: [{ event: 'canvas-open' }], doneWhen: [{ event: 'piece-made' }] } as Partial<Lesson> & { trigger: Lesson['trigger'] })
    const s = setup([w])
    s.q.onEvent({ event: 'piece-made' })
    expect(s.marked).toEqual([])
  })

  it('cooldown: 20 s after a close for automatic ones, only calm for an action', () => {
    const s = setup([
      L('first', { trigger: [{ event: 'linking' }] }),
      L('auto', { trigger: [{ event: 'peer-joined' }] }),
      L('act', { trigger: [{ event: 'packing' }] }),
    ])
    s.q.onEvent({ event: 'linking' })
    s.wait(500)
    s.q.close('first', 'done')
    s.q.onEvent({ event: 'peer-joined' })
    s.wait(5000)
    expect(s.shown()).toBe(null)
    s.wait(COOLDOWN_MS - 5000 + 500)
    expect(s.shown()).toBe('auto')
    s.q.close('auto', 'closed')
    s.q.onEvent({ event: 'packing' })
    s.wait(500)
    expect(s.shown()).toBe('act')
  })

  it('tipsOff: nothing by itself; play still shows', () => {
    const s = setup([L('a', { trigger: [{ event: 'linking' }] })], { progress: { tipsOff: true } })
    s.q.onEvent({ event: 'linking' })
    s.wait(2000)
    expect(s.shown()).toBe(null)
    s.q.play('a')
    expect(s.shown()).toBe('a')
    expect(s.q.current()?.via).toBe('play')
  })

  it('nudges: one a session, only when the counts match', () => {
    const s = setup([
      L('n1', { format: 'nudge', trigger: [{ event: 'idle', when: { pieces: { min: 1 } } }] } as never),
      L('n2', { format: 'nudge', trigger: [{ event: 'idle', when: { cards: { min: 15 } } }] } as never),
    ])
    s.q.onEvent({ event: 'idle', payload: { pieces: 0, cards: 3 } })
    s.wait(1000)
    expect(s.shown()).toBe(null)
    s.q.onEvent({ event: 'idle', payload: { pieces: 2, cards: 20 } })
    expect(s.q.queued()).toEqual(['n1'])
    s.wait(1000)
    expect(s.shown()).toBe('n1')
    expect(s.nudges.length).toBe(1)
    s.q.close('n1', 'closed')
    s.q.onEvent({ event: 'idle', payload: { pieces: 2, cards: 20 } })
    s.wait(COOLDOWN_MS + 1000)
    expect(s.shown()).toBe(null)
  })

  it("roles: the lesson's, then each page's", () => {
    const owners = L('o', { roles: ['owner'], trigger: [{ event: 'settings-open' }] })
    const paged = L('p', {
      trigger: [{ event: 'focus-in' }],
      pages: [page('editors', { roles: ['owner', 'editor'] }), page('viewers', { roles: ['viewer'] }), page('all')],
    } as never)
    const s = setup([owners, paged], { role: 'viewer' })
    s.q.onEvent({ event: 'settings-open' })
    s.q.onEvent({ event: 'focus-in' })
    s.wait(500)
    expect(s.shown()).toBe('p')
    expect(s.q.current()?.pages.map((x) => x.title)).toEqual(['viewers', 'all'])
    s.q.close('p', 'closed')
    s.wait(COOLDOWN_MS)
    expect(s.shown()).toBe(null)

    // No page left for this role: not shown at all.
    const t = setup([L('e', { trigger: [{ event: 'linking' }], pages: [page('x', { roles: ['editor'] })] } as never)], { role: 'viewer' })
    t.q.onEvent({ event: 'linking' })
    t.wait(1000)
    expect(t.shown()).toBe(null)

    // Not a member: nothing.
    const u = setup([L('a', { trigger: [{ event: 'linking' }] })])
    u.setRole(null)
    u.q.onEvent({ event: 'linking' })
    u.wait(1000)
    expect(u.shown()).toBe(null)
  })

  it('pages by the trigger kind', () => {
    const s = setup([L('k', { trigger: [{ event: 'stuck' }], pages: [page('t', { kinds: ['table'] }), page('d', { kinds: ['kanban'] })] } as never)])
    s.q.onEvent({ event: 'stuck', payload: { kind: 'kanban' } })
    s.wait(500)
    expect(s.q.current()?.pages.map((p) => p.title)).toEqual(['d'])
  })

  it('armed: a newer version shows (as NEW) even though an older was seen', () => {
    const s = setup([L('a', { v: 2, trigger: [{ event: 'linking' }] })], { progress: { seen: { a: 1 }, armed: ['a@2'] } })
    s.q.onEvent({ event: 'linking' })
    s.wait(500)
    expect(s.shown()).toBe('a')
    expect(s.q.current()?.isNew).toBe(true)
  })

  it('never twice: seen, or closed this session, never by itself', () => {
    const s = setup([L('a', { trigger: [{ event: 'linking' }] })], { progress: { seen: {} } })
    s.q.onEvent({ event: 'linking' })
    s.wait(500)
    s.q.close('a', 'skipped')
    expect(s.marked).toEqual(['a'])
    // Even if the store hasn't caught up.
    s.progress.seen = {}
    s.q.onEvent({ event: 'linking' })
    s.wait(1000)
    expect(s.shown()).toBe(null)

    const t = setup([L('a', { trigger: [{ event: 'linking' }] })], { progress: { seen: { a: 1 } } })
    t.q.onEvent({ event: 'linking' })
    t.wait(1000)
    expect(t.shown()).toBe(null)
  })

  it('only after the curtain', () => {
    const s = setup([L('w', { trigger: [{ event: 'canvas-open', when: { first: true } }] })])
    s.setBusy({ curtainHidden: true })
    s.q.onEvent({ event: 'canvas-open', payload: { first: true, empty: true } })
    s.wait(3000)
    expect(s.shown()).toBe(null)
    s.setBusy({})
    s.wait(500)
    expect(s.shown()).toBe('w')
  })
})

describe('queue with the real lessons', () => {
  it('canvas-open: the welcome, then the empty canvas after the cooldown', () => {
    const s = setup(LESSONS as Lesson[])
    s.q.onEvent({ event: 'canvas-open', payload: { first: true, empty: true } })
    s.wait(500)
    expect(s.shown()).toBe('welcome')
    expect(s.q.queued()).toEqual(['empty-canvas'])
    s.q.close('welcome', 'done')
    s.wait(COOLDOWN_MS - 1000)
    expect(s.shown()).toBe(null)
    s.wait(1500)
    expect(s.shown()).toBe('empty-canvas')
  })

  it('focus-in a table: the general lesson, then the table one', () => {
    const s = setup(LESSONS as Lesson[], { role: 'viewer' })
    s.q.onEvent({ event: 'focus-in', payload: { kind: 'table', empty: false } })
    s.wait(500)
    expect(s.shown()).toBe('focus-lens')
    s.q.close('focus-lens', 'closed')
    s.wait(500)
    expect(s.shown()).toBe('table-keys')
    expect(s.q.current()?.pages.map((p) => p.title)).toEqual(['Reading a table'])
  })
})

describe('queue, fix round', () => {
  it('holds everything until the seen-state has loaded, counting no wait', () => {
    const s = setup([L('a', { trigger: [{ event: 'linking' }] }), L('b', { trigger: [{ event: 'packing' }] })])
    s.setLoaded(false)
    s.q.onEvent({ event: 'linking' })
    s.q.onEvent({ event: 'packing' })
    s.wait(GIVE_UP_MS * 2)
    expect(s.shown()).toBe(null)
    expect(s.q.queued()).toEqual(['a', 'b'])
    // Loaded: `b` turns out seen (another device); `a` shows after the calm.
    s.progress.seen = { b: 1 }
    s.setLoaded(true)
    s.wait(500)
    expect(s.shown()).toBe('a')
    expect(s.q.queued()).toEqual([])
  })

  it("holds while the role isn't known, then keeps only what fits it", () => {
    const s = setup([L('o', { roles: ['owner'], trigger: [{ event: 'linking' }] }), L('all', { trigger: [{ event: 'linking' }] })])
    s.setRole(null)
    s.q.onEvent({ event: 'linking' })
    s.wait(GIVE_UP_MS * 2)
    expect(s.q.queued()).toEqual(['o', 'all'])
    s.setRole('viewer')
    s.wait(500)
    expect(s.shown()).toBe('all')
    expect(s.q.queued()).toEqual([])
  })

  it('a coach surface showing pauses the wait, up to 60 s', () => {
    const s = setup([L('a', { trigger: [{ event: 'linking' }] }), L('b', { trigger: [{ event: 'packing' }] })])
    s.q.onEvent({ event: 'linking' })
    s.wait(500)
    s.q.onEvent({ event: 'packing' })
    s.wait(30_000)
    expect(s.q.queued()).toEqual(['b'])
    s.q.close('a', 'closed')
    s.wait(500)
    expect(s.shown()).toBe('b')

    const t = setup([L('a', { trigger: [{ event: 'linking' }] })])
    t.setBusy({ modal: true })
    t.q.onEvent({ event: 'linking' })
    t.wait(PAUSE_CAP_MS - 1000)
    expect(t.q.queued()).toEqual(['a'])
    t.wait(1200)
    expect(t.q.queued()).toEqual([])
    expect(t.gaveUp).toEqual(['a'])
  })

  it('the nudge budget is per page load, not per queue', () => {
    const n = () => L('n', { format: 'nudge', trigger: [{ event: 'idle' }] } as never)
    const s = setup([n()])
    s.q.onEvent({ event: 'idle' })
    s.wait(500)
    expect(s.shown()).toBe('n')
    // A second queue (another workspace in the same page load) gets none.
    const t = setup([L('m', { format: 'nudge', trigger: [{ event: 'idle' }] } as never)])
    t.q.onEvent({ event: 'idle' })
    t.wait(COOLDOWN_MS + 1000)
    expect(t.shown()).toBe(null)
  })
})

describe('queue, a surface and its own lesson (O11)', () => {
  it("a lesson showing gives way to the lesson of a surface opened over it, back to the queue, not seen", () => {
    const s = setup([L('find', { trigger: [{ event: 'finder-open' }] }), L('wiz', { trigger: [{ event: 'wizard' }], within: 'wizard' })])
    s.q.onEvent({ event: 'finder-open' })
    s.wait(500)
    expect(s.shown()).toBe('find')
    // The wizard opens over it: its own lesson takes the slot after the calm.
    s.setBusy({ wizard: true })
    s.q.onEvent({ event: 'wizard' })
    s.wait(100)
    expect(s.shown()).toBe(null)
    expect(s.q.queued()).toEqual(['find', 'wiz'])
    s.wait(500)
    expect(s.shown()).toBe('wiz')
    expect(s.marked).toEqual([])
    // Closed; the wizard closes too: the one that gave way shows again, its wait started over.
    s.q.close('wiz', 'closed')
    s.setBusy({})
    s.wait(300)
    expect(s.shown()).toBe(null)
    s.wait(300)
    expect(s.shown()).toBe('find')
    expect(s.marked).toEqual(['wiz'])
  })

  it("doesn't give way to a surface lesson something else still holds, or to its own surface", () => {
    const s = setup([L('find', { trigger: [{ event: 'finder-open' }] }), L('wiz', { trigger: [{ event: 'wizard' }], within: 'wizard' })])
    s.q.onEvent({ event: 'finder-open' })
    s.wait(500)
    s.setBusy({ wizard: true, drag: true })
    s.q.onEvent({ event: 'wizard' })
    s.wait(1000)
    expect(s.shown()).toBe('find')

    const t = setup([L('w1', { trigger: [{ event: 'wizard' }], within: 'wizard' }), L('w2', { trigger: [{ event: 'setup-open' }], within: 'wizard' })])
    t.setBusy({ wizard: true })
    t.q.onEvent({ event: 'wizard' })
    t.wait(500)
    t.q.onEvent({ event: 'setup-open' })
    t.wait(1000)
    expect(t.shown()).toBe('w1')
    expect(t.q.queued()).toEqual(['w2'])
  })

  it('a surface lesson whose surface closed before it showed is dropped, due at its next trigger', () => {
    const s = setup([L('busy', { trigger: [{ event: 'linking' }] }), L('wiz', { trigger: [{ event: 'wizard' }], within: 'wizard' })])
    s.q.onEvent({ event: 'linking' })
    s.wait(500)
    expect(s.shown()).toBe('busy')
    // Waiting behind a drag in the wizard, then the wizard's gone: it never shows outside it.
    s.setBusy({ wizard: true, drag: true })
    s.q.onEvent({ event: 'wizard' })
    s.wait(300)
    s.setBusy({})
    s.wait(200)
    expect(s.q.queued()).toEqual([])
    expect(s.gaveUp).toEqual(['wiz'])
    s.q.close('busy', 'closed')
    s.wait(2000)
    expect(s.shown()).toBe(null)
    expect(s.marked).toEqual(['busy'])
    // The next wizard: it shows there.
    s.setBusy({ wizard: true })
    s.q.onEvent({ event: 'wizard' })
    s.wait(500)
    expect(s.shown()).toBe('wiz')
  })

  it('one triggered from outside its surface, which never opened, still shows', () => {
    const s = setup([L('heads', { trigger: [{ event: 'text-made' }, { event: 'finder-open' }], within: 'finder' })])
    s.q.onEvent({ event: 'text-made' })
    s.wait(500)
    expect(s.shown()).toBe('heads')
  })
})

describe('queue, fix round O11', () => {
  // A stand-in for an element: what `closest` finds above it.
  const el = (inFinder: boolean) => ({ closest: (sel: string) => (inFinder && sel.includes('aria-label="Find"') ? ({} as Element) : null) })

  it("the finder's own list isn't a menu: the finder's lesson shows while it's open and typed in", () => {
    expect(countsAsMenu(el(true))).toBe(false)
    expect(countsAsMenu(el(false))).toBe(true)
    const s = setup([L('finder', { trigger: [{ event: 'finder-open' }], within: 'finder' })])
    // busy.ts' `menu` from the lists on screen: only the finder's matches.
    const lists = [el(true)]
    s.setBusy({ finder: true, typing: true, menu: lists.some(countsAsMenu) })
    s.q.onEvent({ event: 'finder-open' })
    s.wait(500)
    expect(s.shown()).toBe('finder')
  })

  it('a menu lesson that gave way to a wizard and whose menu closed meanwhile is dropped, not shown after', () => {
    const s = setup([L('rc', { trigger: [{ event: 'context-menu' }], within: 'menu' }), L('wiz', { trigger: [{ event: 'wizard' }], within: 'wizard' })])
    s.setBusy({ menu: true })
    s.q.onEvent({ event: 'context-menu' })
    s.wait(500)
    expect(s.shown()).toBe('rc')
    // The menu picks the wizard (the menu closes, the wizard opens): `rc` gives way and doesn't come back.
    s.setBusy({ wizard: true })
    s.q.onEvent({ event: 'wizard' })
    s.wait(500)
    expect(s.shown()).toBe('wiz')
    expect(s.q.queued()).toEqual([])
    expect(s.gaveUp).toEqual(['rc'])
    s.q.close('wiz', 'closed')
    s.setBusy({})
    s.wait(3000)
    expect(s.shown()).toBe(null)
  })

  it('a nudge that gives way is counted once and ends', () => {
    const s = setup([L('n', { format: 'nudge', trigger: [{ event: 'idle' }] } as never), L('wiz', { trigger: [{ event: 'wizard' }], within: 'wizard' })])
    s.q.onEvent({ event: 'idle' })
    s.wait(500)
    expect(s.shown()).toBe('n')
    s.setBusy({ wizard: true })
    s.q.onEvent({ event: 'wizard' })
    s.wait(500)
    expect(s.shown()).toBe('wiz')
    // The nudge ended for it (never seen, not shown again: the session's one nudge is spent), counted once.
    s.q.close('wiz', 'closed')
    s.setBusy({})
    s.wait(COOLDOWN_MS + 1000)
    expect(s.shown()).toBe(null)
    expect(s.marked).toEqual(['wiz'])
    expect(s.nudges.length).toBe(1)
  })

  it('a nudge showing never holds the slot: a waiting lesson ends it (not seen) and shows', () => {
    const s = setup([L('n', { format: 'nudge', trigger: [{ event: 'idle' }] } as never), L('given', { trigger: [{ event: 'task-given' }] })])
    s.q.onEvent({ event: 'idle' })
    s.wait(500)
    expect(s.shown()).toBe('n')
    s.q.onEvent({ event: 'task-given' })
    s.wait(100)
    expect(s.shown()).toBe(null)
    expect(s.marked).toEqual([])
    // An automatic one still waits out the cooldown from the last close (none here), then the calm.
    s.wait(600)
    expect(s.shown()).toBe('given')
    expect(s.gaveUp).toEqual([])
    expect(s.nudges.length).toBe(1)
  })

  it('a nudge stays while the waiting lesson is still held by something else', () => {
    const s = setup([L('n', { format: 'nudge', trigger: [{ event: 'idle' }] } as never), L('l', { trigger: [{ event: 'linking' }] })])
    s.q.onEvent({ event: 'idle' })
    s.wait(500)
    s.setBusy({ drag: true })
    s.q.onEvent({ event: 'linking' })
    s.wait(1000)
    expect(s.shown()).toBe('n')
  })
})

describe('empty states beside the queue (O16c)', () => {
  const plane = LESSONS.find((l) => l.id === 'empty-plane')!
  it('the empty-plane hint waits while focus-plane is queued or showing', () => {
    expect(plane.after).toContain('focus-plane')
    expect(hintWaits(plane, { shown: null, queued: ['focus-plane'], busy: {} })).toBe(true)
    expect(hintWaits(plane, { shown: 'focus-plane', queued: [], busy: {} })).toBe(true)
    expect(hintWaits(plane, { shown: null, queued: ['card-made'], busy: {} })).toBe(false)
    expect(hintWaits(plane, { shown: 'piece-made', queued: [], busy: {} })).toBe(false)
  })
  it('no hint while the focus ink spreads or the curtain is down', () => {
    expect(hintWaits(plane, { shown: null, queued: [], busy: { focusMoving: true } })).toBe(true)
    expect(hintWaits(plane, { shown: null, queued: [], busy: { curtainHidden: true } })).toBe(true)
    expect(hintWaits({}, { shown: null, queued: [], busy: { typing: true } })).toBe(false)
  })
})

describe('piece-console only for the console shown on pointing (O16c)', () => {
  const l = LESSONS.find((x) => x.id === 'piece-console')!
  it('not from a piece in edit mode', () => {
    expect(l.trigger.some((t) => matches(t, { event: 'console-shown', payload: { kind: 'plane', editing: true } }))).toBe(false)
    expect(l.trigger.some((t) => matches(t, { event: 'console-shown', payload: { kind: 'plane', editing: false } }))).toBe(true)
  })
})

describe('only the right-click lesson lingers after its menu (O16c review)', () => {
  it('linger is set on right-click alone', () => {
    expect(LESSONS.filter((l) => l.linger).map((l) => l.id)).toEqual(['right-click'])
  })
})
