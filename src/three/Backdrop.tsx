// The persistent backdrop behind all DOM views: ATEM's ASCII backdrop from @atem-lab/kit (D-440), the same one
// atem-lab.com draws, on a canvas of its own. Lives once in the app shell so route changes never tear it down. The
// loading curtain draws an identical copy on top of the page (D-025) with `useKitBackdrop` below.
//
// The app gives the kit its own clock (sceneTime: stepped at 30 fps, standing still under reduced motion), its theme
// and paper (usePalette), the glyphs' face, and the level each frame (stepBackdropDim): so every copy shows the same
// frame, and nothing is drawn between changes (D-063).
import { backdrop, type Backdrop as KitBackdrop, type BackdropOptions } from '@atem-lab/kit/backdrop.js'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { usePalette, useTheme } from '../state/theme'
import { fonts } from '../styles/tokens'
import { backdropDim, backdropSettled, sceneTime, setBackdropTarget, stepBackdropDim } from './sceneClock'

type Extra = Pick<BackdropOptions, 'field' | 'transparent'>

// Draws the kit's backdrop on `canvas` while mounted. `transparent` is read once, at the start; `field`, the theme and
// the paper follow. `onFrame` runs every animation frame before drawing.
export function useKitBackdrop(canvas: RefObject<HTMLCanvasElement | null>, extra: Extra, onFrame: (b: KitBackdrop) => void) {
  const theme = useTheme((s) => s.theme)
  const palette = usePalette()
  const handle = useRef<KitBackdrop | null>(null)
  const frame = useRef(onFrame)
  useEffect(() => {
    frame.current = onFrame
  })
  const first = useRef({ theme, background: palette.bg, field: extra.field ?? true, transparent: extra.transparent ?? false })
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const b = backdrop(el, { ...first.current, font: fonts.mono, clock: sceneTime, onFrame: (k) => frame.current(k) })
    handle.current = b
    return () => {
      b.stop()
      handle.current = null
    }
  }, [canvas])
  useEffect(() => {
    handle.current?.set({ theme, background: palette.bg, field: extra.field ?? true })
  }, [theme, palette.bg, extra.field])
}

// `level` is how much of the field shows (D-385): 1 full, 0 none. A change fades over DUR.backdropFade; once it has
// faded to 0 the canvas itself goes (its WebGL context and its frame loop), so a full canvas of pieces pays nothing
// for it, and it comes back, fading in from nothing, when the level rises again.
export function Backdrop({ level = 1 }: { level?: number }) {
  const [live, setLive] = useState(level > 0)
  useEffect(() => {
    setBackdropTarget(level)
    if (level > 0) setLive(true)
  }, [level])
  if (!live) return null
  return <BackdropCanvas onGone={() => setLive(false)} />
}

function BackdropCanvas({ onGone }: { onGone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const going = useRef(false)
  useKitBackdrop(canvas, {}, (b) => {
    b.set({ dim: stepBackdropDim() })
    // Faded out: the canvas goes on the next tick, outside the frame loop.
    if (backdropDim.target === 0 && backdropSettled() && !going.current) {
      going.current = true
      window.setTimeout(() => {
        if (backdropDim.target === 0) onGone()
        else going.current = false
      })
    }
  })
  return <canvas ref={canvas} style={{ position: 'fixed', inset: 0, zIndex: 0, width: '100%', height: '100%', display: 'block' }} aria-hidden />
}
