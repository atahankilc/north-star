// Presence and live cursors (Phase 3, D-016, D-065): ephemeral state in RTDB at presence/{wid}/{uid}.
// Each tab writes its whole node (small), so if another tab of the same user disconnects and removes it,
// the next write puts it back. onDisconnect() removes it when the tab goes away.
import { onDisconnect, onValue, ref, remove, serverTimestamp, set, type DatabaseReference } from 'firebase/database'
import { useEffect } from 'react'
import { create } from 'zustand'
import { accents } from '../styles/tokens'
import type { AuthUser } from './auth'
import { firebase } from './firebase'

export type PresenceView = 'overview' | 'board' | 'flow' | 'table' | 'matrix' | 'priorities' | 'reports'

export type Presence = {
  name: string
  color: string
  photo?: string
  view: PresenceView
  // The plane they have open on the board (D-139); absent = All.
  plane?: string
  // Board cursor in world units; absent when the pointer is off the board (or on another view). In `usePresence`'s peers
  // only whether it's there is kept up to date: where it is now comes from `cursorAt` (D-169).
  x?: number
  y?: number
  // The item they have selected (the last one picked)…
  sel?: string
  // …and the rest of a selection of several, ids joined by spaces (D-124). Absent with one or none.
  more?: string
  // When they joined (server time). Earlier joiners keep their colour when someone new arrives.
  since?: number
  ts: number
}

export type Peer = Presence & { uid: string }

// ~16 writes a second at most while the pointer moves (ARCHITECTURE §6); the smoothing is all on the side that watches.
const WRITE_EVERY_MS = 60
// A heartbeat keeps `ts` fresh; anyone silent for longer than STALE_MS is hidden (a crashed tab whose
// onDisconnect hasn't fired yet).
const HEARTBEAT_MS = 20_000
const STALE_MS = 60_000

// Each person's preferred colour: a hash of their uid over the accent palette (DESIGN.md §3).
export function presenceColor(uid: string): string {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0
  return accents[Math.abs(h) % accents.length]
}

// The colour everyone sees for each person here. In join order, each person takes their preferred colour if it's
// still free, otherwise the first free accent, so up to five people never share one. Every client computes the same
// answer from the same list, so nothing extra is written; earlier joiners keep theirs when someone arrives.
export function assignColors(people: { uid: string; since?: number }[]): Map<string, string> {
  const order = [...people].sort((a, b) => (a.since ?? Infinity) - (b.since ?? Infinity) || a.uid.localeCompare(b.uid))
  const used = new Set<string>()
  const out = new Map<string, string>()
  order.forEach(({ uid }, i) => {
    const preferred = presenceColor(uid)
    const color = !used.has(preferred) ? preferred : (accents.find((c) => !used.has(c)) ?? accents[i % accents.length])
    used.add(color)
    out.set(uid, color)
  })
  return out
}

type PresenceState = {
  // Everyone else in this workspace right now (never yourself, not even your other tabs), in their assigned colour.
  peers: Peer[]
  // Your own colour here, as the others see it; null outside a workspace.
  myColor: string | null
  // The person whose cursor (and view) you're following, if anyone.
  following: string | null
  follow: (uid: string | null) => void
}

export const usePresence = create<PresenceState>((set) => ({
  peers: [],
  myColor: null,
  following: null,
  follow: (uid) => set({ following: uid }),
}))

// Board cursors (D-169), kept out of React state so a moving pointer doesn't re-render every view 16 times a second:
// each position with the time it arrived. The board draws everyone CURSOR_DELAY_MS in the past and curves through what
// they actually sent, so uneven arrivals still move evenly, like Miro or Figma.
type Sample = { t: number; x: number; y: number }
const tracks = new Map<string, Sample[]>()
const listeners = new Set<() => void>()
export const CURSOR_DELAY_MS = 2 * WRITE_EVERY_MS

