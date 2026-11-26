// A run as its person watches it (D-434, docs/specs/agent-server.md §5.4), over RTDB. Down, `agentLive/{uid}/{run}`: the
// loop's events in order (`ev/{n}`, text gathered for a moment), moves of the view to make, and how it ended; only that
// person reads it, only the server writes. Up, `agentCtl/{uid}/{run}`: stop, words for the next step, where they are now,
// answers to moves, whether a tab is watching; only that person writes. Both go a while after the end.
import type { Database, DataSnapshot } from 'firebase-admin/database'
import type { LoopEvent } from '../../../src/agent/loop'
import type { UiFacade } from '../../../src/agent/contract'
import type { WhereView } from '../../../src/agent/read/tools'
import { ASK_MAX, readView } from './ask'

export const TEXT_MS = 150
const MOVE_MS = 8_000

// What the tab gets of the loop's events: everything it draws, nothing heavy (a turn's whole transcript stays here).
export type LiveEvent =
  | { type: 'text'; n: number; delta: string }
  | { type: 'search'; n: number; query: string }
  | { type: 'step'; n: number; final: boolean }
  | { type: 'tool_started' | 'tool_finished'; n: number; call: { id: string; name: string; label: string; args: string; ok?: boolean; ms?: number } }
  | { type: 'usage'; n: number; total: Record<string, number> }
  // The run goes on from its last step after a worker died: what came of that step before is told again.
  | { type: 'again'; n: number }
  // What the run was asked, first (a tab that joins a run already going shows it; `auto`: the app's own go-on).
  | { type: 'asked'; n: number; text: string; auto?: boolean }
  // Words taken into the turn between two steps.
  | { type: 'heard'; n: number; text: string }

export function liveEvent(e: LoopEvent): LiveEvent | null {
  switch (e.type) {
    case 'text':
      return { type: 'text', n: e.n, delta: e.delta }
    case 'search':
      return { type: 'search', n: e.n, query: e.query }
    case 'step_started':
      return { type: 'step', n: e.n, final: e.final }
    case 'tool_started':
    case 'tool_finished':
      return { type: e.type, n: e.n, call: { ...e.call } }
    case 'usage':
      return { type: 'usage', n: e.n, total: Object.fromEntries(Object.entries(e.total).filter(([, v]) => typeof v === 'number')) as Record<string, number> }
    default:
      return null
  }
}

const livePath = (uid: string, run: string) => `agentLive/${uid}/${run}`
const ctlPath = (uid: string, run: string) => `agentCtl/${uid}/${run}`

export type LiveOut = {
  event: (e: LiveEvent) => void
  // How it ended, after everything before it was sent.
  end: (e: Record<string, unknown>) => Promise<void>
  flush: () => Promise<void>
}

// Events in order, one write at a time: a write waits for the one before, and what gathers meanwhile goes as one.
export function liveOut(db: Database, uid: string, run: string, o: { from?: number; textMs?: number } = {}): LiveOut {
  const ref = db.ref(livePath(uid, run))
  let n = o.from ?? 0
  let queue: LiveEvent[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let sending: Promise<void> = Promise.resolve()

  const send = () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (!queue.length) return sending
    const batch = queue
    queue = []
    sending = sending.then(async () => {
      const patch: Record<string, unknown> = {}
      for (const e of batch) patch[`ev/${String(++n).padStart(10, '0')}`] = JSON.stringify(e)
      // A lost write must not end the run: the saved chat has the whole answer.
      await ref.update(patch).catch(() => undefined)
    })
    return sending
  }
  return {
    event: (e) => {
      const last = queue[queue.length - 1]
      if (e.type === 'text' && last?.type === 'text' && last.n === e.n) last.delta += e.delta
      else queue.push({ ...e })
      if (e.type !== 'text') void send()
      else timer ??= setTimeout(() => void send(), o.textMs ?? TEXT_MS)
    },
    flush: async () => void (await send()),
    end: async (e) => {
      await send()
      await ref.update({ end: JSON.stringify(e), endedAt: Date.now() }).catch(() => undefined)
    },
  }
}

