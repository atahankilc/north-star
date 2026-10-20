// The workspace canvas's camera, selection and the pieces in edit mode (D-176, D-180). The camera is kept per workspace
// for the tab's life, so leaving the workspace and coming back finds the canvas where it was. `center` is the canvas point in the middle of the screen,
// where the side nav's `+` puts new things.
import { create } from 'zustand'

export type Cam = { x: number; y: number; zoom: number }

type State = {
  cams: Record<string, Cam>
  // Where the canvas sits on screen, set by the canvas while it's shown.
  size: { w: number; h: number }
  selected: string | null
  // Planes in edit mode (D-180): only these move, resize and take a new name; edit is switched off by the same button.
  editing: string[]
  // The plane whose delete is being confirmed (D-182).
  confirming: string | null
  // The focus transition (D-184, D-185): spread in from the plane (the console's `[focus]`, not a reload), arrived (its
  // console shows), drawing back out.
  focusSpread: boolean
  focusArrived: boolean
  focusLeaving: boolean
}

export type ScreenRect = { x: number; y: number; w: number; h: number; zoom: number }

export const useCanvasView = create<State>(() => ({ cams: {}, size: { w: 0, h: 0 }, selected: null, editing: [], confirming: null, focusSpread: false, focusArrived: false, focusLeaving: false }))

export function setEditing(id: string, on: boolean) {
  useCanvasView.setState((s) => ({
    editing: on ? [...new Set([...s.editing, id])] : s.editing.filter((e) => e !== id),
    // Editing selects it, so Delete takes it away; leaving edit lets go.
    selected: on ? id : s.selected === id ? null : s.selected,
  }))
}

// A new canvas puts its origin in the middle of the screen, at zoom 1.
export const camOf = (wid: string): Cam => useCanvasView.getState().cams[wid] ?? { x: 0, y: 0, zoom: 1 }

export function setCam(wid: string, cam: Cam) {
  useCanvasView.setState((s) => ({ cams: { ...s.cams, [wid]: cam } }))
}

// The canvas point under the middle of the screen. The camera's x/y is that point's offset from the screen's middle.
export function canvasCenter(wid: string): [number, number] {
  const { x, y, zoom } = camOf(wid)
  return [-x / zoom, -y / zoom]
}
