// Local, per-tab UI state for the board. Persistent data lives in Firestore (src/data/).
import { create } from 'zustand'

type Vec2 = [number, number]

type CanvasState = {
  selectedId: string | null
  // Everything selected (D-108): cards and text labels; `selectedId` is the last one picked. One item = the usual panel.
  selection: string[]
  // A selected link, edited from the bar at its middle (D-108). Selecting anything else clears it, and the other way round.
  edgeId: string | null
  // The card under the pointer: links that don't touch it dim (D-108).
  hoverId: string | null
  // Shift+drag from a card: source id and the pointer's world position.
  linkFrom: string | null
  linkPointer: Vec2 | null
  // Live positions of cards being dragged by this user, ahead of Firestore.
  dragging: Record<string, Vec2>
  // The card under a held-down pointer: a competitor keeps its features stacked until the press ends (D-058).
  pressing: string | null
  // Set by the board once mounted: where the camera is looking.
  viewCenter: () => Vec2
  // Set by the board once mounted: move the camera to look at a point.
  focusOn: (at: Vec2) => void
  // Set by the board once mounted: glide the camera to a point (jump list, D-050). Instant under reduced motion.
  flyTo: (at: Vec2) => void
  // Set by the board once mounted: glide so the box [x0, y0, x1, y1] fills the view, within the zoom limits (D-096).
  flyToFit: (box: [number, number, number, number]) => void
  // The text label being typed into on the board, if any.
  editingLabel: string | null
  // Set by the board while mounted: the whole board as a PNG (D-080).
  snapshot: (() => Promise<Blob>) | null

  select: (id: string | null) => void
  // Shift+click: in or out of the selection.
  toggleSelect: (id: string) => void
  // A box drawn round things (alt+drag); `add` keeps what was selected.
  selectMany: (ids: string[], add?: boolean) => void
  selectEdge: (id: string | null) => void
  setHover: (id: string | null) => void
  startLink: (id: string, at: Vec2) => void
  moveLink: (at: Vec2) => void
  endLink: () => void
  setDragging: (id: string, at: Vec2 | null) => void
  setPressing: (id: string | null) => void
  setViewCenter: (fn: () => Vec2) => void
  setFocusOn: (fn: (at: Vec2) => void) => void
  setFlyTo: (fn: (at: Vec2) => void) => void
  setFlyToFit: (fn: (box: [number, number, number, number]) => void) => void
  setEditingLabel: (id: string | null) => void
  setSnapshot: (fn: (() => Promise<Blob>) | null) => void
}

export const useCanvas = create<CanvasState>((set) => ({
  selectedId: null,
  selection: [],
  edgeId: null,
  hoverId: null,
  linkFrom: null,
  linkPointer: null,
  dragging: {},
  pressing: null,
  viewCenter: () => [0, 0],
  focusOn: () => {},
  flyTo: () => {},
  flyToFit: () => {},
  editingLabel: null,
  snapshot: null,

  select: (id) => set({ selectedId: id, selection: id ? [id] : [], edgeId: null }),
  toggleSelect: (id) =>
    set((s) => {
      const selection = s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id]
      return { selection, selectedId: selection[selection.length - 1] ?? null, edgeId: null }
    }),
  selectMany: (ids, add) =>
    set((s) => {
      const selection = add ? [...new Set([...s.selection, ...ids])] : ids
      return { selection, selectedId: selection[selection.length - 1] ?? null, edgeId: null }
    }),
  selectEdge: (id) => set(id ? { edgeId: id, selectedId: null, selection: [] } : { edgeId: null }),
  setHover: (id) => set({ hoverId: id }),
  startLink: (id, at) => set({ linkFrom: id, linkPointer: at }),
  moveLink: (at) => set({ linkPointer: at }),
  endLink: () => set({ linkFrom: null, linkPointer: null }),
  setDragging: (id, at) =>
    set((s) => {
      const dragging = { ...s.dragging }
      if (at) dragging[id] = at
      else delete dragging[id]
      return { dragging }
    }),
  setPressing: (id) => set({ pressing: id }),
  setViewCenter: (fn) => set({ viewCenter: fn }),
  setFocusOn: (fn) => set({ focusOn: fn }),
  setFlyTo: (fn) => set({ flyTo: fn }),
  setFlyToFit: (fn) => set({ flyToFit: fn }),
  setEditingLabel: (id) => set({ editingLabel: id }),
  setSnapshot: (fn) => set({ snapshot: fn }),
}))

// Dev-only handle for inspecting state from the console or automation.
if (import.meta.env.DEV) {
  ;(window as unknown as { __canvas: typeof useCanvas }).__canvas = useCanvas
}
