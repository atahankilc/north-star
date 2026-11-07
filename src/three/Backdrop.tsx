// The persistent 3D layer behind all DOM views. Lives once in the app shell so route changes
// never tear down the WebGL context. <BackdropScene> is also reused by the loading curtain,
// which draws an identical copy on top of the page (D-025).
import { advance, Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePalette, useTheme } from '../state/theme'
import { AmbientField } from './AmbientField'
import { AsciiEffect } from './AsciiEffect'
import { backdropDim, backdropSettled, introNight, sceneTime, setBackdropTarget, stepBackdropDim } from './sceneClock'

// Dev-only: step frames manually, e.g. from automation in a background tab where rAF is paused.
if (import.meta.env.DEV) {
  ;(window as unknown as { __advance: typeof advance }).__advance = advance
}

export const BACKDROP_CAMERA = { position: [0, 0, 6] as [number, number, number], fov: 45 }

// A cell is 9 device pixels, not 9 CSS pixels: on a 2x screen the glyphs come out half as big and the field twice as
// fine, the look the user wants. It also stays the same when the window moves to a screen with another pixel ratio.
export function cellSize() {
  return 9
}

type SceneProps = {
  // Called every frame with this canvas's ASCII pass, before rendering.
  onFrame?: (effect: AsciiEffect, dt: number) => void
  // Without the field the pass draws only empty cells, so the curtain can still rebuild the page out of black.
  field?: boolean
}

export function BackdropScene({ onFrame, field = true }: SceneProps) {
  const effect = useMemo(() => new AsciiEffect({ cellSize: cellSize() }), [])
  useEffect(() => () => effect.dispose(), [effect])
  const theme = useTheme((s) => s.theme)
  const palette = usePalette()
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    effect.setTheme(theme === 'light', palette.bg, palette.night, palette.dusk)
    invalidate()
  }, [effect, theme, palette, invalidate])

  // Priority 1 takes over rendering from R3F: the field goes into the per-cell target, then the glyphs to the screen.
  useFrame(({ gl, scene, camera }, dt) => {
    onFrame?.(effect, dt)
    // Without the field there's no sky to darken, so the curtain still rebuilds out of plain paper.
    const { sweepIn, sweepOut } = introNight()
    effect.setNight(field ? sweepIn : 0, sweepOut)
    effect.resize(gl)
    effect.render(gl, scene, camera)
  }, 1)

  return field ? <AmbientField uvScale={effect.uvScale} /> : null
}

// Renders only when there is something new to show (D-063): a new step of the scene clock, or the level fading.
// Under reduced motion the clock stands still, so the backdrop costs nothing between changes.
function Pace() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let raf = 0
    let last = -1
    const tick = () => {
      const t = sceneTime()
      if (t !== last || !backdropSettled()) {
        last = t
        invalidate()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [invalidate])
  return null
}

// `level` is how much of the field shows (D-385): 1 full, 0 none. A change fades over DUR.backdropFade; once it has
// faded to 0 the canvas itself goes (its WebGL context, its frame loop, its rAF), so a full canvas of pieces pays nothing
// for it, and it comes back, fading in from nothing, when the level rises again.
export function Backdrop({ level = 1 }: { level?: number }) {
  const [live, setLive] = useState(level > 0)
  useEffect(() => {
    setBackdropTarget(level)
    if (level > 0) setLive(true)
  }, [level])
  const going = useRef(false)

  if (!live) return null
  return (
    <Canvas
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
      dpr={[1, 2]}
      frameloop="demand"
      camera={BACKDROP_CAMERA}
      // A slow ambient field doesn't need the discrete GPU on dual-GPU machines.
      gl={{ antialias: false, powerPreference: 'low-power' }}
      aria-hidden
      onCreated={(state) => {
        going.current = false
        if (import.meta.env.DEV) (window as unknown as { __backdrop: typeof state }).__backdrop = state
      }}
    >
      <Pace />
      <BackdropScene
        onFrame={(effect) => {
          effect.setDim(stepBackdropDim())
          // Faded out: the canvas goes on the next tick, outside the render loop.
          if (backdropDim.target === 0 && backdropSettled() && !going.current) {
            going.current = true
            window.setTimeout(() => {
              if (backdropDim.target === 0) setLive(false)
              else going.current = false
            })
          }
        }}
      />
    </Canvas>
  )
}
