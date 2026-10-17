// Local, per-tab UI state for the board. Persistent data lives in Firestore (src/data/).
import { create } from 'zustand'

type Vec2 = [number, number]

type CanvasState = {
  selectedId: string | null
  // Shift+drag from a card: source id and the pointer's world position.
  linkFrom: string | null
  linkPointer: Vec2 | null
  // Live positions of cards being dragged by this user, ahead of Firestore.
  dragging: Record<string, Vec2>
  // Set by the board once mounted: where the camera is looking.
  viewCenter: () => Vec2
  // Set by the board once mounted: move the camera to look at a point.
  focusOn: (at: Vec2) => void
  // Set by the board once mounted: glide the camera to a point (jump list, D-050). Instant under reduced motion.
  flyTo: (at: Vec2) => void
  // The text label being typed into on the board, if any.
  editingLabel: string | null

  select: (id: string | null) => void
  startLink: (id: string, at: Vec2) => void
  moveLink: (at: Vec2) => void
  endLink: () => void
  setDragging: (id: string, at: Vec2 | null) => void
  setViewCenter: (fn: () => Vec2) => void
  setFocusOn: (fn: (at: Vec2) => void) => void
  setFlyTo: (fn: (at: Vec2) => void) => void
  setEditingLabel: (id: string | null) => void
}

export const useCanvas = create<CanvasState>((set) => ({
  selectedId: null,
  linkFrom: null,
  linkPointer: null,
  dragging: {},
  viewCenter: () => [0, 0],
  focusOn: () => {},
  flyTo: () => {},
  editingLabel: null,

  select: (id) => set({ selectedId: id }),
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
  setViewCenter: (fn) => set({ viewCenter: fn }),
  setFocusOn: (fn) => set({ focusOn: fn }),
  setFlyTo: (fn) => set({ flyTo: fn }),
  setEditingLabel: (id) => set({ editingLabel: id }),
}))

// Dev-only handle for inspecting state from the console or automation.
if (import.meta.env.DEV) {
  ;(window as unknown as { __canvas: typeof useCanvas }).__canvas = useCanvas
}
