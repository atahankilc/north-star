// One frame for every demo (D-315, onboarding.md §6.2: "one iframe reused, preloaded after the workspace is idle").
// Loading demo.html is the costly part (a long task of 100–200 ms on the canvas's thread: the frame is same-origin, so
// it shares it). So the coach makes one frame when the page is idle (`preloadDemo`), keeps it in a hidden holder, and a
// Demo lends it into its slot with `moveBefore` (which keeps a frame's document; a plain move would load it again) from
// its layout effect, and gives it back from that effect's cleanup. React runs a commit's cleanups before its new layout
// effects, so StrictMode's mount → cleanup → mount and a slot that moves to another container (a lesson going into a
// dialog) hand it over in order. A browser without `moveBefore`, or a second Demo while it's lent: a frame of its own.
// No React here: Demo.tsx and the tests (demoPool.test.tsx) drive it.

import { useCanvasView } from '../state/canvasView'

export const DEMO_NS = 'north-star-demo'
// The frame's size until the scene says its own (onboarding.md §6.2: "960 × 600 CSS px, scaled into the card").
export const STAGE = { w: 960, h: 600 }

export type Pool = { frame: HTMLIFrameElement; loaded: boolean; lent: boolean }
type Movable = Element & { moveBefore(node: Node, child: Node | null): void }

let pool: Pool | null = null
let holder: HTMLDivElement | null = null
// Kept between lessons only while the coach wants it (a workspace, tips on): else a lent frame is dropped when given back.
let wanted = false
// What the frame's element looks like (Demo.module.css' `.frame`), set by Demo.tsx.
let frameClass = ''
export const setFrameClass = (c: string) => void (frameClass = c)
// The page the frame loads (the app's base + demo.html).
let srcBase = '/'
export const setSrcBase = (b: string) => void (srcBase = b)

export const canMove = () => typeof Element !== 'undefined' && 'moveBefore' in Element.prototype

// The frame and its hidden holder, made now (once).
function ensure(): Pool {
  if (pool) return pool
  holder = document.createElement('div')
  holder.setAttribute('aria-hidden', 'true')
  holder.inert = true
  Object.assign(holder.style, { position: 'fixed', left: '-10000px', top: '0', width: '0', height: '0', overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none' })
  const frame = document.createElement('iframe')
  frame.src = `${srcBase}demo.html#scene=canvas-fit`
  frame.title = 'demo'
  frame.tabIndex = -1
  frame.inert = true
  frame.setAttribute('aria-hidden', 'true')
  frame.width = String(STAGE.w)
  frame.height = String(STAGE.h)
  if (frameClass) frame.className = frameClass
  const p: Pool = { frame, loaded: false, lent: false }
  pool = p
  const onMsg = (e: MessageEvent) => {
    if (e.source !== frame.contentWindow || (e.data as { ns?: string })?.ns !== DEMO_NS) return
    if ((e.data as { type?: string }).type === 'ready') {
      p.loaded = true
      window.removeEventListener('message', onMsg)
    }
  }
  window.addEventListener('message', onMsg)
  holder.appendChild(frame)
  document.body.appendChild(holder)
  return p
}

type Idle = { requestIdleCallback?: (f: () => void) => number; cancelIdleCallback?: (n: number) => void }
// The camera moved this recently: not idle for this (a load mid-pan or mid-zoom is a long task in the middle of it).
const CALM_MS = 500
// The frame made when the page is next idle and the camera has been still CALM_MS (the coach, in a workspace with tips
// on). No timeout: the load never forces its way into a pan. Returns the cancel.
export function preloadDemo(): () => void {
  if (!canMove() || typeof window === 'undefined') return () => {}
  wanted = true
  if (pool) return () => {}
  const w = window as unknown as Idle
  let camAt = -Infinity
  const offCam = useCanvasView.subscribe((n, p) => {
    if (n.cams !== p.cams || n.planeCam !== p.planeCam) camAt = performance.now()
  })
  let id = 0
  let done = false
  const later = () => (id = w.requestIdleCallback ? w.requestIdleCallback(make) : window.setTimeout(make, 3000))
  const make = () => {
    if (done || !wanted || pool) return finish()
    if (performance.now() - camAt < CALM_MS) return void later()
    ensure()
    finish()
  }
  const finish = () => {
    done = true
    offCam()
  }
  later()
  return () => {
    if (!done) {
      if (w.requestIdleCallback && w.cancelIdleCallback) w.cancelIdleCallback(id)
      else clearTimeout(id)
    }
    finish()
  }
}

// No longer wanted (the coach unmounted, tips went off): the frame goes now, or when it's given back.
export function disposeDemoPool() {
  wanted = false
  if (pool && !pool.lent) drop()
}

function drop() {
  pool?.frame.remove()
  holder?.remove()
  pool = null
  holder = null
}

// Lent into `slot` (made first if a lesson came before the idle moment): the pool, or null (no `moveBefore`, already
// lent, the move refused): the Demo then has a frame of its own.
export function lend(slot: Element): Pool | null {
  if (!canMove()) return null
  const p = ensure()
  if (p.lent) return null
  try {
    ;(slot as Movable).moveBefore(p.frame, null)
  } catch {
    return null
  }
  p.lent = true
  return p
}

// Back into the holder (keeping its document). Its slot already off the page (its container removed before the cleanup
// ran), or the pool not wanted any more: the frame goes; made again at the next idle moment only while wanted.
export function giveBack(p: Pool) {
  if (p !== pool) return
  p.frame.contentWindow?.postMessage({ ns: DEMO_NS, type: 'pause' }, location.origin)
  if (wanted && p.frame.isConnected && holder?.isConnected) {
    try {
      ;(holder as unknown as Movable).moveBefore(p.frame, null)
      p.lent = false
      return
    } catch {
      // Refused: as if it had gone.
    }
  }
  drop()
  if (wanted) preloadDemo()
}

// For the tests: the pool's state, and a reset.
export const poolState = () => ({ pool, holder, wanted })
export function resetPoolForTests() {
  drop()
  wanted = false
}
