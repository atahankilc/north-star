// A few post-it slabs drifting in depth: a preview of the canvas, rendered through the ASCII pass.
import { Float, RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { colors } from '../styles/tokens'

const CARDS = [
  { pos: [2.6, 1.0, -1.0], rot: [0.2, -0.5, 0.1], color: colors.fg },
  { pos: [3.9, -0.4, -2.4], rot: [-0.1, -0.7, -0.08], color: colors.magenta },
  { pos: [1.4, -1.3, -0.4], rot: [0.3, -0.3, 0.15], color: colors.fg },
  { pos: [4.3, 1.9, -3.2], rot: [0.1, -0.9, 0.05], color: colors.cyan },
] as const

export function FloatingCards({ animate = true }: { animate?: boolean }) {
  const group = useRef<Group>(null)

  useFrame((state) => {
    if (!group.current) return
    // Parallax toward the pointer.
    const { x, y } = state.pointer
    group.current.rotation.y += (x * 0.15 - group.current.rotation.y) * 0.05
    group.current.rotation.x += (-y * 0.1 - group.current.rotation.x) * 0.05
  })

  return (
    <group ref={group}>
      {CARDS.map((c, i) => (
        <Float key={i} speed={animate ? 1.2 : 0} rotationIntensity={0.4} floatIntensity={0.6}>
          <RoundedBox
            args={[1.5, 1.5, 0.08]}
            radius={0.04}
            position={c.pos as unknown as [number, number, number]}
            rotation={c.rot as unknown as [number, number, number]}
          >
            <meshStandardMaterial color={c.color} roughness={0.35} metalness={0.1} />
          </RoundedBox>
        </Float>
      ))}
    </group>
  )
}
