// "Are you sure?" for something that can't be taken lightly (D-182, D-183): hazard tape. The screen darkens, the box
// comes in a few hard steps, and ASCII tape `╱╱╱` wraps round it from the box outwards, runs once and stops; the text
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
      const x0 = Math.floor(r.left / CELL_PX)
      const y0 = Math.floor(r.top / CELL_PX)
      const x1 = Math.ceil(r.right / CELL_PX)
      const y1 = Math.ceil(r.bottom / CELL_PX)
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      for (let gy = y0 - BAND; gy < y1 + BAND; gy++)
        for (let gx = x0 - BAND; gx < x1 + BAND; gx++) {
          if (gx >= x0 && gx < x1 && gy >= y0 && gy < y1) continue
          const reach = Math.max(Math.abs(gx + 0.5 - cx) / ((x1 - x0) / 2 + BAND), Math.abs(gy + 0.5 - cy) / ((y1 - y0) / 2 + BAND))
          if (reach > grow) continue
          const on = (((gx + gy + shift) % 4) + 4) % 4 < 2
          ctx.globalAlpha = on ? 0.9 : 0.35
          ctx.fillStyle = on ? ink.on : ink.off
          ctx.fillText('╱', gx * CELL_PX + CELL_PX / 2, gy * CELL_PX + CELL_PX / 2)
        }
      ctx.globalAlpha = 1
    }
    size()
    let raf = 0
    let last = { grow: 1, shift: 0 }
    const onResize = () => (size(), draw(last.grow, last.shift))
    window.addEventListener('resize', onResize)
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