function track(uid: string, x: number, y: number) {
  const now = performance.now()
  const s = tracks.get(uid)
  const last = s?.[s.length - 1]
  if (!s || !last) return void tracks.set(uid, [{ t: now, x, y }])
  if (last.x === x && last.y === y) return
  // After a still spell, the move starts from where it rested, one write before this one.
  if (now - last.t > 2 * WRITE_EVERY_MS) s.push({ t: now - WRITE_EVERY_MS, x: last.x, y: last.y })
  // Writes that arrive bunched up are spread out again (never ahead of the delay).
  const t = Math.min(now + WRITE_EVERY_MS, Math.max(now, s[s.length - 1].t + WRITE_EVERY_MS * 0.75))
  s.push({ t, x, y })
  if (s.length > 32) s.splice(0, s.length - 32)
}

// Someone's cursor on the board at `now`: CURSOR_DELAY_MS behind, on a curve through their samples. `moving` = still
// gliding, so the board asks for another frame.
export function cursorAt(uid: string, now = performance.now()): { x: number; y: number; moving: boolean } | null {
  const s = tracks.get(uid)
  if (!s?.length) return null
  const t = now - CURSOR_DELAY_MS
  const last = s[s.length - 1]
  if (t >= last.t) return { x: last.x, y: last.y, moving: false }
  // Drop what's long past, keeping one sample before the pair we're between (the curve needs it).
  while (s.length > 3 && s[2].t <= t) s.shift()
  let i = 0
  while (i < s.length - 2 && s[i + 1].t <= t) i++
  const a = s[i]
  const b = s[i + 1]
  if (t <= a.t) return { x: a.x, y: a.y, moving: true }
  const u = (t - a.t) / (b.t - a.t)
  const p0 = s[i - 1] ?? a
  const p3 = s[i + 2] ?? b
  return { x: catmullRom(p0.x, a.x, b.x, p3.x, u), y: catmullRom(p0.y, a.y, b.y, p3.y, u), moving: true }
}

const catmullRom = (p0: number, p1: number, p2: number, p3: number, u: number) =>
  0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u)

