// What this person has seen of the onboarding (D-315, docs/specs/onboarding.md §5.3), as a zustand store over
// src/data/onboarding.ts: this browser's copy at once, the Firestore doc merged in when it comes (and every change to
// it while started, from another tab or device), other tabs' localStorage writes too. The coach calls startFor(uid)
// on sign-in and stop() on sign-out. No components here.
import { create } from 'zustand'
import {
  readLocalSeen,
  seenWriter,
  watchLocalSeen,
  watchRemoteSeen,
  writeLocalSeen,
  type RemoteSeen,
  type SeenWriter,
} from '../data/onboarding'
import {
  armKey,
  cleanArmed,
  freshState,
  isArmed,
  mergeSeenState,
  sameSeenState,
  MAX_SEEN,
  type Audience,
  type SeenState,
  type Stamped,
  type WelcomeEnd,
} from './seenMerge'

export { armKey }

type Progress = {
  uid: string | null
  // The whole kept state; null while this person has none anywhere (a new person, until begin()).
  state: SeenState | null
  seen: Record<string, number>
  armed: string[]
  tipsOff: boolean
  lastRelease: string
  welcome: WelcomeEnd | null
  // The Firestore read has settled (found, none or unavailable). Changes made before that wait for it (they're
  // applied right after, in order), so a fresh copy never gets merged over the person's real doc.
  loaded: boolean
  // A seen-state existed (here or in Firestore) before this session: the person is known, not new (§5.2).
  hadDoc: boolean

  startFor(uid: string): void
  stop(): Promise<void>
  // The first write (§5.2): records audience, startedAt and lastRelease. Does nothing when a state exists.
  begin(audience: Audience, lastRelease: string): void
  markSeen(id: string, v: number): void
  // Entries as `id@v` (armKey); a bare id is v1.
  arm(ids: string[]): void
  setTipsOff(off: boolean): void
  setWelcome(end: WelcomeEnd): void
  setLastRelease(id: string): void
  noteNudge(at?: number): void
  isArmed(id: string): boolean
}

const empty = {
  uid: null,
  state: null,
  seen: {},
  armed: [],
  tipsOff: false,
  lastRelease: '',
  welcome: null,
  loaded: false,
  hadDoc: false,
}

function view(s: SeenState | null) {
  return s
    ? { state: s, seen: s.seen, armed: s.armed, tipsOff: s.tipsOff, lastRelease: s.lastRelease, welcome: s.welcome ?? null }
    : { state: null, seen: {}, armed: [], tipsOff: false, lastRelease: '', welcome: null }
}

// How long stop() waits for the last write (an offline setDoc never resolves).
const STOP_WAIT = 3000

let writer: SeenWriter | null = null
let unwatch: Array<() => void> = []
// Firestore writes wait for a real read (found or none): a doc never read is never written over.
let remoteReady = false
// Changes asked for before `loaded`, applied once it is.
let waiting: Array<() => void> = []
// The state came from current()'s fallback (no doc anywhere, a change before begin()): begin() still fills in who
// this is and when they started.
let provisional = false
// Bumped by every start/stop, so anything that comes back after its session ended is dropped.
let session = 0

