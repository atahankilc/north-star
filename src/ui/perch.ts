// Where the orb sits while the chat is open (D-095): perched on the top edge of the chat's box, a little sunk into it;
// when the box is tall, sunk to half its height behind it, so only the top of its head and its eyes show over the edge.
// It follows the box's edge every frame, so it rides along whatever moves the box: rising from below (it waits in its
// corner until the edge reaches it, then is lifted: startled), growing tall (it drops behind the edge), going down on
// close (it's set down in its corner again).
// Along the edge it is a little body on a spring: near the small box's right end; in the middle of the tall one, from
// where now and then it wanders off along the edge and stretches up to peek, then comes back. When the column crosses
// the screen to a preview or report (D-094) it can't keep up: it slides to the trailing end, is rattled (`shaken`),
// sits dazed a moment, pulls itself together (`composed`) and walks back to the middle. On the small box, a side panel
// coming down over its spot knocks it aside (`bumped`), to the left of the panel, as it is when the chat is closed; the
// panel going lets it back (`free`).
// The orb keeps its corner in CSS; this only adds a `translate` and a `clip-path` that hides it below the box's edge.
import { useEffect, type RefObject } from 'react'
import { useChat } from '../ai/chat'
import { isReducedMotion } from '../state/motion'

// How much of the orb sinks into the edge: sitting on the small box, peeking over the tall one, stretching up to look.
export const SINK = { perched: 0.14, peeking: 0.44, curious: 0.2 }
const SINK_RATE = 5
const INSET = 16
// Springs along the edge (stiffness, damping): following, slow enough to sway a little; wandering to peek; walking back
// after a fright; and nearly nothing while the column is swept away under it.
const SPRING = { follow: [90, 10], wander: [22, 8], back: [30, 11], swept: [2, 0.6] } as const
// The column moving faster than this (px/s) sweeps the orb along; slower than `still` for `settle` ms, it has stopped.
const SWEEP = { fast: 900, still: 60, settle: 120 }
const DAZED_MS = 1000
const COMPOSE_MS = 450
const PEEK = { every: [7000, 14000], stay: 2600, reach: 0.35 }

export type PerchCue = 'startled' | 'shaken' | 'composed' | 'bumped' | 'free'

