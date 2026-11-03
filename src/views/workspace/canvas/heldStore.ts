// A passing look kept per piece in this tab while one of its docks is open (D-308; D-361: a plane's filter and a deck's
// had each written this): `use`/`get` read it (else `fallback`), `set` changes it, `useHold` holds it while a dock is
// there and lets it go once none is, a moment later, so a remount (dev's double mount, one dock for another) keeps it.
// Never kept in the browser: what an older version kept under `oldPrefix` is taken away once.
import { useEffect } from 'react'
import { create } from 'zustand'

export function makeHeldStore<K extends string, T>(key: K, fallback: T, oldPrefix: string) {
  type State = Record<K, Record<string, T>>
  const store = create<State>(() => ({ [key]: {} }) as State)
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(oldPrefix)) localStorage.removeItem(k)
  } catch {
    // Private windows: nothing kept.
  }
  const held = new Map<string, number>()
  const drop = (id: string) =>
    store.setState((s) => {
      const { [id]: _, ...rest } = s[key]
      return { [key]: rest } as Partial<State>
    })
  return {
    store,
    use: (id: string | null): T => store((s) => (id ? s[key][id] : undefined)) ?? fallback,
    get: (id: string): T => store.getState()[key][id] ?? fallback,
    set: (id: string, next: T) => store.setState((s) => ({ [key]: { ...s[key], [id]: next } }) as Partial<State>),
    useHold: (id: string) =>
      useEffect(() => {
        held.set(id, (held.get(id) ?? 0) + 1)
        return () => {
          held.set(id, (held.get(id) ?? 1) - 1)
          setTimeout(() => {
            if (held.get(id)) return
            held.delete(id)
            drop(id)
          })
        }
      }, [id]),
  }
}