export const useProgress = create<Progress>((set, get) => {
  // Keep a change: here, in this browser at once (merged with what other tabs kept), in Firestore within the gap.
  const keep = (next: SeenState) => {
    const uid = get().uid
    if (!uid) return
    const kept = writeLocalSeen(uid, next)
    set(view(kept))
    if (remoteReady) writer?.push(kept)
  }

  // Changes before begin() (they shouldn't happen) start a state as a new person's, with no release yet; begin()
  // fills those in later.
  const current = (now: number): SeenState => {
    const s = get().state
    if (s) return s
    provisional = true
    return freshState('new', '', now)
  }

  const whenLoaded = (run: () => void) => {
    if (!get().uid) return
    if (get().loaded) run()
    else waiting.push(run)
  }

  const change = (fn: (s: SeenState, now: number) => SeenState | null) => {
    // The time it was asked for: a setting made while loading is still stamped when it was made.
    const asked = Date.now()
    whenLoaded(() => {
      const next = fn(current(asked), asked)
      if (next) keep({ ...next, updatedAt: Math.max(asked, next.updatedAt) })
    })
  }

  const stamped = <F extends Stamped>(s: SeenState, f: F, now: number, patch: Partial<SeenState>): SeenState => ({
    ...s,
    ...patch,
    at: { ...s.at, [f]: now },
  })

  const settle = () => {
    if (get().loaded) return
    set({ loaded: true })
    const runs = waiting
    waiting = []
    for (const run of runs) run()
  }

  const onRemote = (uid: string, r: RemoteSeen) => {
    if (r.status === 'unavailable') {
      // Can't tell (refused, offline, a doc we can't read): localStorage alone, and never written over.
      remoteReady = false
      settle()
      return
    }
    remoteReady = true
    const here = get().state
    if (r.status === 'none') {
      settle()
      // Kept only in this browser so far (rules weren't there, or offline then): Firestore gets it now.
      const s = get().state
      if (s) writer?.push(s)
      return
    }
    // A doc of theirs: begin() has nothing left to fill.
    provisional = false
    const merged = here ? mergeSeenState(here, r.state) : r.state
    const kept = writeLocalSeen(uid, merged)
    set({ ...view(kept), hadDoc: true })
    settle()
    const s = get().state
    if (s && !sameSeenState(s, r.state)) writer?.push(s)
  }

  return {
    ...empty,

    startFor(uid) {
      if (get().uid === uid) return
      void get().stop()
      const mine = ++session
      remoteReady = false
      provisional = false
      writer = seenWriter(uid)
      const local = readLocalSeen(uid)
      set({ ...empty, ...view(local), uid, hadDoc: Boolean(local) })
      unwatch = [
        watchRemoteSeen(uid, (r) => {
          if (mine === session) onRemote(uid, r)
        }),
        watchLocalSeen(uid, (other) => {
          if (mine !== session) return
          const here = get().state
          set(view(here ? mergeSeenState(here, other) : other))
          if (!here) set({ hadDoc: true })
        }),
      ]
    },

    async stop() {
      session++
      remoteReady = false
      waiting = []
      for (const off of unwatch) off()
      unwatch = []
      const w = writer
      writer = null
      set({ ...empty })
      if (w) await Promise.race([w.stop(), new Promise((r) => setTimeout(r, STOP_WAIT))])
    },

    begin(audience, lastRelease) {
      const asked = Date.now()
      whenLoaded(() => {
        const s = get().state
        if (!s) {
          keep(freshState(audience, lastRelease, asked))
        } else if (provisional) {
          // Made by a change before begin(): who they are and when they started are begin()'s; lastRelease too, unless
          // a setter already set it.
          provisional = false
          const startedAt = Math.min(s.startedAt, asked)
          keep({ ...s, audience, startedAt, ...(!s.at?.lastRelease && { lastRelease }), updatedAt: Math.max(asked, s.updatedAt) })
        }
      })
    },

    markSeen(id, v) {
      change((s) => {
        if ((s.seen[id] ?? 0) >= v) return null
        if (!(id in s.seen) && Object.keys(s.seen).length >= MAX_SEEN) return null
        const seen = { ...s.seen, [id]: v }
        return { ...s, seen, armed: cleanArmed(s.armed, seen) }
      })
    },

    arm(ids) {
      change((s) => {
        const armed = cleanArmed([...s.armed, ...ids], s.seen)
        return armed.join() === s.armed.join() ? null : { ...s, armed }
      })
    },

    setTipsOff(off) {
      change((s, now) => (s.tipsOff === off ? null : stamped(s, 'tipsOff', now, { tipsOff: off })))
    },

    setWelcome(end) {
      change((s, now) => (s.welcome === end ? null : stamped(s, 'welcome', now, { welcome: end })))
    },

    setLastRelease(id) {
      change((s, now) => (s.lastRelease === id ? null : stamped(s, 'lastRelease', now, { lastRelease: id })))
    },

    noteNudge(at = Date.now()) {
      change((s) => ({ ...s, nudges: { last: at } }))
    },

    isArmed(id) {
      const s = get().state
      return Boolean(s && isArmed(s, id))
    },
  }
})
