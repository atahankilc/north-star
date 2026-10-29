// A kanban's filter, kept in this tab while one of its docks is open (D-256, D-308). What a filter is and which tasks
// pass: src/model/kanbanFilter.ts (R8); the store holding each kanban's here.
import { useEffect } from 'react'
import { create } from 'zustand'
import { NO_FILTER, type KanbanFilter } from '../../model/kanbanFilter'

export * from '../../model/kanbanFilter'

const useStore = create<{ byPiece: Record<string, KanbanFilter> }>(() => ({ byPiece: {} }))

// Filters were once kept in the browser (D-256): what's left of them goes.
try {
  for (const k of Object.keys(localStorage)) if (k.startsWith('north-star:kanban-filter:')) localStorage.removeItem(k)
} catch {
  // Private windows: nothing kept.
}

export function useKanbanFilter(piece: string): KanbanFilter {
  return useStore((s) => s.byPiece[piece]) ?? NO_FILTER
}

export function setKanbanFilter(piece: string, f: KanbanFilter) {
  useStore.setState((s) => ({ byPiece: { ...s.byPiece, [piece]: f } }))
}

// Held while one of its docks is there; once none is, the filter goes (D-308). Let go a moment later, so a remount
// (dev's double mount, one dock for another) keeps it.
const held = new Map<string, number>()
export function useHoldKanbanFilter(piece: string) {
  useEffect(() => {
    held.set(piece, (held.get(piece) ?? 0) + 1)
    return () => {
      held.set(piece, (held.get(piece) ?? 1) - 1)
      setTimeout(() => {
        if (held.get(piece)) return
        held.delete(piece)
        useStore.setState((s) => {
          const { [piece]: _, ...rest } = s.byPiece
          return { byPiece: rest }
        })
      })
    }
  }, [piece])
}
