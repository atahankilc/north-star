// One run, done by one worker (D-434, docs/specs/agent-server.md §5): takes the lease, runs the turn from the start or
// from its last checkpoint, keeps it before every step, tells the tab as it goes, then ends the run: the chat saved, the
// changes kept for the preview, what follows by itself queued. Everything it needs is handed in, so the same code runs
// under Cloud Tasks, in the emulators and in tests.
import type { Database } from 'firebase-admin/database'
import type { Firestore } from 'firebase-admin/firestore'
import type { AgentModel, Usage } from '../../../src/agent/contract'
import type { SavedStep } from '../../../src/agent/chats'
import type { Ask } from './ask'
import { changesPath, runPath, threadPath, type Keep } from './keep'
import { liveEvent, liveOut, openCtl } from './live'
import { endRun, LeaseLost, type Ending, releaseLease, renewLease, takeLease, newRunId, type NewRun, type Run } from './runs'
import { afterTurn, entriesOfRun, loadThread, onAsk, saveRun, type KeptThread } from './thread'
import type { EnvState } from './env'
import type { SavedTurn } from '../../../src/agent/chats'
import { NotAMember, RoleChanged, runServerTurn, type Checkpoint } from './turn'
import type { WebConfig } from './person'

// What's kept of the message: what the run needs of `Ask`. `auto`: the app's own go-on, not the person's words.
export type KeptAsk = Pick<Ask, 'text' | 'view' | 'off'> & { name?: string; auto?: boolean }
// The checkpoint with what the worker itself must not lose.
// A finished turn, kept before anything of it is written: whatever dies after it, the end is done once more from here,
// never the turn.
type KeptDone = { history: KeptThread['history']; env: EnvState; entries: SavedTurn[]; ending: Ending; told: Record<string, unknown>; next?: { id: string; run: NewRun; ask: KeptAsk } }
type KeptStep = { c: Checkpoint; heard: string[]; said: string[]; steps: SavedStep[] }

export type WorkDeps = {
  db: Firestore
  rtdb: Database
  keep: Keep
  web: WebConfig
  // The model the run is paid for with, or why not, in the person's words (thrown).
  model: (run: Run & { id: string }) => Promise<AgentModel>
  // The run's own key: handed to the run that follows, before it's queued; done with, at the end.
  keyTo: (run: string, next: string) => Promise<void>
  keyDone: (run: string) => Promise<void>
  enqueue: (run: string) => Promise<void>
  // What each model call used (§8; the whole ledger is P3).
  used?: (run: Run & { id: string }, step: { n: number; usage: Usage }) => void
  // This worker's name on the lease, and when its time is nearly up (it gives the run to the next task).
  by: string
  deadline: number
  now?: () => number
  log?: (what: string, more?: Record<string, unknown>) => void
}

class Later extends Error {}

const LEASE_EVERY = 20_000

export type Worked = 'ended' | 'later' | 'nothing'

