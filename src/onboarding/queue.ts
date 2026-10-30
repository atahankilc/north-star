// The onboarding's queue (D-315, docs/specs/onboarding.md §3.1, §5.4): given the events, what this person has seen, their
// role and what's going on (busy), it decides which one lesson shows, and when. No React, no Firebase, no clock of its
// own: everything is passed in, so vitest drives it with a fake clock and fake busy states. The coach (O5) calls
// `onEvent` for every event (events.ts' `onLearn`), `tick()` every ~100 ms (or `run()`), draws `current()`, and calls
// `close()` when the person closes it.
//
// The rules, as built here:
// - One at a time: nothing opens while a lesson shows, or while any busy source is on (a drag, focus moving, typing, a
//   menu, a wizard, setup, the hazard confirm, Settings, the finder, the threads panel, following, the camera gliding,
//   the curtain down, a modal of the coach's). A lesson `within` a surface ignores that one source, and typing while that
//   surface is on.
// - A triggered lesson waits for ≥ 400 ms of calm; busy for 10 s it is dropped, and stays due for its next trigger
//   (`onGiveUp` lets the coach arm it if it wants). One queued per lesson: a newer trigger of the same lesson replaces it.
// - `after`: while a lesson it names is queued or showing, it waits (no time limit, and that wait counts towards
//   nothing); once that one closes, is retired or is dropped, its own wait starts.
// - `unless`: one of those seen, this one is retired (marked seen, never shown).
// - Retire on done: a lesson's `doneWhen` event marks it seen, queued, showing or not yet triggered (not the welcome or
//   the kind guide, which have no `doneWhen`); one showing closes as done.
// - Cooldown: after one closes, the next automatic one (from `canvas-open`, `idle`, someone else's doing) waits 20 s;
//   one that answers an action waits only for calm.
// - tipsOff: nothing shows by itself; `play()` (the `?` guide) still does.
// - Nudges: at most one a session, only from an `idle` event whose counts match; one showing ends (not seen) when a
//   lesson is waiting that nothing else holds.
// - Roles: the lesson's roles, then each page's (default the lesson's), audience and kinds; nothing left, nothing shown.
// - Never twice: seen at its version (or closed this session) never shows by itself; an armed newer version (`NEW`) does.
// - A surface's own lesson goes first (O11): a lesson `within` a surface (a wizard, a menu, setup, the finder, Settings,
//   the threads panel, following; not typing, which opens nothing) is due while that surface is open, and another
//   lesson showing then (it steps aside, Lesson.tsx) doesn't keep the one slot from it: that one goes back to the queue,
//   its wait started again, not counted as seen.
// - A surface's own lesson that didn't show while its surface was open (the wizard closed first) is dropped, and stays
//   due for its next trigger (`onGiveUp`): it never shows outside its surface. One that came from elsewhere (a heading
//   made, for the finder's `headings-places`) and never saw its surface open is not dropped.
import { fitsRole } from './audience'
import { LESSONS, type Lesson, type LessonEvent, type Match, type Page, type Role, type Trigger, type Within } from './lessons'
import { isArmed } from './seenMerge'
import type { Audience } from './seenMerge'

export type Payload = Record<string, unknown>

// A surface's own list isn't a menu (O11): the finder's matches are a `listbox`, but the finder is its own busy source,
// and counting its list as a menu too would hold the finder's lessons for good.
export const OWN_LISTS = '[role="dialog"][aria-label="Find"]'
export const countsAsMenu = (el: Pick<Element, 'closest'>) => !el.closest(OWN_LISTS)
// `target`: what it was about, as the app's `data-target` names it (`card:<id>`, `plane:<id>`…): a lesson's anchor is
// looked for there first.
export type LearnEvent = { event: LessonEvent; payload?: Payload; target?: string }

