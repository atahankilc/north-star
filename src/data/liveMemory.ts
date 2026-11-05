// Writing together's channel in memory (D-374): for the unit tests and the gallery, never the app. A hub holds what
// Firestore would (the state and the packets); each transport is one tab on it. Deliveries can be held back, doubled or
// reversed, to prove the text merges whatever the order.
import type { LivePacket, LiveState, LiveTransport } from './liveText'

type Tab = {
  onState: (s: LiveState | null) => void
  onPackets: (added: LivePacket[], there: { count: number; bytes: number }) => void
  // Held deliveries (when `hold` is on).
  held: (() => void)[]
}

export function memoryHub(initial: LiveState | null = null) {
  let state: LiveState | null = initial
  const packets = new Map<string, Uint8Array>()
  const tabs = new Set<Tab>()
  let next = 0
  const there = () => ({ count: packets.size, bytes: [...packets.values()].reduce((n, u) => n + u.length, 0) })
  const opts = { hold: false, twice: false }

  const deliver = (tab: Tab, f: () => void) => (opts.hold ? tab.held.push(f) : f())

  const hub = {
    get state() {
      return state
    },
    packets,
    // Held deliveries stay queued until `release` (in order, or reversed).
    set hold(on: boolean) {
      opts.hold = on
    },
    set twice(on: boolean) {
      opts.twice = on
    },
    release(reverse = false) {
      for (const tab of tabs) {
        const fs = tab.held.splice(0)
        for (const f of reverse ? fs.reverse() : fs) f()
      }
    },
    transport(): LiveTransport {
      const tab: Tab = { onState: () => {}, onPackets: () => {}, held: [] }
      return {
        listenState(on) {
          tab.onState = on
          tabs.add(tab)
          queueMicrotask(() => on(state))
          return () => void (tab.onState = () => {})
        },
        listen(on) {
          tab.onPackets = on
          tabs.add(tab)
          const now = [...packets].map(([id, u]) => ({ id, u }))
          queueMicrotask(() => on(now, there()))
          return () => void tabs.delete(tab)
        },
        send(u) {
          const id = `e${next++}`
          packets.set(id, u)
          for (const t of tabs) {
            deliver(t, () => t.onPackets([{ id, u }], there()))
            if (opts.twice) deliver(t, () => t.onPackets([{ id, u }], there()))
          }
          return { id, done: Promise.resolve() }
        },
        async seed(s) {
          await Promise.resolve()
          if (state) return state
          state = { s, v: 0 }
          const now = state
          for (const t of tabs) deliver(t, () => t.onState(now))
          return state
        },
        async compact(fold, drop) {
          await Promise.resolve()
          state = { s: fold(state?.s ?? null), v: (state?.v ?? -1) + 1 }
          const now = state
          for (const t of tabs) deliver(t, () => t.onState(now))
          for (const id of drop) packets.delete(id)
          for (const t of tabs) deliver(t, () => t.onPackets([], there()))
        },
      }
    },
  }
  return hub
}