export type Ctl = {
  // Aborts when the person stops the run.
  signal: AbortSignal
  // The person asked, while it worked, to stop the job after the step under way (D-328's `stopAfter`).
  stopAfter: () => boolean
  // Words written since the last call, oldest first; each is given once.
  words: () => string[]
  // The ids of every word given so far (kept with a checkpoint, so none is given twice).
  heard: () => string[]
  view: () => WhereView
  ui: UiFacade
  close: () => void
}

// What the person does while the run works. Resolves once what was there already has been read.
export async function openCtl(db: Database, uid: string, run: string, first: WhereView, o: { heard?: string[]; moveMs?: number } = {}): Promise<Ctl> {
  const ref = db.ref(ctlPath(uid, run))
  const stop = new AbortController()
  let view = first
  let watched = false
  let after = false
  // Read off the node, and those of them handed on: only these are kept, so words read but not yet given aren't lost.
  const read = new Set(o.heard ?? [])
  const given = new Set(o.heard ?? [])
  const waiting: { id: string; text: string }[] = []
  const answers = new Map<string, (said: string | null) => void>()
  let move = 0

  const on = (path: string, f: (s: DataSnapshot) => void) => {
    const r = ref.child(path)
    r.on('value', f, () => undefined)
    return () => r.off('value', f)
  }
  const offs = [
    on('stop', (s) => s.val() === true && stop.abort()),
    on('here', (s) => void (watched = s.exists())),
    on('after', (s) => void (after = s.val() === true)),
    on('view', (s) => {
      const v = s.val() as unknown
      if (typeof v !== 'string') return
      try {
        view = readView(JSON.parse(v))
      } catch {
        // Not a view: the last one stands.
      }
    }),
    on('words', (s) =>
      void s.forEach((c) => {
        const t = (c.val() as { text?: unknown } | null)?.text
        if (!c.key || read.has(c.key) || typeof t !== 'string' || !t.trim()) return false
        read.add(c.key)
        waiting.push({ id: c.key, text: t.trim().slice(0, ASK_MAX) })
        return false
      }),
    ),
    on('done', (s) =>
      void s.forEach((c) => {
        const f = c.key ? answers.get(c.key) : undefined
        if (f && c.key) {
          answers.delete(c.key)
          const v = c.val() as unknown
          f(v === true ? null : typeof v === 'string' ? v.slice(0, 300) : 'it failed')
        }
        return false
      }),
    ),
  ]
  // The listeners' first answers are in by the time this read is.
  await ref.get().catch(() => undefined)

  // A move asked of the tab: done when it says so; with no tab watching, the model hears that nothing moved.
  const ask = async (tool: string, args: unknown): Promise<void> => {
    if (!watched) throw new Error("the person isn't looking at this chat now, so nothing on their screen moved")
    const mid = `m${++move}`
    const said = new Promise<string | null>((resolve) => {
      answers.set(mid, resolve)
      setTimeout(() => answers.delete(mid) && resolve('their screen did not answer, so it may not have moved'), o.moveMs ?? MOVE_MS).unref?.()
    })
    await db.ref(`${livePath(uid, run)}/moves/${mid}`).set(JSON.stringify({ tool, args }))
    const why = await said
    if (why) throw new Error(why)
  }
  return {
    signal: stop.signal,
    stopAfter: () => after,
    words: () =>
      waiting.splice(0).map((w) => {
        given.add(w.id)
        return w.text
      }),
    heard: () => [...given],
    view: () => view,
    close: () => offs.forEach((off) => off()),
    ui: {
      goTo: (id) => ask('goTo', id),
      focus: (id) => ask('focus', id),
      select: (ids) => ask('select', ids),
      openPanel: (id) => ask('openPanel', id),
      showBeside: (id) => ask('showBeside', id),
      currentView: () => view,
    },
  }
}

export const dropLive = async (db: Database, uid: string, run: string) => {
  await Promise.all([db.ref(livePath(uid, run)).remove(), db.ref(ctlPath(uid, run)).remove()])
}
