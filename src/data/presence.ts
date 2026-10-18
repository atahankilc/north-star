// Presence and live cursors (Phase 3, D-016, D-065): ephemeral state in RTDB at presence/{wid}/{uid}.
// Each tab writes its whole node (small), so if another tab of the same user disconnects and removes it,
// the next write puts it back. onDisconnect() removes it when the tab goes away.
import { onDisconnect, onValue, ref, remove, serverTimestamp, set, type DatabaseReference } from 'firebase/database'
import { useEffect } from 'react'
import { create } from 'zustand'
import { accents } from '../styles/tokens'
import type { AuthUser } from './auth'
import { firebase } from './firebase'

export type PresenceView = 'board' | 'flow' | 'table' | 'matrix' | 'reports'

export type Presence = {
  name: string
  color: string
  photo?: string
  view: PresenceView
  // Board cursor in world units; absent when the pointer is off the board (or on another view).
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

// ~16 writes a second at most while the pointer moves (ARCHITECTURE §6).
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
    const publish = () => {
      const now = Date.now() + offset
      const here = Object.entries(all)
        .filter(([id, p]) => id !== uid && now - (p.ts ?? 0) < STALE_MS)
        .map(([id, p]) => ({ ...p, uid: id }))
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
      usePresence.setState({ peers: [], myColor: null, following: null })
      onDisconnect(node).cancel().catch(() => {})
      remove(node).catch(() => {})
    }
  }, [wid, uid, name, photo])

  useEffect(() => {
    patch(view === 'board' ? { view } : { view, x: undefined, y: undefined })
  }, [view, wid, uid])
}
