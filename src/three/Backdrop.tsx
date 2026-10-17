// The persistent 3D layer behind all DOM views. Lives once in the app shell so route changes
// never tear down the WebGL context. <BackdropScene> is also reused by the loading curtain,
// which draws an identical copy on top of the page (D-025).
import { advance, Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { useEffect, useMemo } from 'react'
import { MathUtils } from 'three'
import { AmbientField } from './AmbientField'
import { AsciiEffect } from './AsciiEffect'
import { backdropDim, backdropPace } from './sceneClock'

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
}

export function BackdropScene({ onFrame }: SceneProps) {
  const effect = useMemo(() => new AsciiEffect({ cellSize: cellSize() }), [])
  useEffect(() => () => effect.dispose(), [effect])

  useFrame((_, dt) => onFrame?.(effect, dt))

  return (
    <>
      <AmbientField />
      <EffectComposer multisampling={0}>
        <primitive object={effect} dispose={null} />
      </EffectComposer>
    </>
  )
}

export function Backdrop({ dim = false }: { dim?: boolean }) {
  // The field steps back in a workspace so cards stay legible: dimmer and slower (D-061).
  useEffect(() => {
    backdropDim.target = dim ? 0.18 : 1
    backdropPace.target = dim ? 0.45 : 1
  }, [dim])

  return (
    <Canvas
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
      dpr={[1, 2]}
      camera={BACKDROP_CAMERA}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      aria-hidden
      onCreated={(state) => {
        if (import.meta.env.DEV) (window as unknown as { __backdrop: typeof state }).__backdrop = state
      }}
    >
      <BackdropScene
        onFrame={(effect, dt) => {
          backdropDim.current = MathUtils.damp(backdropDim.current, backdropDim.target, 5, dt)
          effect.setDim(backdropDim.current)
        }}
      />
    </Canvas>
  )
}