// What can hold a lesson back (onboarding.md §5.4); `modal`: the coach's own welcome or what's new.
export const BUSY_SOURCES = [
  'drag', 'focusMoving', 'typing', 'menu', 'wizard', 'setup', 'hazard', 'settings', 'finder', 'threads', 'following',
  'gliding', 'curtainHidden', 'modal',
] as const
export type BusySource = (typeof BUSY_SOURCES)[number]
export type Busy = Partial<Record<BusySource, boolean>>

// What the queue reads of the seen-state (progress.ts' store has all of it).
export type ProgressView = { seen: Record<string, number>; armed: string[]; tipsOff: boolean }

export const CALM_MS = 400
export const GIVE_UP_MS = 10_000
export const COOLDOWN_MS = 20_000
// Waiting while a coach surface shows (a lesson, the welcome, what's new) doesn't count towards GIVE_UP_MS, up to this.
export const PAUSE_CAP_MS = 60_000
// How long a lesson retired while showing stays as "✓ done" before it goes.
export const DONE_MS = 1200

// Events nobody did just now (the canvas opening, being idle, someone else's doing): what they trigger is automatic.
export const AUTOMATIC: ReadonlySet<LessonEvent> = new Set<LessonEvent>(['canvas-open', 'idle', 'peer-joined', 'task-given', 'workspaces-open'])

// Nudges: at most one per page load, whichever queue shows it (module-level).
let nudgedThisLoad = false
export const resetNudgeBudget = () => void (nudgedThisLoad = false)

export type Shown = {
  lesson: Lesson
  // The pages this person gets (paged lessons; [] for the guide, nudges and empty states).
  pages: Page[]
  payload: Payload
  // What the event was about (LearnEvent's `target`): its anchor is looked for there first.
  target?: string
  // Armed by a release: shown with `NEW`.
  isNew: boolean
  // `play`: asked for in `?`; `event`: triggered.
  via: 'event' | 'play'
  since: number
  // Retired while showing: drawn as "✓ done" until DONE_MS later.
  doneAt?: number
}

export type CloseHow = 'done' | 'skipped' | 'closed'

export type QueueOptions = {
  lessons?: readonly Lesson[]
  now: () => number
  getBusy: () => Busy
  getProgress: () => ProgressView
  getRole: () => Role | null
  getAudience?: () => Audience
  // The seen-state has loaded (progress.ts' `loaded`; true when not given). Until then, and while the role isn't known
  // (null), everything triggered waits: nothing shows and no wait is counted.
  isLoaded?: () => boolean
  // A page's `if` (e.g. `has-tasks-button`): true when not given.
  pageIf?: (cond: NonNullable<Page['if']>) => boolean
  // Kept: a lesson seen (closed, skipped, done or retired). The coach passes progress.markSeen.
  markSeen?: (id: string, v: number) => void
  // A nudge shown (progress.noteNudge).
  noteNudge?: (at: number) => void
  // Dropped after the busy wait (it stays due for its next trigger).
  onGiveUp?: (id: string, v: number) => void
}

type Entry = {
  lesson: Lesson
  payload: Payload
  target?: string
  event: LessonEvent
  automatic: boolean
  // When its own wait started: queued, or released by `after` / the cooldown.
  readyAt: number | null
  calmSince: number | null
  // Since when a coach surface has been showing over it (PAUSE_CAP_MS).
  pausedSince: number | null
  // Its `within` surface was seen open while it waited (so its closing drops it).
  surfaceSeen?: boolean
  // A nudge already shown once (it gave way and came back): counted once.
  noted?: boolean
}

// The `within` sources that are a surface one opens and closes (typing isn't).
const SURFACES: ReadonlySet<BusySource> = new Set<BusySource>(['wizard', 'menu', 'setup', 'finder', 'settings', 'threads', 'following'])
const surfaceOf = (l: Lesson): BusySource | null => (l.within && SURFACES.has(l.within as BusySource) ? (l.within as BusySource) : null)

// An event's payload against a trigger's `when`: each key a value, one of a list, or a number at least `min`.
export function matches(t: Trigger, e: LearnEvent): boolean {
  if (t.event !== e.event) return false
  return whenMatches(t.when, e.payload ?? {})
}