export function usePerch(orb: RefObject<HTMLElement | null>, open: boolean, tall: boolean, onCue: (cue: PerchCue) => void) {
  useEffect(() => {
    const el = orb.current
    if (!el) return
    // Carry on from where the last run left it (opening, closing and growing restart this effect mid-move).
    const [px, py] = el.style.translate.split(' ').map((v) => parseFloat(v) || 0)
    let tx = px ?? 0
    let ty = py ?? 0
    let sink = -1
    let lifted = false
    // Along the edge, in screen px: where the orb's left side is, and how fast it moves.
    let x = NaN
    let vx = 0
    let lastEdge = NaN
    type Mode = 'follow' | 'swept' | 'dazed' | 'composing' | 'back'
    let mode: Mode = 'follow'
    let modeAt = 0
    let stillSince = 0
    let peek: { until: number; at: number } | null = null
    let peekAt = performance.now() + PEEK.every[0]
    let shoved: boolean | null = null
    let last = performance.now()
    let raf = 0
    const to = (m: Mode, now: number) => {
      mode = m
      modeAt = now
    }
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const win = document.querySelector<HTMLElement>('[data-ai-window]')
      const box = el.getBoundingClientRect()
      // As drawn, scaled up on the tall chat or not (AiChat.module.css); the clip below is in its own, unscaled px.
      const size = box.width
      const scale = size / (el.offsetWidth || size)
      // Its corner: where it is without our translate.
      const left = box.left - tx
      const top = box.top - ty
      const calm = isReducedMotion()
      let nx = 0
      let ny = 0
      let clip = 0
      if (win) {
        const w = win.getBoundingClientRect()
        const edgeV = Number.isNaN(lastEdge) || !dt ? 0 : (w.left - lastEdge) / dt
        lastEdge = w.left
        const lo = w.left + INSET
        const hi = w.right - INSET - size
        const middle = w.left + (w.width - size) / 2

        // Where it wants to be along the edge, and how it gets there.
        const resizing = document.documentElement.hasAttribute('data-ai-resizing')
        if (tall && !calm && !resizing) {
          if (mode !== 'swept' && Math.abs(edgeV) > SWEEP.fast) {
            to('swept', now)
            peek = null
          } else if (mode === 'swept') {
            if (Math.abs(edgeV) > SWEEP.still) stillSince = now
            else if (now - stillSince > SWEEP.settle) {
              to('dazed', now)
              onCue('shaken')
            }
          } else if (mode === 'dazed' && now - modeAt > DAZED_MS) {
            to('composing', now)
            onCue('composed')
          } else if (mode === 'composing' && now - modeAt > COMPOSE_MS) to('back', now)
          else if (mode === 'back' && Math.abs(x - middle) < 2 && Math.abs(vx) < 5) to('follow', now)
          // Curious now and then: off along the edge to peek, while nothing else is going on.
          if (mode === 'follow' && !peek && now > peekAt && !useChat.getState().busy) {
            peek = { until: now + PEEK.stay, at: (Math.random() * 2 - 1) * PEEK.reach * (w.width - size) }
          }
          if (peek && now > peek.until) {
            peek = null
            peekAt = now + PEEK.every[0] + Math.random() * (PEEK.every[1] - PEEK.every[0])
          }
        } else if (mode !== 'follow') {
          to('follow', now)
          peek = null
        }
        // On the small box a side panel takes its spot: it goes left of the panel, hanging off the box's end if it must.
        const panel = !tall ? document.querySelector('[data-side-panel]')?.getBoundingClientRect() : undefined
        const aside = panel ? Math.min(hi, panel.left - size - INSET / 2) : null
        const goal = aside ?? (!tall ? hi : middle + (peek?.at ?? 0))
        const isShoved = aside !== null && aside < hi
        if (lifted && shoved !== null && isShoved !== shoved) onCue(isShoved ? 'bumped' : 'free')
        shoved = isShoved

        const wantSink = (tall ? (peek ? SINK.curious : SINK.peeking) : SINK.perched) * size
        sink = sink < 0 || calm ? wantSink : sink + (wantSink - sink) * (1 - Math.exp(-dt * SINK_RATE))
        // Never below its corner: the box picks it up on the way up and sets it down on the way down.
        ny = Math.min(0, w.top - size + sink - top)
        if (ny < 0) {
          if (Number.isNaN(x) || calm) {
            x = Number.isNaN(x) && !tall ? left : goal
            vx = 0
          }
          if (!calm) {
            const [k, c] = mode === 'dazed' || mode === 'composing' ? [0, 12] : SPRING[mode === 'follow' ? (peek ? 'wander' : 'follow') : mode]
            vx += (k * (goal - x) - c * vx) * dt
            x += vx * dt
          }
          // It stays on the edge: swept to an end, it's carried along there.
          const from = Math.min(lo, goal)
          if (x < from || x > hi) {
            x = Math.min(hi, Math.max(from, x))
            vx = edgeV
          }
          nx = x - left
        } else {
          x = NaN
          vx = 0
        }
        clip = Math.max(0, top + ny + size - w.top)
        if (ny < -2 && !lifted && !tall) {
          lifted = true
          onCue('startled')
        }
      } else {
        sink = -1
        x = NaN
        lastEdge = NaN
      }
      if (nx !== tx || ny !== ty) {
        tx = nx
        ty = ny
        el.style.translate = tx || ty ? `${tx}px ${ty}px` : ''
      }
      // Negative insets leave room for what it emits around itself (hearts, `?`, `!`).
      el.style.clipPath = clip > 0 ? `inset(-60% -60% ${clip / scale}px -60%)` : ''
      // Done once it's back in its corner with the box gone.
      if (!open && !win && !tx && !ty) return
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [orb, open, tall, onCue])
}

// Moves a fixed element from where it is to where `change` puts it by animating its box (top, left, width, height), not a
// transform, so a box that grows doesn't stretch its text. The element's CSS takes over again at the end.
// `from`: where it was, if it has already moved (its content changed in the same render as what triggers this).
export function morph(el: HTMLElement | null, change: () => void, duration: number, easing: string, from?: DOMRect | null) {
  if (!el || isReducedMotion()) return change()
  const a = from ?? el.getBoundingClientRect()
  change()
  const b = el.getBoundingClientRect()
  if (Math.abs(a.top - b.top) + Math.abs(a.left - b.left) + Math.abs(a.width - b.width) + Math.abs(a.height - b.height) < 1) return
  const box = (r: DOMRect) => ({ top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px`, right: 'auto', bottom: 'auto' })
  el.animate([box(a), box(b)], { duration, easing })
}
