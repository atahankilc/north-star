// The assistant's face (D-073, D-078): a slowly turning sphere of ASCII dots with two eyes. Its own 2D canvas, not the
// backdrop's ASCII pass. The eyes are solid rounded squares like Grok Bot's (no pupils, no shine), and expressions come
// from their shape (^ arcs, hearts, sparkles, spirals, > <, lids) plus a small mouth; a changing eye or mouth pops
// small and back. The face sits on the sphere, so it slides and flattens as it looks aside.
// - Under the pointer it has a mood, a new one every few seconds: laughing, angry, shy, in love, starry-eyed, suspicious.
// - Left alone it does things now and then, like the Las Vegas Sphere's face: watches cars race past, glances around,
//   winks, rolls its eyes, hums, gets dizzy, falls in love, sneezes, gets bored, is surprised; still for a long time, it
//   falls asleep (and startles awake when you move).
// - Open, it's curious: tilts its head, one eye bigger, glances down over the chat, a `?` now and then. Waiting for the answer,
//   the sphere spins faster with a cyan shimmer and the eyes narrow in thought; while the answer streams in it yaps
//   (chattering mouth, bouncing); after talking it is tired for a few seconds. Closing the chat makes it sad (a tear)
//   or play dead (X eyes, tongue out, tipped over, not spinning), and then it pulls itself together. Opening, it heaves
//   its window up from below (D-081): eyes squeezed, a strain.
// - Cues from outside (`cue`): a side panel shoving it aside bumps it; the panel closing frees it.
// Under reduced motion it holds still and is drawn once per change.
import { useEffect, useRef } from 'react'
import { useMotion } from '../state/motion'
import { useTheme } from '../state/theme'

export type OrbMood = 'idle' | 'hover' | 'open' | 'thinking' | 'talking'
// Something that happened to it; a new `n` plays `kind` once.
export type OrbCue = { kind: 'bumped' | 'free'; n: number }

// Light glyphs only: heavy ones (# % @) made the sphere loud enough to drown out the face.
const GLYPHS = ' .·:-=+*'
const FPS = 30
const TILT = 0.38
// The canvas is larger than the orb so floating z's, notes and hearts have room around it.
const BLEED = 1.36

// Evenly spread points on a unit sphere (Fibonacci lattice).
function lattice(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    const a = i * Math.PI * (3 - Math.sqrt(5))
    return [Math.cos(a) * r, y, Math.sin(a) * r] as const
  })
}

type Colors = { bg: string; strong: string; fg: string; dim: string; faint: string; cyan: string; magenta: string }

function readColors(): Colors {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    bg: v('--bg'),
    strong: v('--fg-strong'),
    fg: v('--fg'),
    dim: v('--fg-dim'),
    faint: v('--fg-faint'),
    cyan: v('--accent-cyan'),
    magenta: v('--accent-magenta'),
  }
}

type Shape = 'square' | 'arc' | 'heart' | 'star' | 'spiral' | 'squeeze' | 'shut' | 'cross'
type Mouth = 'none' | 'grin' | 'smile' | 'smirk' | 'o' | 'frown' | 'wobble' | 'flat' | 'talk' | 'dead'

// Everything an expression can set; `face()` starts from these and each mood or antic changes a few.
type Face = {
  look: { x: number; y: number } | null // null: follow the pointer
  rate: number // how fast the eyes get there
  shape: [Shape, Shape] // left, right
  wide: number
  squash: number // eyes shorter (shy, thinking)
  lid: [number, number] // flat lids from the top (bored, suspicious)
  slant: number // angry cut
  sad: number // sad cut, low on the outside
  eyeScale: [number, number] // one eye bigger (curious)
  tilt: number // head tilt, radians
  droop: number // the face sinks (tired, dead)
  mouth: Mouth
  hot: number // front dots turn magenta
  blush: number // `///`
  bounce: number
  shake: number
  sway: number
  pulse: number // heartbeat
  spin: number
  reach: number // how far the face slides when looking aside
  blink: boolean
}

const face = (): Face => ({
  look: null,
  rate: 9,
  shape: ['square', 'square'],
  wide: 1,
  squash: 0,
  lid: [0, 0],
  slant: 0,
  sad: 0,
  eyeScale: [1, 1],
  tilt: 0,
  droop: 0,
  mouth: 'none',
  hot: 0,
  blush: 0,
  bounce: 0,
  shake: 0,
  sway: 0,
  pulse: 0,
  spin: 0.35,
  reach: 1,
  blink: true,
})

// Under the pointer it is one of these, switching every few seconds.
type HoverFace = 'laugh' | 'angry' | 'shy' | 'love' | 'starry' | 'suspicious'
const HOVER_FACES: HoverFace[] = ['laugh', 'angry', 'shy', 'love', 'starry', 'suspicious']

