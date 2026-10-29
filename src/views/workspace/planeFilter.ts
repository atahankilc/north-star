// A focused plane's filter, kept in this tab while its focus is open (D-233, D-308). What a filter is and what it keeps:
// src/model/planeFilter.ts (R8); the store holding each plane's here.
import { useEffect } from 'react'
import { create } from 'zustand'
import { START, type Filter } from '../../model/planeFilter'

export * from '../../model/planeFilter'

type State = { byPlane: Record<string, Filter> }
export const usePlaneFilter = create<State>(() => ({ byPlane: {} }))

// Filters were once kept in the browser (D-233): what's left of them goes.
try {
  for (const k of Object.keys(localStorage)) if (k.startsWith('north-star:filter:')) localStorage.removeItem(k)
} catch {
  // Private windows: nothing kept.
}

// A plane's filter, as set in this focus.
export function useFilter(plane: string | null): Filter {
  return usePlaneFilter((s) => (plane ? s.byPlane[plane] : undefined)) ?? START
}

// The same, read outside React (fit, the box round a plane's contents).
export const filterOf = (plane: string): Filter => usePlaneFilter.getState().byPlane[plane] ?? START

export function setFilter(plane: string, next: Filter) {
  usePlaneFilter.setState((s) => ({ byPlane: { ...s.byPlane, [plane]: next } }))
}

// Held while the plane's dock is there (its focus); once nothing holds it, the filter goes (D-308). Let go a moment
// later, so a remount (dev's double mount) keeps it.
const held = new Map<string, number>()
export function useHoldFilter(plane: string) {
  useEffect(() => {
    held.set(plane, (held.get(plane) ?? 0) + 1)
    return () => {
      held.set(plane, (held.get(plane) ?? 1) - 1)
      setTimeout(() => {
        if (held.get(plane)) return
        held.delete(plane)
        usePlaneFilter.setState((s) => {
          const { [plane]: _, ...rest } = s.byPlane
          return { byPlane: rest }
        })
      })
    }
  }, [plane])
}