export async function work(id: string, d: WorkDeps): Promise<Worked> {
  const now = d.now ?? Date.now
  const leased = await takeLease(d.db, id, d.by, now())
  if (!leased) return 'nothing'
  const run = { ...leased.run, id }
  const out = liveOut(d.rtdb, run.uid, id, { from: Math.max(0, now() - run.createdAt) })
  const finish = async (e: Ending, told: Record<string, unknown> = {}, next?: { id: string; run: NewRun }) => {
    const ended = await endRun(d.db, id, d.by, e, next, now())
    if (!ended) return false
    await d.keyDone(id).catch(() => undefined)
    await out.end({ ...e, ...told, ...(next ? { next: next.id } : {}) })
    if (next) await d.enqueue(next.id)
    await d.keep.drop(runPath(run.uid, id, 'ask').replace(/ask\.json\.gz$/, '')).catch(() => undefined)
    return true
  }
  if (leased.spent) {
    await finish({ status: 'failed', said: 'The agent stopped several times on this. Send it again, or in smaller steps.' })
    return 'ended'
  }

  // The turn's end, each part safe to do again.
  const close = async (k: KeptDone) => {
    await d.keep.save(threadPath(run.uid, run.wid, run.chatId), { v: 1, history: k.history, env: k.env } satisfies KeptThread)
    await d.keep.save(changesPath(run.uid, run.wid, run.chatId), { run: id, changes: k.env.changes, ids: k.env.ids, job: k.env.job })
    await saveRun(d.db, { run: id, uid: run.uid, wid: run.wid, chatId: run.chatId, model: run.model, entries: k.entries, env: k.env, now: now() })
    if (k.next) {
      await d.keep.save(runPath(run.uid, k.next.id, 'ask'), k.next.ask)
      await d.keyTo(id, k.next.id)
    }
    await finish(k.ending, k.told, k.next ? { id: k.next.id, run: k.next.run } : undefined)
  }
  const over = await d.keep.load<KeptDone>(runPath(run.uid, id, 'done'))
  if (over) {
    await close(over)
    return 'ended'
  }

  const ask = await d.keep.load<KeptAsk>(runPath(run.uid, id, 'ask'))
  if (!ask) {
    await finish({ status: 'failed', said: 'This message is gone; send it again.' })
    return 'ended'
  }
  const was = await d.keep.load<KeptStep>(runPath(run.uid, id, 'step'))
  const ctl = await openCtl(d.rtdb, run.uid, id, ask.view, { heard: was?.heard ?? [] })
  // Words handed to the loop since the last checkpoint: theirs are ids, so a resumed run takes each once.
  const said: string[] = [...(was?.said ?? [])]
  const steps: SavedStep[] = [...(was?.steps ?? [])]
  let at = was?.c.turn.n ?? 1
  // The lease goes on while a step takes long; losing it stops the run at once.
  const lost = new AbortController()
  const beat = setInterval(() => void renewLease(d.db, id, d.by, at, now()).catch((e) => e instanceof LeaseLost && lost.abort()), LEASE_EVERY)
  const signal = AbortSignal.any([ctl.signal, lost.signal])
  if (was) out.event({ type: 'again', n: at })
  else out.event({ type: 'asked', n: 0, text: ask.text, ...(ask.auto ? { auto: true } : {}) })
  try {
    const thread = await loadThread(d.keep, d.db, run)
    const model = await d.model(run)
    const done = await runServerTurn(
      { wid: run.wid, uid: run.uid, ...(ask.name ? { name: ask.name } : {}), chatId: run.chatId, turnId: `${run.chatId}:${run.turn}`, ask: ask.text, canvas: ask.view.canvas, history: thread.history, was: onAsk(thread.env), ...(ask.off ? { off: ask.off } : {}), ...(was ? { from: was.c } : {}) },
      {
        web: d.web,
        admin: d.db,
        model,
        ui: ctl.ui,
        signal,
        steer: () => {
          const words = ctl.words()
          for (const w of words) {
            said.push(w)
            out.event({ type: 'heard', n: at, text: w })
          }
          return words
        },
        onEvent: (e) => {
          const l = liveEvent(e)
          if (l) out.event(l)
          if (e.type === 'tool_finished') steps.push({ label: e.call.label, ...(e.call.ms !== undefined ? { ms: e.call.ms } : {}), ...(e.call.ok === false ? { ok: false } : {}) })
          else if (e.type === 'search') steps.push({ label: `searched the web: "${e.query}"` })
          else if (e.type === 'usage') d.used?.(run, { n: e.n, usage: e.step })
        },
        keep: async (c) => {
          at = c.turn.n
          if (lost.signal.aborted) throw new LeaseLost()
          await renewLease(d.db, id, d.by, at, now())
          await d.keep.save(runPath(run.uid, id, 'step'), { c, heard: ctl.heard(), said: [...said], steps: [...steps] } satisfies KeptStep)
          if (now() > d.deadline) throw new Later()
        },
      },
    )
    if (lost.signal.aborted) throw new LeaseLost()
    const job = done.env.job && ctl.stopAfter() ? { ...done.env.job, stopAfter: true } : done.env.job
    const moved = afterTurn({ ...done.env, job }, { turn: done.turn, left: ctl.words() })
    const items = moved.env.changes.items
    const t = done.turn
    const follow = moved.say !== undefined && t.end !== 'error'
    const k: KeptDone = {
      history: done.history,
      env: moved.env,
      entries: entriesOfRun({ asked: [...(ask.auto ? [] : [ask.text]), ...said], turn: t, model: run.model, steps, items, now: now() }),
      ending: { status: t.end === 'error' ? 'failed' : t.end === 'stopped' ? 'stopped' : items.length ? 'waiting' : 'done', end: t.end, pending: items.length, steps: t.steps.length, ...(t.error ? { said: t.error } : {}) },
      told: { answer: t.answer, usage: t.usage, ms: Math.round(t.ms), ...(t.sources?.length ? { sources: t.sources } : {}), ...(moved.env.job ? { job: moved.env.job } : {}), ...(follow ? { say: moved.say, auto: !!moved.auto } : {}) },
      ...(follow
        ? {
            next: {
              id: newRunId(d.db),
              run: { uid: run.uid, wid: run.wid, chatId: run.chatId, paidBy: run.paidBy, provider: run.provider, model: run.model, ...(run.effort ? { effort: run.effort } : {}) },
              ask: { text: moved.say!, view: ctl.view(), ...(ask.name ? { name: ask.name } : {}), ...(moved.auto ? { auto: true } : {}) },
            },
          }
        : {}),
    }
    await d.keep.save(runPath(run.uid, id, 'done'), k)
    await close(k)
    return 'ended'
  } catch (e) {
    await out.flush()
    if (e instanceof LeaseLost) return 'nothing'
    if (e instanceof Later) {
      await releaseLease(d.db, id, d.by, true)
      await d.enqueue(id)
      return 'later'
    }
    const why = whyStopped(e)
    if (why) {
      await finish({ status: 'failed', said: why })
      return 'ended'
    }
    d.log?.('run broke', { run: id, error: (e as Error)?.name })
    // Given back as it is: Cloud Tasks tries again, from the last checkpoint.
    await releaseLease(d.db, id, d.by, false)
    throw e
  } finally {
    clearInterval(beat)
    ctl.close()
  }
}

// A failure that trying again won't mend, in the person's words.
export class Stop extends Error {}
function whyStopped(e: unknown): string | null {
  if (e instanceof Stop) return e.message
  if (e instanceof NotAMember) return 'You are not in this workspace any more.'
  if (e instanceof RoleChanged) return 'Your role in this workspace changed while the agent worked; send it again.'
  if ((e as { code?: string })?.code === 'permission-denied') return "The agent couldn't read the workspace as you; send it again."
  return null
}