// What it does by itself while idle. Weight = how often it's picked. `sleep` isn't drawn: it comes after a long stillness.
type Antic = 'race' | 'glance' | 'wink' | 'surprise' | 'roll' | 'hum' | 'dizzy' | 'love' | 'sneeze' | 'bored' | 'sleep'
const ANTICS: { kind: Antic; dur: number; weight: number }[] = [
  { kind: 'race', dur: 3.4, weight: 3 },
  { kind: 'glance', dur: 2.2, weight: 3 },
  { kind: 'wink', dur: 0.8, weight: 2 },
  { kind: 'hum', dur: 3, weight: 2 },
  { kind: 'bored', dur: 3, weight: 2 },
  { kind: 'surprise', dur: 1.4, weight: 1 },
  { kind: 'roll', dur: 1.5, weight: 1 },
  { kind: 'dizzy', dur: 2.8, weight: 1 },
  { kind: 'love', dur: 2.4, weight: 1 },
  { kind: 'sneeze', dur: 1.9, weight: 1 },
]
const SLEEP_AFTER = 20_000

// Reactions to the chat: after talking, and after the chat closes (sad or dead, then reviving).
type React = 'tired' | 'sad' | 'dead' | 'revive' | 'heave' | 'bumped' | 'free'
const REACT_DUR: Record<React, number> = { tired: 3.5, sad: 2.4, dead: 2.4, revive: 0.9, heave: 0.6, bumped: 1.1, free: 0.9 }
const chatting = (m: OrbMood) => m === 'open' || m === 'thinking' || m === 'talking'

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

type Particle = { g: string; color: keyof Colors; x: number; y: number; vx: number; vy: number; born: number; life: number; size: number }
type Eye = { s: number; x: number; y: number; rx: number; ry: number }

