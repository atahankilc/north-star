// The assistant's face (D-073): a slowly turning sphere of ASCII dots with two eyes. Its own small 2D canvas,
// not the backdrop's ASCII pass. The eyes follow your pointer and blink now and then; while it's answering the
// sphere spins faster with a cyan shimmer. Under reduced motion it holds still and is drawn once per change.
import { useEffect, useRef } from 'react'
import { useMotion } from '../state/motion'
import { useTheme } from '../state/theme'

export type OrbMood = 'idle' | 'hover' | 'open' | 'thinking'

const POINTS = 170
const GLYPHS = ' .·:-=+*#%@'
const FPS = 30
const TILT = 0.38

// Evenly spread points on a unit sphere (Fibonacci lattice).
const sphere = Array.from({ length: POINTS }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / POINTS
  const r = Math.sqrt(1 - y * y)
  const a = i * Math.PI * (3 - Math.sqrt(5))
  return [Math.cos(a) * r, y, Math.sin(a) * r] as const
})

type Colors = { strong: string; fg: string; dim: string; faint: string; cyan: string; magenta: string }

function readColors(): Colors {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return { strong: v('--fg-strong'), fg: v('--fg'), dim: v('--fg-dim'), faint: v('--fg-faint'), cyan: v('--accent-cyan'), magenta: v('--accent-magenta') }
}

export function AiOrb({ size, mood }: { size: number; mood: OrbMood }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const moodRef = useRef(mood)
  moodRef.current = mood
  const reduced = useMotion((s) => s.reduced)
  const theme = useTheme((s) => s.theme)
  // Reduced motion redraws when the mood changes; the animated loop reads it live.
  const redraw = reduced ? mood : 'live'

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    el.width = size * dpr
    el.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const colors = readColors()
    const R = size * 0.42
    const c = size / 2
    const font = Math.max(6, Math.round(size / 8.5))

    // Where the eyes look: toward the pointer, eased; up while the chat is open, up and aside while thinking.
    const look = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }
    const onMove = (e: PointerEvent) => {
      const box = el.getBoundingClientRect()
      const dx = e.clientX - (box.left + box.width / 2)
      const dy = e.clientY - (box.top + box.height / 2)
      const d = Math.hypot(dx, dy) || 1
      const k = Math.min(1, d / 240)
      target.x = (dx / d) * k
      target.y = (dy / d) * k
    }
    if (!reduced) window.addEventListener('pointermove', onMove)

    let spin = 0
    let shimmer = 0
    let blinkAt = performance.now() + 2500 + Math.random() * 3000
    let last = 0
    let raf = 0

    const draw = (now: number, dt: number) => {
      const m = moodRef.current
      const speed = m === 'thinking' ? 2.2 : m === 'hover' ? 0.7 : 0.35
      spin += speed * dt
      shimmer += dt * (m === 'thinking' ? 1 : 0)

      const want = m === 'thinking' ? { x: 0.55, y: -0.6 } : m === 'open' ? { x: -0.2, y: -0.7 } : target
      const ease = reduced ? 1 : 1 - Math.exp(-dt * 8)
      look.x += (want.x - look.x) * ease
      look.y += (want.y - look.y) * ease

      // Blink: a quick close and open every few seconds.
      let open = 1
      if (!reduced) {
        const t = now - blinkAt
        if (t > 0 && t < 160) open = Math.abs(t - 80) / 80
        else if (t >= 160) blinkAt = now + 2500 + Math.random() * 4000
      }
      if (m === 'thinking') open *= 0.75

      ctx.clearRect(0, 0, size, size)
      ctx.font = `600 ${font}px "Geist Mono Variable", ui-monospace, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const eyeW = R * 0.15
      const eyeH = R * 0.27 * Math.max(open, 0.12)
      const eyes = [-1, 1].map((s) => ({ x: c + s * R * 0.3 + look.x * R * 0.16, y: c - R * 0.04 + look.y * R * 0.14 }))

      const cy = Math.cos(spin)
      const sy = Math.sin(spin)
      const ct = Math.cos(TILT)
      const st = Math.sin(TILT)
      const projected = sphere.map(([x, y, z]) => {
        // Spin around the vertical axis, then tilt toward the viewer.
        const x1 = x * cy + z * sy
        const z1 = -x * sy + z * cy
        const y2 = y * ct - z1 * st
        const z2 = y * st + z1 * ct
        return { x: c + x1 * R, y: c - y2 * R, z: z2, nx: x1, ny: y2 }
      })
      projected.sort((a, b) => a.z - b.z)

      for (const p of projected) {
        // Keep the area around the eyes clear so they read.
        if (p.z > 0 && eyes.some((e) => Math.hypot((p.x - e.x) / (eyeW * 2.2), (p.y - e.y) / (R * 0.27 * 1.5)) < 1)) continue
        // Lit from the upper left, front.
        const light = Math.max(0, p.nx * -0.45 + p.ny * 0.5 + p.z * 0.74)
        const b = p.z < 0 ? 0.12 + (p.z + 1) * 0.12 : 0.3 + light * 0.7
        const glyph = GLYPHS[Math.min(GLYPHS.length - 1, Math.max(1, Math.round(b * (GLYPHS.length - 1))))]
        const band = m === 'thinking' && Math.abs(Math.sin(p.ny * 3 - shimmer * 5)) < 0.22
        ctx.fillStyle = band ? colors.cyan : p.z < 0 ? colors.faint : b > 0.72 ? colors.fg : colors.dim
        ctx.fillText(glyph, p.x, p.y)
      }

      ctx.fillStyle = colors.strong
      for (const e of eyes) {
        ctx.beginPath()
        ctx.ellipse(e.x, e.y, eyeW, eyeH, 0, 0, Math.PI * 2)
        ctx.fill()
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
  }, [size, reduced, theme, redraw])

  return <canvas ref={canvas} style={{ width: size, height: size, display: 'block' }} aria-hidden />
}