export function whenMatches(when: Match | undefined, payload: Payload): boolean {
  if (!when) return true
  for (const [k, want] of Object.entries(when)) {
    const got = payload[k]
    if (Array.isArray(want)) {
      if (!want.includes(got as string)) return false
    } else if (typeof want === 'object' && want !== null) {
      if (typeof got !== 'number' || got < (want as { min: number }).min) return false
    } else if (got !== want) return false
  }
  return true
}

// The pages this person gets: the page's roles (default the lesson's), its audience, the trigger's kind, its `if`.
export function pagesFor(l: Lesson, role: Role | null, audience: Audience, payload: Payload, pageIf: (c: NonNullable<Page['if']>) => boolean): Page[] {
  if (l.format !== 'welcome' && l.format !== 'lesson') return []
  return l.pages.filter(
    (p) =>
      fitsRole(p.roles ?? l.roles, role) &&
      (!p.audience || p.audience === audience) &&
      (!p.kinds || p.kinds.includes(payload.kind as string)) &&
      (!p.if || pageIf(p.if)),
  )
}

// Whether a busy state holds a lesson back: any source on, except the one it's within (and typing inside that one).
export function holds(busy: Busy, within: Within | undefined): boolean {
  for (const s of BUSY_SOURCES) {
    if (!busy[s]) continue
    if (within && s === within) continue
    if (within && s === 'typing' && within !== 'typing' && busy[within as BusySource]) continue
    return true
  }
  return false
}

export type Queue = {
  onEvent(e: LearnEvent): void
  tick(): void
  current(): Shown | null
  // What waits, in order (for the coach's dev view and tests).
  queued(): string[]
  close(id: string, how: CloseHow): void
  // `?`: show it now, seen or not, tips off or not (closing what shows).
  play(id: string): void
  subscribe(fn: () => void): () => void
  // Ticks every `ms` with setInterval; returns the stop.
  run(ms?: number): () => void
}

