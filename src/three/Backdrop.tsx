// The persistent 3D layer behind all DOM views. Lives once in the app shell so
// route changes never tear down the WebGL context.
import { advance, Canvas } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { useEffect, useMemo, useState } from 'react'
import { AmbientField } from './AmbientField'
import { AsciiEffect } from './AsciiEffect'
import { FloatingCards } from './FloatingCards'

// Dev-only: step frames manually, e.g. from automation in a background tab where rAF is paused.
if (import.meta.env.DEV) {
  ;(window as unknown as { __advance: typeof advance }).__advance = advance
}

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function Ascii({ cellSize }: { cellSize: number }) {
  const effect = useMemo(() => new AsciiEffect({ cellSize }), [cellSize])
  useEffect(() => () => effect.dispose(), [effect])
  return <primitive object={effect} dispose={null} />
}

export function Backdrop({ cards = false }: { cards?: boolean }) {
  const animate = !usePrefersReducedMotion()
  const cellSize = Math.round(9 * Math.min(window.devicePixelRatio, 2))

  return (
    <Canvas
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      aria-hidden
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[-3, 4, 5]} intensity={2.2} />
      <AmbientField animate={animate} />
      {cards && <FloatingCards animate={animate} />}
      <EffectComposer multisampling={0}>
        <Ascii cellSize={cellSize} />
      </EffectComposer>
    </Canvas>
  )
}
