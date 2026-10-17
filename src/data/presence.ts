// Presence and live cursors (Phase 3, D-016, D-065): ephemeral state in RTDB at presence/{wid}/{uid}.
// Each tab writes its whole node (small), so if another tab of the same user disconnects and removes it,
// the next write puts it back. onDisconnect() removes it when the tab goes away.
import { onDisconnect, onValue, ref, remove, serverTimestamp, set, type DatabaseReference } from 'firebase/database'
import { useEffect } from 'react'
import { create } from 'zustand'
import { accents } from '../styles/tokens'
import type { AuthUser } from './auth'
import { firebase } from './firebase'

export type PresenceView = 'board' | 'flow' | 'table' | 'matrix'

export type Presence = {
  name: string
  color: string
  photo?: string
  view: PresenceView
  // Board cursor in world units; absent when the pointer is off the board (or on another view).
  x?: number
  y?: number
  // The item they have selected.
  sel?: string
  ts: number
}

export type Peer = Presence & { uid: string }

// ~16 writes a second at most while the pointer moves (ARCHITECTURE §6).
const WRITE_EVERY_MS = 60
// A heartbeat keeps `ts` fresh; anyone silent for longer than STALE_MS is hidden (a crashed tab whose
// onDisconnect hasn't fired yet).
const HEARTBEAT_MS = 20_000
const STALE_MS = 60_000

// One colour per person, stable across sessions: the accent palette (DESIGN.md §3).
export function presenceColor(uid: string): string {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0
  return accents[Math.abs(h) % accents.length]
}

type PresenceState = {
  // Everyone else in this workspace right now (never yourself, not even your other tabs).
  peers: Peer[]
}

export const usePresence = create<PresenceState>(() => ({ peers: [] }))

// This tab's own node: what we last wrote, and where to write it.
let mine: { node: DatabaseReference; data: Omit<Presence, 'ts'> } | null = null
let lastWrite = 0
let pending: number | null = null

function flush() {
  pending = null
  if (!mine) return
  lastWrite = performance.now()
  // Drop undefined fields: RTDB refuses them.
  const data = Object.fromEntries(Object.entries(mine.data).filter(([, v]) => v !== undefined))
  set(mine.node, { ...data, ts: serverTimestamp() }).catch(() => {})
}

function schedule() {
  if (!mine || pending !== null) return
  const wait = Math.max(0, WRITE_EVERY_MS - (performance.now() - lastWrite))
  pending = window.setTimeout(flush, wait)
}

function patch(p: Partial<Omit<Presence, 'ts'>>) {
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

export function setPresenceSelection(id: string | null) {
  patch({ sel: id ?? undefined })
}

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
    mine = { node, data: { name: name.slice(0, 80), color: presenceColor(uid), photo, view: 'board' } }

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
      usePresence.setState({
        peers: Object.entries(all)
          .filter(([id, p]) => id !== uid && now - (p.ts ?? 0) < STALE_MS)
          .map(([id, p]) => ({ ...p, uid: id }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      })
    }
    const offPeers = onValue(
      ref(rtdb, `presence/${wid}`),
      (snap) => {
        all = (snap.val() as Record<string, Presence> | null) ?? {}
        publish()
      },
      () => usePresence.setState({ peers: [] }),
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
      usePresence.setState({ peers: [] })
      onDisconnect(node).cancel().catch(() => {})
      remove(node).catch(() => {})
    }
  }, [wid, uid, name, photo])

  useEffect(() => {
    patch(view === 'board' ? { view } : { view, x: undefined, y: undefined })
  }, [view, wid, uid])
}