export function AiOrb({ size, mood, cue }: { size: number; mood: OrbMood; cue?: OrbCue }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const moodRef = useRef(mood)
  moodRef.current = mood
  const cueRef = useRef(cue)
  cueRef.current = cue
  const reduced = useMotion((s) => s.reduced)
  const theme = useTheme((s) => s.theme)
  // Reduced motion redraws when the mood changes; the animated loop reads it live.
  const redraw = reduced ? mood : 'live'
  const full = Math.round(size * BLEED)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    el.width = full * dpr
    el.height = full * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Theme tokens transition (tokens.css), so the colours are read again every few frames, not once.
    let colors = readColors()
    let frames = 0
    const R = size * 0.42
    const c = full / 2
    const font = Math.max(6, Math.round(size / 10.5))
    const mono = '"Geist Mono Variable", ui-monospace, monospace'
    // Same dot density at any size (170 points looked right at 56 px).
    const sphere = lattice(Math.round(170 * (size / 56) ** 1.5))

    // Where the eyes look by default: toward the pointer.
    const look = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }
    let movedAt = performance.now()
    const onMove = (e: PointerEvent) => {
      movedAt = performance.now()
      const box = el.getBoundingClientRect()
      const dx = e.clientX - (box.left + box.width / 2)
      const dy = e.clientY - (box.top + box.height / 2)
      const d = Math.hypot(dx, dy) || 1
      const k = Math.min(1, d / 260)
      target.x = (dx / d) * k
      target.y = (dy / d) * k
    }
    if (!reduced) window.addEventListener('pointermove', onMove)

    const pickFace = (not?: HoverFace) => {
      const pool = HOVER_FACES.filter((f) => f !== not)
      return pool[Math.floor(Math.random() * pool.length)]
    }
    let hoverFace: HoverFace = pickFace()
    let hoverUntil = 0
    let wasHover = false

    type Running = { kind: Antic; at: number; dur: number; side: number; spots: { x: number; y: number }[]; burst: boolean }
    let antic: Running | null = null
    let anticAt = performance.now() + 2000 + Math.random() * 2000
    const start = (kind: Antic, now: number) => {
      const spot = () => ({ x: (Math.random() * 2 - 1) * 0.9, y: (Math.random() * 2 - 1) * 0.7 })
      // Woken from sleep, the surprise is a short start.
      const dur = kind === 'sleep' ? Infinity : kind === 'surprise' && antic?.kind === 'sleep' ? 0.9 : ANTICS.find((a) => a.kind === kind)!.dur
      antic = { kind, at: now, dur, side: Math.random() < 0.5 ? -1 : 1, spots: [spot(), spot()], burst: false }
    }
    let react: { kind: React; at: number } | null = null
    let prevMood = mood
    let lastCue = cue?.n
    // Dev hooks for visual checks: `__orbAntic('race')` starts that antic now; `__orbFace('angry')` holds that hover mood;
    // `__orbReact('dead')` plays that reaction.
    if (import.meta.env.DEV) {
      const w = window as unknown as { __orbAntic: (k: Antic) => void; __orbFace: (f: HoverFace) => void; __orbReact: (k: React) => void }
      w.__orbAntic = (k) => start(k, performance.now())
      w.__orbReact = (k) => (react = { kind: k, at: performance.now() })
      w.__orbFace = (f) => {
        hoverFace = f
        hoverUntil = performance.now() + 60_000
      }
    }

    // Eased values, so expressions melt into each other instead of switching.
    const cur = face()
    // Each eye and the mouth pop small and back when their shape changes.
    const eyeShape: Shape[] = ['square', 'square']
    const eyePop = [1, 1]
    let mouth: Mouth = 'none'
    let mouthPop = 0
    let particles: Particle[] = []
    let emittedAt = 0
    let clock = 0
    let spin = 0
    let shimmer = 0
    let blinkAt = performance.now() + 1800 + Math.random() * 2500
    let twice = false
    let last = 0
    let raf = 0

    const emit = (p: Omit<Particle, 'born'>, now: number) => particles.push({ ...p, born: now })
    const hearts = (now: number) => {
      if (now - emittedAt < 620) return
      emittedAt = now
      emit({ g: '♥', color: 'magenta', x: c + (Math.random() - 0.5) * R, y: c - R * 0.75, vx: (Math.random() - 0.5) * 8, vy: -16, life: 1.6, size: R * 0.3 }, now)
    }

    // The expression for this moment.
    const expression = (m: OrbMood, now: number): Face => {
      const f = face()
      if (react) {
        const at = (now - react.at) / 1000
        switch (react.kind) {
          case 'tired':
            // Droopy lids, sinking a little, one long sigh.
            if (at > 0.3 && now - emittedAt > 4000) {
              emittedAt = now
              emit({ g: '~', color: 'dim', x: c + R * 0.2, y: c + R * 0.45, vx: 14, vy: -6, life: 1.4, size: R * 0.34 }, now)
            }
            return { ...f, look: { x: 0, y: 0.45 }, rate: 4, lid: [0.5, 0.5], droop: 0.08, mouth: 'wobble', spin: 0.08, blink: false }
          case 'sad':
            // Sad eyes (cut low on the outside), looking down, a tear.
            if (at > 0.4 && now - emittedAt > 900) {
              emittedAt = now
              emit({ g: '•', color: 'cyan', x: c - R * 0.32, y: c + R * 0.25, vx: 0, vy: 22, life: 0.9, size: R * 0.22 }, now)
            }
            return { ...f, look: { x: 0, y: 0.5 }, rate: 5, sad: 1, droop: 0.06, mouth: 'frown', spin: 0.08, blink: false }
          case 'dead':
            // Plays dead: X eyes, tongue out, tipped over, the sphere stops.
            return { ...f, look: { x: 0.3, y: 0.3 }, rate: 6, shape: ['cross', 'cross'], tilt: 0.55, droop: 0.12, mouth: 'dead', spin: 0, blink: false }
          case 'heave':
            // Lifting its window: eyes squeezed shut with the effort, a tremble, teeth gritted.
            return { ...f, look: { x: 0, y: -0.3 }, rate: 20, shape: ['squeeze', 'squeeze'], mouth: 'grin', shake: 0.6, blink: false }
          case 'bumped':
            // Shoved aside by a side panel: > < and a jolt, then a wary look at what pushed it.
            if (at < 0.4) return { ...f, look: { x: -0.4, y: 0 }, rate: 24, shape: ['squeeze', 'squeeze'], mouth: 'o', shake: 1, blink: false }
            return { ...f, look: { x: 0.9, y: 0 }, rate: 10, lid: [0.35, 0.35], mouth: 'flat' }
          case 'free':
            // Room again: a happy hop.
            return { ...f, look: { x: 0, y: -0.2 }, shape: ['arc', 'arc'], mouth: 'smile', bounce: 1, blink: false }
          case 'revive':
            // Snaps out of it: a shake, eyes wide, then normal.
            return { ...f, look: { x: 0, y: 0 }, rate: 16, wide: at < 0.5 ? 1.2 : 1, shake: at < 0.35 ? 1 : 0, mouth: at < 0.5 ? 'o' : 'none', blink: false }
        }
      }
      if (m === 'thinking') return { ...f, look: { x: 0.7, y: -0.6 }, squash: 0.3, spin: 2.2 }
      if (m === 'talking') {
        // Yapping: a chattering mouth, a quick bob, glances back at you now and then.
        return { ...f, look: Math.sin(clock * 0.9) > 0.6 ? { x: -0.7, y: 0.1 } : { x: 0.4, y: 0.7 }, rate: 10, mouth: 'talk', bounce: 0.4, spin: 1.1, sway: 0.25 }
      }
      if (m === 'open') {
        // Curious: head tilted one way then the other, the eye on that side bigger, darting over the chat; a `?` sometimes.
        const phase = Math.floor(clock / 1.6) % 3
        const side = phase === 1 ? -1 : 1
        if (now - emittedAt > 2800) {
          emittedAt = now
          emit({ g: '?', color: 'cyan', x: c + side * R * 0.7, y: c - R * 0.75, vx: side * 4, vy: -10, life: 1.4, size: R * 0.38 }, now)
        }
        // It sits at the top of its window (D-081): the chat is below and to the right, the app to the left.
        const spots = [{ x: 0.35, y: 0.75 }, { x: 0.8, y: 0.35 }, { x: -0.1, y: 0.8 }]
        return { ...f, look: spots[phase], rate: 14, tilt: side * 0.22, eyeScale: side < 0 ? [1.15, 0.92] : [0.92, 1.15], wide: 1.05 }
      }
      if (m === 'hover') {
        switch (hoverFace) {
          case 'laugh':
            return { ...f, look: { x: 0, y: -0.2 }, shape: ['arc', 'arc'], mouth: 'grin', bounce: 1, spin: 0.7 }
          case 'angry':
            // Shakes in short bursts.
            return { ...f, look: { x: 0, y: 0.15 }, rate: 12, slant: 1, hot: 1, mouth: 'frown', shake: +(Math.sin(clock * 2.6) > 0.55), spin: 0.7 }
          case 'shy':
            return { ...f, look: { x: 0.7, y: 0.7 }, squash: 0.35, blush: 1, mouth: 'wobble', spin: 0.15 }
          case 'love':
            hearts(now)
            return { ...f, look: { x: 0, y: -0.1 }, shape: ['heart', 'heart'], pulse: 1, mouth: 'smile', spin: 0.5 }
          case 'starry':
            if (now - emittedAt > 380) {
              emittedAt = now
              const a = Math.random() * Math.PI * 2
              emit({ g: '✦', color: 'cyan', x: c + Math.cos(a) * R * 1.1, y: c + Math.sin(a) * R * 1.1, vx: 0, vy: -4, life: 0.9, size: R * (0.18 + Math.random() * 0.14) }, now)
            }
            return { ...f, look: { x: 0, y: -0.15 }, shape: ['star', 'star'], mouth: 'grin', bounce: 0.6, spin: 1.2 }
          case 'suspicious':
            // One eye narrowed, side-eyeing left and right.
            return { ...f, look: { x: Math.sin(clock * 1.1) > 0 ? 0.85 : -0.85, y: 0.05 }, rate: 4, lid: [0.55, 0.15], mouth: 'flat', spin: 0.2 }
        }
      }
      if (!antic) return f
      const at = (now - antic.at) / 1000
      const side = antic.side
      switch (antic.kind) {
        case 'race': {
          // Cars come from the left and shoot past: the eyes (and the face with them) whip across, then reset for the next.
          const g: Face = { ...f, reach: 1.7, wide: 1.08, rate: 24, blink: false }
          if (at < 0.5) return { ...g, look: { x: -1, y: 0.2 } }
          const ph = ((at - 0.5) % 0.95) / 0.95
          return { ...g, look: { x: ph < 0.6 ? -1 + 2 * smooth(ph / 0.6) : 1 - 2 * smooth((ph - 0.6) / 0.4), y: 0.2 }, rate: ph < 0.6 ? 26 : 10 }
        }
        case 'glance':
          // Quick darts to two spots, held a beat each.
          return { ...f, look: antic.spots[at < 1 ? 0 : 1], rate: 16 }
        case 'wink': {
          const on = at > 0.12 && at < 0.6
          const shape: [Shape, Shape] = on ? (side < 0 ? ['arc', 'square'] : ['square', 'arc']) : ['square', 'square']
          return { ...f, look: { x: -side * 0.3, y: 0 }, shape, mouth: at < 0.7 ? 'smirk' : 'none' }
        }
        case 'surprise': {
          const on = at < 0.85 * antic.dur
          return { ...f, look: { x: 0, y: -0.25 }, rate: 18, wide: on ? 1.3 : 1, mouth: on ? 'o' : 'none', blink: false }
        }
        case 'roll': {
          // Left, up over the top, right: an eye roll, with lids half down.
          const a = Math.PI * (1 - smooth(clamp01((at - 0.15) / 0.9)))
          return { ...f, look: { x: Math.cos(a) * 0.9, y: -Math.sin(a) * 0.85 }, rate: 14, lid: [0.3, 0.3], mouth: 'flat' }
        }
        case 'hum':
          if (now - emittedAt > 480) {
            emittedAt = now
            emit({ g: Math.random() < 0.5 ? '♪' : '♫', color: 'cyan', x: c + R * 0.8, y: c - R * 0.35, vx: 10, vy: -18, life: 1.5, size: R * 0.34 }, now)
          }
          return { ...f, look: { x: Math.sin(at * 3) * 0.3, y: -0.1 }, shape: ['arc', 'arc'], mouth: 'smile', sway: 1 }
        case 'dizzy':
          // A fast spin first, then spiral eyes and a wobble.
          if (at < 0.9) return { ...f, look: { x: 0, y: 0 }, spin: 9, wide: 1.1, blink: false }
          return { ...f, shape: ['spiral', 'spiral'], mouth: 'wobble', sway: 0.7, blink: false }
        case 'love':
          hearts(now)
          return { ...f, look: { x: 0, y: -0.1 }, shape: ['heart', 'heart'], pulse: 1, mouth: 'smile', blink: false }
        case 'sneeze': {
          // Ah… ah… (eyes widen, look up), choo! (squeezed shut, a jolt, a puff of dots), then a sniff.
          if (at < 0.8) return { ...f, look: { x: 0, y: -0.45 }, wide: 1 + at * 0.2, lid: [0.2, 0.2], mouth: 'o', blink: false }
          if (!antic.burst) {
            antic.burst = true
            for (let i = 0; i < 9; i++) {
              const a = Math.PI * (0.15 + 0.7 * (i / 8))
              emit({ g: i % 2 ? '*' : '·', color: 'fg', x: c, y: c + R * 0.45, vx: Math.cos(a) * 60, vy: Math.sin(a) * 40, life: 0.6, size: R * 0.28 }, now)
            }
          }
          if (at < 1.05) return { ...f, look: { x: 0, y: 0.35 }, rate: 30, shape: ['squeeze', 'squeeze'], mouth: 'o', shake: 1, blink: false }
          return { ...f, look: { x: 0, y: 0.2 }, mouth: 'wobble' }
        }
        case 'bored':
          return { ...f, look: { x: side * 0.75, y: 0.1 }, rate: 3, lid: [0.55, 0.55], mouth: 'flat', spin: 0.15 }
        case 'sleep':
          if (now - emittedAt > 950) {
            emittedAt = now
            const big = Math.random() < 0.5
            emit({ g: big ? 'Z' : 'z', color: 'dim', x: c + R * 0.5, y: c - R * 0.5, vx: 9, vy: -13, life: 2.2, size: R * (big ? 0.38 : 0.28) }, now)
          }
          return { ...f, look: { x: 0, y: 0.2 }, rate: 3, shape: ['shut', 'shut'], spin: 0.06, blink: false }
      }
      return f
    }

    const drawEye = (shape: Shape, e: Eye, k: number, open: number, lid: number) => {
      const rx = e.rx * k
      const ry = e.ry * k
      ctx.fillStyle = colors.strong
      ctx.beginPath()
      switch (shape) {
        case 'arc':
          // A thick ^ (laughing, humming, the winking eye).
          ctx.lineWidth = R * 0.11 * k
          ctx.moveTo(e.x - rx * 0.9, e.y + ry * 0.3)
          ctx.lineTo(e.x, e.y - ry * 0.45)
          ctx.lineTo(e.x + rx * 0.9, e.y + ry * 0.3)
          ctx.stroke()
          return
        case 'shut':
          // Asleep: a soft downward curve.
          ctx.lineWidth = R * 0.09 * k
          ctx.moveTo(e.x - rx, e.y)
          ctx.quadraticCurveTo(e.x, e.y + ry * 0.55, e.x + rx, e.y)
          ctx.stroke()
          return
        case 'cross':
          // X, playing dead.
          ctx.lineWidth = R * 0.09 * k
          ctx.moveTo(e.x - rx * 0.8, e.y - rx * 0.8)
          ctx.lineTo(e.x + rx * 0.8, e.y + rx * 0.8)
          ctx.moveTo(e.x + rx * 0.8, e.y - rx * 0.8)
          ctx.lineTo(e.x - rx * 0.8, e.y + rx * 0.8)
          ctx.stroke()
          return
        case 'squeeze': {
          // > <, squeezed shut.
          const d = -e.s
          ctx.lineWidth = R * 0.1 * k
          ctx.moveTo(e.x - d * rx, e.y - ry * 0.7)
          ctx.lineTo(e.x + d * rx * 0.75, e.y)
          ctx.lineTo(e.x - d * rx, e.y + ry * 0.7)
          ctx.stroke()
          return
        }
        case 'heart': {
          const h = rx * 1.35
          ctx.fillStyle = colors.magenta
          ctx.moveTo(e.x, e.y + h * 0.75)
          ctx.bezierCurveTo(e.x - h * 1.15, e.y, e.x - h * 0.75, e.y - h * 1.0, e.x, e.y - h * 0.35)
          ctx.bezierCurveTo(e.x + h * 0.75, e.y - h * 1.0, e.x + h * 1.15, e.y, e.x, e.y + h * 0.75)
          ctx.fill()
          return
        }
        case 'star': {
          // A four-point sparkle that turns slowly.
          const h = rx * 1.5
          const a0 = clock * 1.5 * e.s
          ctx.fillStyle = colors.cyan
          ctx.moveTo(e.x + Math.cos(a0) * h, e.y + Math.sin(a0) * h)
          for (let i = 1; i <= 4; i++) {
            const a = a0 + (i * Math.PI) / 2
            ctx.quadraticCurveTo(e.x, e.y, e.x + Math.cos(a) * h, e.y + Math.sin(a) * h)
          }
          ctx.fill()
          return
        }
        case 'spiral': {
          ctx.lineWidth = R * 0.055 * k
          const turns = Math.PI * 4
          for (let t = 0; t <= turns; t += 0.25) {
            const rr = (rx * 1.1 * t) / turns
            const a = t + clock * 7 * e.s
            ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr)
          }
          ctx.stroke()
          return
        }
        case 'square': {
          // Squinting, squashed or mid-blink: shorter, never thinner than a bar.
          const shut = open * (1 - cur.squash)
          const h = Math.max(ry * 2 * shut, R * 0.08)
          const w = rx * 2 * (1 + (1 - shut) * 0.12)
          ctx.save()
          ctx.roundRect(e.x - w / 2, e.y - h / 2, w, h, Math.min(w, h) * 0.32)
          ctx.clip()
          ctx.fill()
          // Lids cut out of the top: flat ones (bored, suspicious) and a slant, low on the inside (angry).
          const top = e.y - h / 2
          const inner = e.x - e.s * w * 0.6
          const outer = e.x + e.s * w * 0.6
          const cutIn = h * Math.max(lid, 0.55 * cur.slant, 0.08 * cur.sad)
          const cutOut = h * Math.max(lid, 0.1 * cur.slant, 0.55 * cur.sad)
          if (cutIn > 0.3 || cutOut > 0.3) {
            ctx.globalCompositeOperation = 'destination-out'
            ctx.beginPath()
            ctx.moveTo(inner, top - 1)
            ctx.lineTo(outer, top - 1)
            ctx.lineTo(outer, top + cutOut)
            ctx.lineTo(inner, top + cutIn)
            ctx.closePath()
            ctx.fill()
          }
          ctx.restore()
        }
      }
    }

    const drawMouth = (mx: number, my: number, k: number) => {
      if (mouth === 'none' || k < 0.05) return
      ctx.lineWidth = R * 0.065
      ctx.fillStyle = colors.strong
      ctx.beginPath()
      switch (mouth) {
        case 'grin': {
          const w = R * 0.17 * k
          ctx.moveTo(mx - w, my - R * 0.02)
          ctx.lineTo(mx + w, my - R * 0.02)
          ctx.quadraticCurveTo(mx + w, my + w * 1.4, mx, my + w * 1.4)
          ctx.quadraticCurveTo(mx - w, my + w * 1.4, mx - w, my - R * 0.02)
          ctx.fill()
          return
        }
        case 'smile': {
          const w = R * 0.12 * k
          ctx.moveTo(mx - w, my)
          ctx.quadraticCurveTo(mx, my + w * 1.3, mx + w, my)
          break
        }
        case 'smirk': {
          const w = R * 0.11 * k
          ctx.moveTo(mx - w, my + w * 0.15)
          ctx.quadraticCurveTo(mx + w * 0.3, my + w * 0.6, mx + w, my - w * 0.35)
          break
        }
        case 'o':
          ctx.ellipse(mx, my + R * 0.03, R * 0.07 * k, R * 0.09 * k, 0, 0, Math.PI * 2)
          break
        case 'frown': {
          const w = R * 0.12 * k
          ctx.moveTo(mx - w, my + w * 0.6)
          ctx.quadraticCurveTo(mx, my - w * 0.5, mx + w, my + w * 0.6)
          break
        }
        case 'wobble': {
          const w = R * 0.11 * k
          ctx.moveTo(mx - w, my)
          ctx.quadraticCurveTo(mx - w / 2, my - w * 0.5, mx, my)
          ctx.quadraticCurveTo(mx + w / 2, my + w * 0.5, mx + w, my)
          break
        }
        case 'talk': {
          // Chattering: the opening jumps between sizes, like syllables.
          const open = 0.25 + 0.75 * Math.abs(Math.sin(clock * 13) * Math.sin(clock * 5.3))
          ctx.ellipse(mx, my + R * 0.02, R * 0.1 * k, R * 0.1 * k * open, 0, 0, Math.PI * 2)
          ctx.fill()
          return
        }
        case 'dead': {
          // A flat line with the tongue out.
          const w = R * 0.12 * k
          ctx.moveTo(mx - w, my)
          ctx.lineTo(mx + w, my)
          ctx.stroke()
          ctx.fillStyle = colors.magenta
          ctx.beginPath()
          ctx.arc(mx + w * 0.35, my + R * 0.02, R * 0.06 * k, 0, Math.PI)
          ctx.fill()
          return
        }
        case 'flat': {
          const w = R * 0.09 * k
          ctx.moveTo(mx - w, my)
          ctx.lineTo(mx + w, my)
          break
        }
      }
      ctx.stroke()
    }

    const draw = (now: number, dt: number) => {
      const m = moodRef.current
      if (++frames % 8 === 0) colors = readColors()
      clock += dt

      // Reactions: tired after talking; closing the chat makes it sad or play dead, then it revives.
      if (!reduced && cueRef.current && cueRef.current.n !== lastCue) {
        lastCue = cueRef.current.n
        if (!chatting(m)) react = { kind: cueRef.current.kind, at: now }
      }
      if (m !== prevMood) {
        if (!reduced && !chatting(prevMood) && m === 'open') react = { kind: 'heave', at: now }
        else if (!reduced && prevMood === 'talking' && m === 'open') react = { kind: 'tired', at: now }
        else if (!reduced && chatting(prevMood) && !chatting(m)) react = { kind: Math.random() < 0.5 ? 'sad' : 'dead', at: now }
        else if (m === 'thinking' || m === 'talking') react = null
        prevMood = m
      }
      if (react && now - react.at > REACT_DUR[react.kind] * 1000) {
        react = react.kind === 'sad' || react.kind === 'dead' ? { kind: 'revive', at: now } : null
      }

      // A new mood each time the pointer comes over it, and again every few seconds while it stays.
      if (m === 'hover' && (!wasHover || (!reduced && now > hoverUntil))) {
        hoverFace = pickFace(wasHover ? hoverFace : undefined)
        hoverUntil = now + 2600 + Math.random() * 1400
      }
      wasHover = m === 'hover'

      // Antics while idle: one every few seconds; a long stillness puts it to sleep, and moving wakes it with a start.
      if (!reduced) {
        if (antic && m !== 'idle') antic = null
        if (antic?.kind === 'sleep' && movedAt > antic.at) start('surprise', now)
        if (antic && now - antic.at > antic.dur * 1000) {
          antic = null
          anticAt = now + 3000 + Math.random() * 4000
        }
        if (!antic && m === 'idle' && !react) {
          if (now - movedAt > SLEEP_AFTER) start('sleep', now)
          else if (now > anticAt) {
            let pick = Math.random() * ANTICS.reduce((a, b) => a + b.weight, 0)
            start((ANTICS.find((x) => (pick -= x.weight) < 0) ?? ANTICS[0]).kind, now)
          }
        }
      }

      const want = expression(m, now)
      const ease = (r: number) => (reduced ? 1 : 1 - Math.exp(-dt * r))
      const to = (k: 'wide' | 'squash' | 'slant' | 'sad' | 'tilt' | 'droop' | 'hot' | 'blush' | 'bounce' | 'shake' | 'sway' | 'pulse' | 'spin' | 'reach', r: number) => {
        cur[k] += (want[k] - cur[k]) * ease(r)
      }
      const goal = want.look ?? target
      look.x += (goal.x - look.x) * ease(want.rate)
      look.y += (goal.y - look.y) * ease(want.rate)
      to('wide', 14)
      to('squash', 10)
      to('slant', 12)
      to('sad', 10)
      to('tilt', 6)
      to('droop', 6)
      cur.eyeScale[0] += (want.eyeScale[0] - cur.eyeScale[0]) * ease(8)
      cur.eyeScale[1] += (want.eyeScale[1] - cur.eyeScale[1]) * ease(8)
      to('hot', 10)
      to('blush', 8)
      to('bounce', 8)
      to('shake', 20)
      to('sway', 5)
      to('pulse', 8)
      to('spin', 4)
      to('reach', 6)
      cur.lid[0] += (want.lid[0] - cur.lid[0]) * ease(10)
      cur.lid[1] += (want.lid[1] - cur.lid[1]) * ease(10)
      for (const i of [0, 1]) {
        if (want.shape[i] === eyeShape[i]) eyePop[i] += (1 - eyePop[i]) * ease(16)
        else if (reduced || (eyePop[i] -= dt * 12) < 0.25) eyeShape[i] = want.shape[i]
      }
      if (want.mouth === mouth) mouthPop += (+(mouth !== 'none') - mouthPop) * ease(14)
      else if (reduced || (mouthPop -= dt * 10) < 0.1) mouth = want.mouth

      spin += cur.spin * dt
      shimmer += dt * (m === 'thinking' ? 1 : 0)

      // Blink: a quick close and open every few seconds, now and then twice in a row.
      let open = 1
      if (!reduced) {
        const t = now - blinkAt
        if (t > 0 && t < 150) open = Math.abs(t - 75) / 75
        else if (t >= 150) {
          twice = !twice && Math.random() < 0.3
          blinkAt = now + (twice ? 120 : 2200 + Math.random() * 3800)
        }
      }
      if (!want.blink) open = 1

      // A slow float, a breath; plus bounce (laughing), shake (angry, sneezing) and sway (humming, dizzy).
      const r = reduced ? 0 : 1
      const cy0 = c + r * (Math.sin(clock * 1.7) * R * 0.035 - Math.abs(Math.sin(clock * 11)) * R * 0.05 * cur.bounce)
      const cx0 = c + r * (Math.sin(clock * 48) * R * 0.025 * cur.shake + Math.sin(clock * 3.2) * R * 0.07 * cur.sway)
      const beat = r * cur.pulse * 0.12 * Math.max(0, Math.sin(clock * 7)) ** 4

      ctx.clearRect(0, 0, full, full)
      ctx.font = `600 ${font}px ${mono}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Eyes: rounded squares like Grok Bot's; the whole face slides toward where it looks and flattens near the edge.
      const fx = cx0 + look.x * R * 0.2 * cur.reach
      const fy = cy0 + R * 0.02 + look.y * R * 0.16 + cur.droop * R
      const tc = Math.cos(cur.tilt)
      const ts = Math.sin(cur.tilt)
      const eyes: Eye[] = [-1, 1].map((s, i) => {
        const x = fx + s * R * 0.3 * tc
        const y = fy + s * R * 0.3 * ts
        const flat = 1 - 0.35 * Math.min(1, Math.abs(x - c) / R) ** 2
        const w = (cur.wide + beat) * cur.eyeScale[i]
        return { s, x, y, rx: R * 0.15 * flat * w, ry: R * 0.18 * w }
      })

      const cs = Math.cos(spin)
      const sn = Math.sin(spin)
      const ct = Math.cos(TILT)
      const st = Math.sin(TILT)
      const projected = sphere.map(([x, y, z]) => {
        // Spin around the vertical axis, then tilt toward the viewer.
        const x1 = x * cs + z * sn
        const z1 = -x * sn + z * cs
        const y2 = y * ct - z1 * st
        const z2 = y * st + z1 * ct
        return { x: cx0 + x1 * R, y: cy0 - y2 * R, z: z2, nx: x1, ny: y2 }
      })
      projected.sort((a, b) => a.z - b.z)

      for (const p of projected) {
        // Keep a margin around the eyes clear so they read.
        if (p.z > 0 && eyes.some((e) => Math.hypot((p.x - e.x) / (e.rx * 1.6), (p.y - e.y) / (e.ry * 1.45)) < 1)) continue
        // Lit from the upper left, front.
        const light = Math.max(0, p.nx * -0.45 + p.ny * 0.5 + p.z * 0.74)
        const b = p.z < 0 ? 0.14 + (p.z + 1) * 0.14 : 0.3 + light * 0.7
        const glyph = GLYPHS[Math.min(GLYPHS.length - 1, Math.max(1, Math.round(b * (GLYPHS.length - 1))))]
        const band = m === 'thinking' && Math.abs(Math.sin(p.ny * 3 - shimmer * 5)) < 0.22
        // Angry: the front of the sphere runs hot.
        const hot = p.z > 0.15 && cur.hot > 0.5 && b > 0.45
        ctx.fillStyle = band ? colors.cyan : hot ? colors.magenta : p.z < 0 ? colors.faint : b > 0.72 ? colors.fg : colors.dim
        ctx.fillText(glyph, p.x, p.y)
      }

      ctx.strokeStyle = colors.strong
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      eyes.forEach((e, i) => drawEye(eyeShape[i], e, 0.25 + 0.75 * eyePop[i], open, cur.lid[i]))

      // Shy: a little `///` under each eye in magenta.
      if (cur.blush > 0.05) {
        ctx.save()
        ctx.globalAlpha = cur.blush
        ctx.fillStyle = colors.magenta
        ctx.font = `700 ${Math.round(R * 0.26)}px ${mono}`
        for (const e of eyes) ctx.fillText('///', e.x + e.s * e.rx * 0.5, e.y + e.ry * 1.6)
        ctx.restore()
      }

      const md = R * 0.36 * cur.wide
      drawMouth(fx - md * ts, fy + md * tc, mouthPop)

      // Floating z's, notes, hearts, sparkles: they rise and fade, with a page-coloured edge so they read over the dots.
      particles = particles.filter((p) => now - p.born < p.life * 1000)
      for (const p of particles) {
        const age = (now - p.born) / 1000
        const x = p.x + p.vx * age
        const y = p.y + p.vy * age
        ctx.save()
        ctx.globalAlpha = Math.min(1, (1 - age / p.life) * 2, age * 8)
        ctx.font = `700 ${Math.round(p.size * (0.8 + 0.3 * Math.min(1, age * 4)))}px ${mono}`
        ctx.lineWidth = 3
        ctx.strokeStyle = colors.bg
        ctx.strokeText(p.g, x, y)
        ctx.fillStyle = colors[p.color]
        ctx.fillText(p.g, x, y)
        ctx.restore()
      }
    }

    if (reduced) {
      draw(performance.now(), 0)
    } else {
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame)
        if (now - last < 1000 / FPS - 2) return
        const dt = last ? Math.min((now - last) / 1000, 0.1) : 0
        last = now
        draw(now, dt)
      }
      raf = requestAnimationFrame(frame)
    }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
    // `mood` is read live through moodRef; under reduced motion `redraw` carries it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, full, reduced, theme, redraw])

  // The canvas bleeds past the orb (negative margin) for the floating glyphs; the button stays orb-sized.
  const bleed = (full - size) / 2
  return (
    <canvas
      ref={canvas}
      style={{ width: full, height: full, margin: -bleed, display: 'block', pointerEvents: 'none' }}
      aria-hidden
    />
  )
}
