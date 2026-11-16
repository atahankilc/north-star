// "Are you sure?" for something that can't be taken lightly (D-182, D-183): hazard tape. The screen darkens, the box
// comes in a few hard steps, and ASCII tape `╱╱╱` wraps round it from the box outwards, following its round corners
// (D-387), runs once and stops; the text
// settles out of glyphs (DecodeText). Leaving, the box breaks apart cell by cell (D-034). Reduced motion: the tape is
// just there, nothing moves. On the one Window (D-359): focus kept inside (on cancel first, or the gentler answer),
// Escape cancels, a press on the dark does nothing; the tape is drawn on its scrim (`behind`).
import { useEffect, useId, useRef } from 'react'
import { isReducedMotion } from '../../state/motion'
import { runCells } from '../primitives/Appear'
import { CELL_PX } from '../foundation/cellReveal'
import { DecodeText } from '../primitives/DecodeText'
import { Button } from '../primitives/Button'
import { ButtonGroup } from '../primitives/ButtonGroup'
import styles from './HazardConfirm.module.css'
import { DUR } from '../foundation/motion'
import { stopCanvas } from '../foundation/canvasGuard'
import { Window } from './Window'
import { tokenPx } from '../../styles/cssToken'

type Props = {
  title: string
  // A line or two under the title.
  lines?: string[]
  confirm: string
  onConfirm: () => void
  onCancel: () => void
  // A second, gentler answer beside the dangerous one (D-313: `only from here` for a piece on other canvases too); when
  // given, it has the focus first instead of cancel.
  also?: { label: string; onSelect: () => void }
}

// How long the tape takes to wrap round, and how long it runs before it stops.
const WRAP_MS = 380
const RUN_MS = 1500
// Cells of tape round the box.
const BAND = 3

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

export function HazardConfirm({ title, lines = [], confirm, onConfirm, onCancel, also }: Props) {
  const box = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const cancelBtn = useRef<HTMLButtonElement>(null)
  const alsoBtn = useRef<HTMLButtonElement>(null)
  const leaving = useRef(false)
  const reduced = isReducedMotion()
  const titleId = useId()

  // The tape, on the screen's cell grid round the box.
  useEffect(() => {
    const el = box.current
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!el || !cv || !ctx) return
    const css = getComputedStyle(document.documentElement)
    const color = (name: string) => css.getPropertyValue(name).trim()
    const ink = { on: color('--accent-magenta'), off: color('--fg-faint'), font: color('--font-mono') }
    const radius = tokenPx('--radius-window')
    const gap = tokenPx('--space-1')
    const size = () => {
      const dpr = window.devicePixelRatio || 1
      cv.width = Math.round(window.innerWidth * dpr)
      cv.height = Math.round(window.innerHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `${CELL_PX + 2}px ${ink.font}`
    }
    // `grow` 0 → 1 wraps the tape out from the box; `shift` moves its stripes along.
    const draw = (grow: number, shift: number) => {
      ctx.clearRect(0, 0, cv.width, cv.height)
      const r = el.getBoundingClientRect()
      // The box is round (D-387), so the tape is every cell whose middle is within the band of the round box's edge:
      // `d` is how far a point is outside it (a rounded rectangle's distance).
      const reach = BAND * CELL_PX
      const far = gap + reach
      const midX = r.left + r.width / 2
      const midY = r.top + r.height / 2
      for (let gy = Math.floor((r.top - far) / CELL_PX); gy <= Math.ceil((r.bottom + far) / CELL_PX); gy++)
        for (let gx = Math.floor((r.left - far) / CELL_PX); gx <= Math.ceil((r.right + far) / CELL_PX); gx++) {
          const px = gx * CELL_PX + CELL_PX / 2
          const py = gy * CELL_PX + CELL_PX / 2
          const qx = Math.abs(px - midX) - (r.width / 2 - radius)
          const qy = Math.abs(py - midY) - (r.height / 2 - radius)
          const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
          // Clear of the box by the gap and a cell's half, so no glyph touches its line.
          if (d < gap + CELL_PX / 2 || d > far || (d - gap) / reach > grow) continue
          const on = (((gx + gy + shift) % 4) + 4) % 4 < 2
          ctx.globalAlpha = on ? 0.9 : 0.35
          ctx.fillStyle = on ? ink.on : ink.off
          ctx.fillText('╱', px, py)
        }
      ctx.globalAlpha = 1
    }
    size()
    let raf = 0
    let last = { grow: 1, shift: 0 }
    const onResize = () => (size(), draw(last.grow, last.shift))
    window.addEventListener('resize', onResize)
    // The box settles after the first draw (its font arriving, its lines wrapping): the tape follows its edge.
    const watch = new ResizeObserver(() => draw(last.grow, last.shift))
    watch.observe(el)
    if (reduced) draw(1, 0)
    else {
      const t0 = performance.now()
      const frame = (now: number) => {
        const t = now - t0
        last = { grow: ease(t / WRAP_MS), shift: Math.floor(Math.min(t, RUN_MS) / 70) }
        draw(last.grow, last.shift)
        if (t < RUN_MS) raf = requestAnimationFrame(frame)
      }
      raf = requestAnimationFrame(frame)
    }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      watch.disconnect()
    }
  }, [reduced])

  // Going away: the box breaks apart cell by cell, the tape and the dark go with it, then the answer is given.
  const leave = (then: () => void) => {
    if (leaving.current) return
    leaving.current = true
    const el = box.current
    if (!el || reduced) return then()
    // The scrim: the dark and the tape go with the box.
    el.parentElement?.setAttribute('data-leaving', 'true')
    runCells(el, 'exit', 0, DUR.exit, then)
  }

  return (
    <Window
      role="alertdialog"
      labelledBy={titleId}
      onClose={() => leave(onCancel)}
      scrimPress="keep"
      scrimProps={{ className: styles.scrim, 'data-reduced': reduced || undefined, ...stopCanvas }}
      look="bare"
      entrance="none"
      focus={also ? alsoBtn : cancelBtn}
      elRef={box}
      className={styles.box}
      behind={
        <>
          <div className={styles.veil} aria-hidden />
          <canvas ref={canvas} className={styles.tape} aria-hidden />
        </>
      }
    >
      <h2 id={titleId} className={styles.title}>
        <DecodeText text={title} duration={500} delay={100} />
      </h2>
      {lines.map((line, i) => (
        <p key={i} className={styles.line}>
          <DecodeText text={line} duration={500} delay={160 + i * 60} />
        </p>
      ))}
      {/* Cancel the strong one (focused), deleting the solid magenta one: here deleting is the point (D-344). */}
      <div className={styles.actions}>
        <ButtonGroup>
          <Button ref={cancelBtn} tone="main" onClick={() => leave(onCancel)}>
            cancel
          </Button>
          {also && (
            <Button ref={alsoBtn} onClick={() => leave(also.onSelect)}>
              {also.label}
            </Button>
          )}
          <Button tone="hazard" onClick={() => leave(onConfirm)}>
            {confirm}
          </Button>
        </ButtonGroup>
      </div>
    </Window>
  )
}
