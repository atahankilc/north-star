// The workspace canvas's camera and selection (D-176). The camera is kept per workspace for the tab's life, so leaving
// for the board and coming back finds the canvas where it was. `center` is the canvas point in the middle of the screen,
// where the side nav's `+` puts new things.
import { create } from 'zustand'

export type Cam = { x: number; y: number; zoom: number }

type State = {
  cams: Record<string, Cam>
  // Where the canvas sits on screen, set by the canvas while it's shown.
  size: { w: number; h: number }
  selected: string | null
}

export const useCanvasView = create<State>(() => ({ cams: {}, size: { w: 0, h: 0 }, selected: null }))

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
