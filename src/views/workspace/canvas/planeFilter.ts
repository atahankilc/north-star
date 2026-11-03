// A focused plane's filter, kept in this tab while its focus is open (D-233, D-308). What a filter is and what it keeps:
// src/model/planeFilter.ts (R8); the store holding each plane's here (canvas/heldStore.ts).
import { START, type Filter } from '../../../model/planeFilter'
import { makeHeldStore } from './heldStore'

export * from '../../../model/planeFilter'

// Filters were once kept in the browser (D-233) under `north-star:filter:`.
const held = makeHeldStore('byPlane', START as Filter, 'north-star:filter:')
export const usePlaneFilter = held.store

// A plane's filter, as set in this focus.
export const useFilter = (plane: string | null): Filter => held.use(plane)
// The same, read outside React (fit, the box round a plane's contents).
export const filterOf = (plane: string): Filter => held.get(plane)
export const setFilter = (plane: string, next: Filter) => held.set(plane, next)
// Held while the plane's dock is there (its focus); once nothing holds it, the filter goes (D-308).
export const useHoldFilter = (plane: string) => held.useHold(plane)