// Called whenever a cursor moves: the board asks for a frame.
export function onCursorMove(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

// This tab's own node: what we last wrote, and where to write it.
let mine: { node: DatabaseReference; data: Omit<Presence, 'ts' | 'since'>; since: number | null } | null = null
let lastWrite = 0
let pending: number | null = null

function flush() {
  pending = null
  if (!mine) return
  lastWrite = performance.now()
  // Drop undefined fields: RTDB refuses them.
  const data = Object.fromEntries(Object.entries(mine.data).filter(([, v]) => v !== undefined))
  set(mine.node, { ...data, since: mine.since ?? serverTimestamp(), ts: serverTimestamp() }).catch(() => {})
}

function schedule() {
  if (!mine || pending !== null) return
  const wait = Math.max(0, WRITE_EVERY_MS - (performance.now() - lastWrite))
  pending = window.setTimeout(flush, wait)
}

function patch(p: Partial<Omit<Presence, 'ts' | 'since'>>) {
  if (!mine) return
  const next = { ...mine.data, ...p }
  if ((Object.keys(next) as (keyof typeof next)[]).every((k) => next[k] === mine!.data[k])) return
  mine.data = next
  schedule()
}

// Board pointer in world units, or null when it leaves the board.
export function setCursor(at: [number, number] | null) {
  patch(at ? { x: round(at[0]), y: round(at[1]) } : { x: undefined, y: undefined })
}

// The plane the board shows (D-139): cursors are only drawn for people on the same one.
export function setPresencePlane(plane: string | undefined) {
  patch({ plane })
}

// What you have selected: `id`, plus the rest of a selection of several on the board (D-124).
export function setPresenceSelection(id: string | null, selection: string[] = []) {
  let more = ''
  for (const s of selection) {
    if (s === id || more.length + s.length + 1 > MORE_MAX) continue
    more = more ? `${more} ${s}` : s
  }
  patch({ sel: id ?? undefined, more: id && more ? more : undefined })
}

// The rules' cap on `more` (database.rules.json): about a hundred ids. A bigger selection shows its first hundred.
const MORE_MAX = 2048

// Everything a peer has selected.
export const selectionOf = (p: Presence): string[] => (p.sel ? [p.sel, ...(p.more ? p.more.split(' ') : [])] : [])
export const hasSelected = (p: Presence, id: string) => p.sel === id || (p.more ? p.more.split(' ').includes(id) : false)

const round = (v: number) => Math.round(v * 1000) / 1000

// Announce yourself in a workspace while mounted, and listen for everyone else.
export function usePresenceSession(wid: string, user: AuthUser | null, view: PresenceView) {
  const uid = user?.id
  const name = user?.name || user?.email || 'Someone'
  const photo = user?.photoURL ?? undefined

  useEffect(() => {
    const rtdb = firebase?.rtdb
    if (!rtdb || !uid) return
    const node = ref(rtdb, `presence/${wid}/${uid}`)
    mine = { node, data: { name: name.slice(0, 80), color: presenceColor(uid), photo, view: 'board' }, since: null }

    // Whenever the connection (re)opens: re-arm the clean-up and write ourselves back.
    const offConnected = onValue(ref(rtdb, '.info/connected'), (snap) => {
      if (snap.val() !== true) return
      onDisconnect(node)
        .remove()
        .then(flush)
        .catch(() => {})
    })

    let offset = 0
    const offOffset = onValue(ref(rtdb, '.info/serverTimeOffset'), (snap) => (offset = snap.val() ?? 0))
    let all: Record<string, Presence> = {}
    // The peer list as last published, cursors as there-or-not: a cursor that only moved doesn't publish again.
    let shape = ''
    const publish = () => {
      const now = Date.now() + offset
      const here = Object.entries(all)
        .filter(([id, p]) => id !== uid && now - (p.ts ?? 0) < STALE_MS)
        .map(([id, p]) => ({ ...p, uid: id }))
      let moved = false
      for (const p of here) {
        if (p.x === undefined || p.y === undefined) tracks.delete(p.uid)
        else (track(p.uid, p.x, p.y), (moved = true))
      }
      for (const id of tracks.keys()) if (!here.some((p) => p.uid === id)) tracks.delete(id)
      if (moved) listeners.forEach((fn) => fn())
      const next = JSON.stringify([
        mine?.since,
        here.map(({ x, y, ts: _ts, ...p }) => ({ ...p, at: x !== undefined && y !== undefined })),
      ])
      if (next === shape) return
      shape = next
      const colors = assignColors([...here, { uid, since: mine?.since ?? undefined }])
      const { following } = usePresence.getState()
      usePresence.setState({
        peers: here.map((p) => ({ ...p, color: colors.get(p.uid)! })).sort((a, b) => a.name.localeCompare(b.name)),
        myColor: colors.get(uid)!,
        // They left: stop following.
        following: following && here.some((p) => p.uid === following) ? following : null,
      })
    }
    const offPeers = onValue(
      ref(rtdb, `presence/${wid}`),
      (snap) => {
        all = (snap.val() as Record<string, Presence> | null) ?? {}
        // Our join time comes back from the server once; keep writing that one.
        const since = all[uid]?.since
        if (mine && mine.since === null && typeof since === 'number') mine.since = since
        publish()
      },
      () => usePresence.setState({ peers: [], following: null }),
    )

    const beat = window.setInterval(() => {
      flush()
      publish()
    }, HEARTBEAT_MS)
    // A hidden tab has no pointer on the board.
    const onVisibility = () => document.hidden && setCursor(null)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      offConnected()
      offOffset()
      offPeers()
      window.clearInterval(beat)
      document.removeEventListener('visibilitychange', onVisibility)
      if (pending !== null) window.clearTimeout(pending)
      pending = null
      mine = null
      tracks.clear()
      usePresence.setState({ peers: [], myColor: null, following: null })
      onDisconnect(node).cancel().catch(() => {})
      remove(node).catch(() => {})
    }
  }, [wid, uid, name, photo])

  useEffect(() => {
    patch(view === 'board' ? { view } : { view, x: undefined, y: undefined })
  }, [view, wid, uid])
}
