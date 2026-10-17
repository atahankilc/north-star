// The persistent 3D layer behind all DOM views. Lives once in the app shell so route changes
// never tear down the WebGL context. <BackdropScene> is also reused by the loading curtain,
// which draws an identical copy on top of the page (D-025).
import { advance, Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { MathUtils } from 'three'
import { useTheme } from '../state/theme'
import { palettes } from '../styles/tokens'
import { AmbientField } from './AmbientField'
import { AsciiEffect } from './AsciiEffect'
import { backdropDim, sceneTime } from './sceneClock'

// Dev-only: step frames manually, e.g. from automation in a background tab where rAF is paused.
if (import.meta.env.DEV) {
  ;(window as unknown as { __advance: typeof advance }).__advance = advance
}

export const BACKDROP_CAMERA = { position: [0, 0, 6] as [number, number, number], fov: 45 }

export function cellSize() {
  return Math.round(9 * Math.min(window.devicePixelRatio, 2))
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
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    effect.setTheme(theme === 'light', palettes[theme].bg)
    invalidate()
  }, [effect, theme, invalidate])

  // Priority 1 takes over rendering from R3F: the field goes into the per-cell target, then the glyphs to the screen.
  useFrame(({ gl, scene, camera }, dt) => {
    onFrame?.(effect, dt)
    effect.resize(gl)
    effect.render(gl, scene, camera)
  }, 1)

  return field ? <AmbientField uvScale={effect.uvScale} /> : null
}

// Renders only when there is something new to show (D-063): a new step of the scene clock, or the dim easing.
// Under reduced motion the clock stands still, so the backdrop costs nothing between changes.
function Pace() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let raf = 0
    let last = -1
    const tick = () => {
      const t = sceneTime()
      if (t !== last || Math.abs(backdropDim.current - backdropDim.target) > 0.001) {
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

export function Backdrop({ dim = false }: { dim?: boolean }) {
  // The field steps back in a workspace so cards stay legible (D-061).
  useEffect(() => {
    backdropDim.target = dim ? 0.14 : 1
  }, [dim])

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
        if (import.meta.env.DEV) (window as unknown as { __backdrop: typeof state }).__backdrop = state
      }}
    >
      <Pace />
      <BackdropScene
        onFrame={(effect, dt) => {
          backdropDim.current = MathUtils.damp(backdropDim.current, backdropDim.target, 5, dt)
          effect.setDim(backdropDim.current)
        }}
      />
    </Canvas>
  )
}