export function createQueue(o: QueueOptions): Queue {
  const lessons = o.lessons ?? LESSONS
  const audience = () => o.getAudience?.() ?? 'new'
  const pageIf = o.pageIf ?? (() => true)
  const subs = new Set<() => void>()
  let queue: Entry[] = []
  let shown: Shown | null = null
  // The entry the shown lesson came from (triggered ones): what goes back to the queue when it gives way.
  let shownEntry: Entry | null = null
  // Closed or retired in this session: never again by itself, even before the progress store has it.
  const doneHere = new Map<string, number>()
  let closedAt = -Infinity
  const ready = () => (o.isLoaded?.() ?? true) && o.getRole() !== null
  const hold = (e: Entry) => {
    e.readyAt = null
    e.calmSince = null
  }

  const tell = () => subs.forEach((fn) => fn())
  const seenV = (id: string) => Math.max(o.getProgress().seen[id] ?? 0, doneHere.get(id) ?? 0)
  const isSeen = (l: Lesson) => seenV(l.id) >= l.v
  const seenAny = (id: string) => seenV(id) > 0

  const markSeen = (l: Lesson) => {
    if ((doneHere.get(l.id) ?? 0) >= l.v) return
    doneHere.set(l.id, l.v)
    o.markSeen?.(l.id, l.v)
  }

  // Due for this person now: their role, unseen at its version, not taught by an `unless` one, pages left.
  const due = (l: Lesson, payload: Payload): boolean => {
    if (isSeen(l)) return false
    if (!fitsRole(l.roles, o.getRole())) return false
    if ((l.format === 'welcome' || l.format === 'lesson') && pagesFor(l, o.getRole(), audience(), payload, pageIf).length === 0) return false
    return true
  }

  const waitingOnAfter = (e: Entry) =>
    (e.lesson.after ?? []).some((a) => (shown && shown.lesson.id === a && !shown.doneAt) || queue.some((q) => q !== e && q.lesson.id === a))

  const retire = (l: Lesson) => {
    markSeen(l)
    queue = queue.filter((q) => q.lesson.id !== l.id)
    if (shown && shown.lesson.id === l.id && !shown.doneAt) shown = { ...shown, doneAt: o.now() }
  }

  const onEvent = (e: LearnEvent) => {
    let changed = false
    // Retire on done first: the doing that retires a lesson never also opens it.
    for (const l of lessons) {
      if (l.format === 'welcome' || l.format === 'guide') continue
      if (!l.doneWhen?.some((t) => matches(t, e))) continue
      if (!isSeen(l) || queue.some((q) => q.lesson.id === l.id)) {
        retire(l)
        changed = true
      }
    }
    const payload = e.payload ?? {}
    // Tips off: nothing by itself (retiring above still counts what was done).
    const tipsOff = o.getProgress().tipsOff
    for (const l of lessons) {
      if (!l.trigger.some((t) => matches(t, e))) continue
      const known = ready()
      if (known && l.unless?.some(seenAny)) {
        if (!isSeen(l)) {
          retire(l)
          changed = true
        }
        continue
      }
      if (tipsOff || (known && !due(l, payload)) || isSeen(l)) continue
      if (shown && shown.lesson.id === l.id) continue
      if (l.format === 'nudge' && (nudgedThisLoad || queue.some((q) => q.lesson.format === 'nudge'))) continue
      const entry: Entry = { lesson: l, payload, target: e.target, event: e.event, automatic: AUTOMATIC.has(e.event), readyAt: null, calmSince: null, pausedSince: null }
      const at = queue.findIndex((q) => q.lesson.id === l.id)
      // One per lesson: the newer trigger replaces it, in its place.
      if (at >= 0) queue[at] = entry
      else queue.push(entry)
      changed = true
    }
    if (changed) tell()
    tick()
  }

  const show = (e: Entry, now: number) => {
    queue = queue.filter((q) => q !== e)
    shownEntry = e
    shown = {
      lesson: e.lesson,
      pages: pagesFor(e.lesson, o.getRole(), audience(), e.payload, pageIf),
      payload: e.payload,
      ...(e.target ? { target: e.target } : {}),
      isNew: isArmed(o.getProgress(), e.lesson.id),
      via: 'event',
      since: now,
    }
    if (e.lesson.format === 'nudge' && !e.noted) {
      nudgedThisLoad = true
      o.noteNudge?.(now)
    }
  }

  const tick = () => {
    const now = o.now()
    let changed = false
    if (shown?.doneAt !== undefined && now - shown.doneAt >= DONE_MS) {
      shown = null
      shownEntry = null
      closedAt = now
      changed = true
    }
    // The seen-state or the role not known yet: everything waits, uncounted.
    if (!ready()) {
      queue.forEach(hold)
      if (changed) tell()
      return
    }
    // Taught by an `unless` one, seen meanwhile (another tab, the store catching up), or not this person's: out.
    const before = queue.length
    for (const q of [...queue]) if (q.lesson.unless?.some(seenAny)) retire(q.lesson)
    queue = queue.filter((q) => due(q.lesson, q.payload))
    if (queue.length !== before) changed = true

    const busy = o.getBusy()
    const tipsOff = o.getProgress().tipsOff
    // A surface's own lesson whose surface closed before it showed: dropped, due again at its next trigger.
    for (const e of [...queue]) {
      const sf = surfaceOf(e.lesson)
      if (!sf) continue
      if (busy[sf]) e.surfaceSeen = true
      else if (e.surfaceSeen) {
        queue = queue.filter((q) => q !== e)
        o.onGiveUp?.(e.lesson.id, e.lesson.v)
        changed = true
      }
    }
    // A nudge never holds the slot against a lesson (O11): one showing while another waits that nothing else holds ends
    // (not seen; the session's one nudge stays spent), and that one goes on.
    if (shown && shown.lesson.format === 'nudge' && shown.via === 'event' && !shown.doneAt) {
      const waiting = queue.some((e) => e.lesson.format !== 'nudge' && !waitingOnAfter(e) && !holds(busy, e.lesson.within))
      if (waiting) {
        shown = null
        shownEntry = null
        changed = true
      }
    }
    // A surface opened while another triggered lesson shows, and that surface's own lesson waits for it (nothing else
    // holding it): the one showing gives way, back to the front of the queue with its wait started again.
    if (shown && shownEntry && shown.via === 'event' && !shown.doneAt && !tipsOff) {
      const mine = surfaceOf(shown.lesson)
      const claims = queue.some((e) => {
        const sf = surfaceOf(e.lesson)
        return !!sf && sf !== mine && !!busy[sf] && !waitingOnAfter(e) && !holds(busy, e.lesson.within)
      })
      if (claims) {
        const gave = shownEntry
        shown = null
        shownEntry = null
        // A surface's own lesson whose surface has closed meanwhile is dropped, as one that never showed would be; any
        // other goes back (a nudge already counted as shown stays counted once).
        if (mine && !busy[mine]) o.onGiveUp?.(gave.lesson.id, gave.lesson.v)
        else {
          const back: Entry = { ...gave, readyAt: null, calmSince: null, pausedSince: null, surfaceSeen: !!mine, noted: gave.lesson.format === 'nudge' || gave.noted }
          queue = [back, ...queue.filter((q) => q.lesson.id !== back.lesson.id)]
        }
        changed = true
      }
    }
    for (const e of [...queue]) {
      if (waitingOnAfter(e)) {
        // Waiting on another lesson counts towards nothing: its own wait starts once that one's gone.
        hold(e)
        e.pausedSince = null
        continue
      }
      // An automatic one waits out the cooldown first (that isn't busy waiting either).
      if (e.automatic && now - closedAt < COOLDOWN_MS) {
        hold(e)
        continue
      }
      // A coach surface showing (a lesson, the welcome, what's new): the wait is paused, up to PAUSE_CAP_MS.
      if (shown || busy.modal) {
        e.pausedSince ??= now
        hold(e)
        if (now - e.pausedSince >= PAUSE_CAP_MS) {
          queue = queue.filter((q) => q !== e)
          o.onGiveUp?.(e.lesson.id, e.lesson.v)
          changed = true
        }
        continue
      }
      e.pausedSince = null
      if (e.readyAt === null) e.readyAt = now
      if (holds(busy, e.lesson.within) || tipsOff) {
        e.calmSince = null
        if (now - e.readyAt >= GIVE_UP_MS) {
          queue = queue.filter((q) => q !== e)
          o.onGiveUp?.(e.lesson.id, e.lesson.v)
          changed = true
        }
        continue
      }
      if (e.calmSince === null) e.calmSince = now
      if (now - e.calmSince >= CALM_MS) {
        show(e, now)
        changed = true
        break
      }
    }
    if (changed) tell()
  }

  const close = (id: string, how: CloseHow) => {
    if (!shown || shown.lesson.id !== id) return
    void how
    markSeen(shown.lesson)
    shown = null
    shownEntry = null
    closedAt = o.now()
    tell()
  }

  const play = (id: string) => {
    const l = lessons.find((x) => x.id === id)
    if (!l) return
    if (shown) markSeen(shown.lesson)
    shownEntry = null
    queue = queue.filter((q) => q.lesson.id !== id)
    const role = o.getRole()
    const pages = l.format === 'welcome' || l.format === 'lesson' ? pagesFor(l, role, audience(), {}, pageIf) : []
    shown = { lesson: l, pages, payload: {}, isNew: isArmed(o.getProgress(), id), via: 'play', since: o.now() }
    tell()
  }

  return {
    onEvent,
    tick,
    current: () => shown,
    queued: () => queue.map((q) => q.lesson.id),
    close,
    play,
    subscribe: (fn) => (subs.add(fn), () => void subs.delete(fn)),
    run: (ms = 100) => {
      const t = setInterval(tick, ms)
      return () => clearInterval(t)
    },
  }
}
