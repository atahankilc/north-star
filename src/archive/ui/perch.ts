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
// A panel wider than the box pushes it off the box's end (D-121): it falls (`fall`), lands with a bounce on the floor
// beside the box (`crash`: squashed, dizzy, then cross), and from there peeks around the box's left side instead of over
// its top, half hidden behind it, now and then leaning out. Room on the box again (or the box growing tall), it jumps
// back up onto the edge (`climb`, then `free`).
// The orb keeps its corner in CSS; this only adds a `translate` and a `clip-path` that hides it behind the box.
import { useEffect, type RefObject } from 'react'
import { useChat } from '../ai/chat'
import { isReducedMotion } from '../state/motion'

// How much of the orb sinks into the edge: sitting on the small box, peeking over the tall one, stretching up to look.
export const SINK = { perched: 0.14, peeking: 0.44, curious: 0.2 }
// On the floor, how much of it is hidden behind the box's side: peeking, and leaning out to look.
const SIDE = { peeking: 0.3, curious: 0.1 }
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
// Falling off the box: gravity (px/s²), how much of its speed a bounce keeps, and below what speed it stays down.
const FALL = { g: 2800, bounce: 0.3, rest: 240 }
// The jump back up: how long, and how high over the straight line (in orb sizes).
const CLIMB = { ms: 520, height: 0.7 }
// On the floor, back up once the box has this much room (px) past what it needs to stand on its end.
const CLIMB_ROOM = 6

export type PerchCue = 'startled' | 'shaken' | 'composed' | 'bumped' | 'free' | 'fall' | 'crash' | 'climb'

