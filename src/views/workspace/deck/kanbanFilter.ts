// A kanban's filter, kept in this tab while one of its docks is open (D-256, D-308). What a filter is and which tasks
// pass: src/model/kanbanFilter.ts (R8); the store holding each kanban's here (canvas/heldStore.ts).
import { NO_FILTER, type KanbanFilter } from '../../../model/kanbanFilter'
import { makeHeldStore } from '../canvas/heldStore'

export * from '../../../model/kanbanFilter'

// Filters were once kept in the browser (D-256) under `north-star:kanban-filter:`.
const held = makeHeldStore('byPiece', NO_FILTER as KanbanFilter, 'north-star:kanban-filter:')

export const useKanbanFilter = (piece: string): KanbanFilter => held.use(piece)
export const setKanbanFilter = (piece: string, f: KanbanFilter) => held.set(piece, f)
// Held while one of its docks is there; once none is, the filter goes (D-308).
export const useHoldKanbanFilter = (piece: string) => held.useHold(piece)
