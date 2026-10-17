// A connection between two cards: a gently curved dashed line that flows from source to target.
import { QuadraticBezierLine, type QuadraticBezierLineRef } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

type Vec2 = [number, number]

type Props = {
  from: Vec2
  to: Vec2
  color: string
  width?: number
  animate?: boolean
}

export function EdgeLine({ from, to, color, width = 1.5, animate = true }: Props) {
  const ref = useRef<QuadraticBezierLineRef>(null)

  useFrame((_, dt) => {
    const m = ref.current?.material as { dashOffset: number } | undefined
    if (m && animate) m.dashOffset -= dt * 0.4
  })

  // Bow the curve sideways by a fraction of its length.
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const mid: [number, number, number] = [(from[0] + to[0]) / 2 - dy * 0.12, (from[1] + to[1]) / 2 + dx * 0.12, -0.05]

  return (
    <QuadraticBezierLine
      ref={ref}
      start={[from[0], from[1], -0.05]}
      end={[to[0], to[1], -0.05]}
      mid={mid}
      color={color}
      lineWidth={width}
      dashed
      dashSize={0.12}
      gapSize={0.08}
      toneMapped={false}
    />
  )
}