// `onFloor`: whether it now sits on the floor beside the box, peeking around its side (the face turns that way, AiOrb).
export function usePerch(
  orb: RefObject<HTMLElement | null>,
  open: boolean,
  tall: boolean,
  onCue: (cue: PerchCue) => void,
  onFloor: (on: boolean) => void,
) {
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
    // Up and down, off the edge (D-121): on the edge, falling, on the floor, jumping back. `y` is the translate while
    // off the edge (0 is the floor: its corner's own height), `vy` its speed; `climb` where and when the jump began.
    type Drop = 'edge' | 'falling' | 'floor' | 'climbing'
    let drop: Drop = 'edge'
    let y = 0
    let vy = 0
    let crashed = false
    let climb = { x: 0, y: 0, at: 0 }
    let floored = false
    const floor = (on: boolean) => {
      if (on !== floored) onFloor((floored = on))
    }
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
      // Off the edge it is hidden behind these instead (the box and the side panel), screen px.
      let behind: DOMRect[] | null = null
      const spring = (goal: number, [k, c]: readonly [number, number]) => {
        vx += (k * (goal - x) - c * vx) * dt
        x += vx * dt
      }
      if (win && (drop === 'edge' || drop === 'climbing' || open)) {
        const w = win.getBoundingClientRect()
        const edgeV = Number.isNaN(lastEdge) || !dt ? 0 : (w.left - lastEdge) / dt
        lastEdge = w.left
        const lo = w.left + INSET
        const hi = w.right - INSET - size
        const middle = w.left + (w.width - size) / 2

        // Where it wants to be along the edge, and how it gets there.
        const resizing = document.documentElement.hasAttribute('data-ai-resizing')
        if (tall && !calm && !resizing && drop === 'edge') {
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
        } else if (mode !== 'follow') {
          to('follow', now)
          peek = null
        }
        // Curious now and then: off along the edge to peek over it (tall), or out from behind the box (on the floor).
        const peeks = (tall && drop === 'edge' && !calm && !resizing) || (drop === 'floor' && !calm)
        if (peeks && mode === 'follow' && !peek && now > peekAt && !useChat.getState().busy) {
          peek = { until: now + PEEK.stay, at: (Math.random() * 2 - 1) * PEEK.reach * (w.width - size) }
        }
        if (peek && (now > peek.until || !peeks)) {
          peek = null
          peekAt = now + PEEK.every[0] + Math.random() * (PEEK.every[1] - PEEK.every[0])
        }
        // On the small box a side panel takes its spot: it goes left of the panel, hanging off the box's end if it must.
        const panel = !tall ? document.querySelector('[data-side-panel]')?.getBoundingClientRect() : undefined
        const aside = panel ? Math.min(hi, panel.left - size - INSET / 2) : null
        const goal = aside ?? (!tall ? hi : middle + (peek?.at ?? 0))
        const isShoved = aside !== null && aside < hi
        if (lifted && shoved !== null && isShoved !== shoved && drop === 'edge') onCue(isShoved ? 'bumped' : 'free')
        shoved = isShoved
        // Where it peeks from on the floor: just left of the box, partly behind it.
        const sideX = w.left - size * (1 - (peek ? SIDE.curious : SIDE.peeking))
        // Room to stand on the box's end again (or the box is tall now, with no panel over it).
        const room = tall || aside === null || aside + size / 2 >= w.left + CLIMB_ROOM

        const wantSink = (tall ? (peek ? SINK.curious : SINK.peeking) : SINK.perched) * size
        sink = sink < 0 || calm ? wantSink : sink + (wantSink - sink) * (1 - Math.exp(-dt * SINK_RATE))
        // Sitting on the edge: the translate that puts it there.
        const edgeY = w.top - size + sink - top
        const jump = () => {
          floor(false)
          if (calm) {
            drop = 'edge'
            x = goal
            vx = 0
            return
          }
          drop = 'climbing'
          climb = { x, y, at: now }
          onCue('climb')
        }

        if (drop === 'edge') {
          // Never below its corner: the box picks it up on the way up and sets it down on the way down.
          ny = Math.min(0, edgeY)
          if (ny < 0) {
            if (Number.isNaN(x) && !room) {
              // The box comes up with a panel already over its end: it stays on the floor and peeks around its side.
              drop = 'floor'
              x = left
              vx = 0
              y = 0
              lifted = true
              floor(true)
            } else {
              if (Number.isNaN(x) || calm) {
                x = Number.isNaN(x) && !tall ? left : goal
                vx = 0
              }
              if (!calm) {
                const [k, c] = mode === 'dazed' || mode === 'composing' ? [0, 12] : SPRING[mode === 'follow' ? (peek ? 'wander' : 'follow') : mode]
                spring(goal, [k, c])
              }
              // It stays on the edge: swept to an end, it's carried along there.
              const from = Math.min(lo, goal)
              if (x < from || x > hi) {
                x = Math.min(hi, Math.max(from, x))
                vx = edgeV
              }
              // Pushed so far that its middle is past the box's end: it goes over.
              if (!tall && x + size / 2 < w.left) {
                y = ny
                vy = 0
                crashed = false
                if (calm) {
                  drop = 'floor'
                  y = 0
                  floor(true)
                } else {
                  drop = 'falling'
                  onCue('fall')
                }
              }
            }
          } else {
            x = NaN
            vx = 0
          }
        }
        if (drop === 'falling') {
          // Down to the floor with a bounce or two, drifting to where it will peek from.
          spring(sideX, SPRING.back)
          vy += FALL.g * dt
          y += vy * dt
          if (y >= 0) {
            y = 0
            if (!crashed) {
              crashed = true
              onCue('crash')
              floor(true)
            }
            if (vy > FALL.rest) vy *= -FALL.bounce
            else {
              vy = 0
              drop = 'floor'
            }
          }
          if (tall) jump()
        } else if (drop === 'floor') {
          if (open && room) jump()
          else {
            if (calm) x = sideX
            else spring(sideX, peek ? SPRING.wander : SPRING.follow)
            y = 0
          }
        }
        if (drop === 'climbing') {
          // A hop up onto the edge, landing where it wants to sit (both may move under it meanwhile).
          const t = Math.min(1, (now - climb.at) / CLIMB.ms)
          const e = t * t * (3 - 2 * t)
          x = climb.x + (goal - climb.x) * e
          y = climb.y + (Math.min(0, edgeY) - climb.y) * t - CLIMB.height * size * 4 * t * (1 - t)
          vx = 0
          if (t >= 1) {
            drop = 'edge'
            if (!tall) onCue('free')
          }
        }
        if (drop !== 'edge') {
          ny = y
          behind = panel ? [w, new DOMRect(panel.left, panel.top, panel.width, Math.min(panel.bottom, w.top) - panel.top)] : [w]
        }
        if (!Number.isNaN(x)) nx = x - left
        clip = Math.max(0, top + ny + size - w.top)
        if (ny < -2 && !lifted && !tall) {
          lifted = true
          onCue('startled')
        }
      } else if (drop !== 'edge' && (win || Number.isNaN(x) || Math.abs(x - left) > 0.5 || Math.abs(vx) > 5)) {
        // The chat closing while it's on the floor: it walks back to its corner, already at its height, and stays off the
        // box while it goes down.
        if (Number.isNaN(x) || calm) x = left
        else spring(left, SPRING.follow)
        nx = x - left
        floor(false)
      } else {
        sink = -1
        x = NaN
        lastEdge = NaN
        drop = 'edge'
        floor(false)
      }
      if (nx !== tx || ny !== ty) {
        tx = nx
        ty = ny
        el.style.translate = tx || ty ? `${tx}px ${ty}px` : ''
      }
      if (behind) {
        // Cut out what's in front of it, in its own unscaled px around its new spot. Negative insets leave room for what it
        // emits around itself (hearts, `?`, `!`); evenodd turns each rectangle inside the outer one into a hole.
        const ox = left + nx
        const oy = top + ny
        const o = (el.offsetWidth || size) * 0.6
        const span = (el.offsetWidth || size) + o
        const lx = (v: number) => Math.min(span, Math.max(-o, (v - ox) / scale))
        const ly = (v: number) => Math.min(span, Math.max(-o, (v - oy) / scale))
        const holes = behind
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => `M${lx(r.left)} ${ly(r.top)}H${lx(r.right)}V${ly(r.bottom)}H${lx(r.left)}Z`)
        el.style.clipPath = `path(evenodd, 'M${-o} ${-o}H${span}V${span}H${-o}Z${holes.join('')}')`
      } else {
        // Negative insets leave room for what it emits around itself (hearts, `?`, `!`).
        el.style.clipPath = clip > 0 ? `inset(-60% -60% ${clip / scale}px -60%)` : ''
      }
      // Done once it's back in its corner with the box gone.
      if (!open && !win && !tx && !ty && drop === 'edge') return
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [orb, open, tall, onCue, onFloor])
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
