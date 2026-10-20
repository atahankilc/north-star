// The workspace canvas's camera, selection and the pieces in edit mode (D-176, D-180). The camera is kept per workspace
// for the tab's life, so leaving the workspace and coming back finds the canvas where it was. `center` is the canvas point in the middle of the screen,
// where the side nav's `+` puts new things.
import { create } from 'zustand'
import { isReducedMotion } from './motion'

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
  // The focused plane's own view (D-186): where on screen its (0, 0) is and how many screen px a plane px takes. The wheel
  // and drags move it while the plane is in focus; `planeHome` is where it was on the canvas, which it goes back to.
  planeCam: PlaneCam | null
  planeHome: PlaneCam | null
  // Cards in the focused plane (D-187): the one selected, and the one whose title is being typed.
  cardSelected: string | null
  cardEditing: string | null
}

export type PlaneCam = { ox: number; oy: number; zoom: number }

export type ScreenRect = { x: number; y: number; w: number; h: number; zoom: number }

export const useCanvasView = create<State>(() => ({ cams: {}, size: { w: 0, h: 0 }, selected: null, editing: [], confirming: null, focusSpread: false, focusArrived: false, focusLeaving: false, planeCam: null, planeHome: null, cardSelected: null, cardEditing: null }))

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

// A camera move that visibly travels (eased both ends); a newer one stops it. Reduced motion: there at once.
let moving = 0
export function glide<T extends Record<string, number>>(from: T, to: T, ms: number, apply: (v: T) => void) {
  cancelAnimationFrame(moving)
  if (isReducedMotion()) return apply(to)
  const t0 = performance.now()
  const frame = (now: number) => {
    const p = Math.min(1, (now - t0) / ms)
    const k = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
    apply(Object.fromEntries(Object.keys(to).map((key) => [key, from[key] + (to[key] - from[key]) * k])) as T)
    if (p < 1) moving = requestAnimationFrame(frame)
  }
  moving = requestAnimationFrame(frame)
}
export const stopGlide = () => cancelAnimationFrame(moving)

export type Bounds = { x: number; y: number; w: number; h: number }

// The zoom and middle that fit `b` into a w × h box with `pad` round it, never past 1 (D-186, as the board's fit, D-060).
export function fitInto(b: Bounds, w: number, h: number, pad: number) {
  const zoom = Math.max(0.1, Math.min(1, (w - 2 * pad) / Math.max(1, b.w), (h - 2 * pad) / Math.max(1, b.h)))
  return { zoom, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }
}

// Everything on the canvas in view (D-186), or its origin at zoom 1 when there's nothing.
export function fitCanvas(wid: string, pieces: Bounds[]) {
  const { size } = useCanvasView.getState()
  let to: Cam = { x: 0, y: 0, zoom: 1 }
  if (pieces.length) {
    const x0 = Math.min(...pieces.map((p) => p.x))
    const y0 = Math.min(...pieces.map((p) => p.y))
    const x1 = Math.max(...pieces.map((p) => p.x + p.w))
    const y1 = Math.max(...pieces.map((p) => p.y + p.h))
    // Room for a plane's name above it and its console under it, and the side nav on the left.
    const { zoom, cx, cy } = fitInto({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, size.w, size.h, 96)
    to = { x: -cx * zoom, y: -cy * zoom, zoom }
  }
  glide(camOf(wid), to, 420, (c) => setCam(wid, c))
}

// The focused plane's contents in view (D-186): what's in it, centred and fitted to the screen. A plane holds nothing
// yet, so this takes it back to where it was on the canvas.
export function fitPlane(content: Bounds | null) {
  const { planeCam, planeHome, size } = useCanvasView.getState()
  if (!planeCam || !planeHome) return
  let to = planeHome
  if (content) {
    const { zoom, cx, cy } = fitInto(content, size.w, size.h, 96)
    to = { ox: size.w / 2 - cx * zoom, oy: size.h / 2 - cy * zoom, zoom }
  }
  glide(planeCam, to, 420, (c) => useCanvasView.setState({ planeCam: c }))
}
