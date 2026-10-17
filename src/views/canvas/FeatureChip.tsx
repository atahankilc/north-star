// One of a competitor's features on the board (D-058): a compressed card that slides out of the competitor's stack when
// it's selected. Click to open it in the competitor's panel; shift+drag a card onto it to link to it.
import { Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { MathUtils, type Group } from 'three'
import type { WithId } from '../../data/hooks'
import type { CompetitorFeature } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { usePalette } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { glideDt, truncate } from './cardLayout'

export const CHIP_W = 2
export const CHIP_H = 0.42

type Props = {
  feature: WithId<CompetitorFeature>
  // Where it sits when open, and where it slides out from (the competitor's centre).
  at: [number, number]
  from: [number, number]
  onLinkDrop: (targetId: string) => void
}

export function FeatureChip({ feature, at, from, onLinkDrop }: Props) {
  const group = useRef<Group>(null)
  const selected = useCanvas((s) => s.selectedId === feature.id)
  const linking = useCanvas((s) => s.linkFrom !== null)
  const [hovered, setHovered] = useState(false)
  const { select, endLink } = useCanvas.getState()
  const started = useRef(false)

  // Slide out from behind the competitor.
  useFrame(({ invalidate }, delta) => {
    const dt = glideDt(delta)
    const g = group.current
    if (!g) return
    if (!started.current) {
      g.position.set(from[0], from[1], 0.2)
      started.current = true
    }
    g.position.x = MathUtils.damp(g.position.x, at[0], 14, dt)
    g.position.y = MathUtils.damp(g.position.y, at[1], 14, dt)
    if (Math.abs(g.position.x - at[0]) > 1e-4 || Math.abs(g.position.y - at[1]) > 1e-4) invalidate()
  })

  const colors = usePalette()
  const edge = selected ? colors.yellow : linking && hovered ? colors.cyan : hovered ? colors.hover : colors.hairline

  return (
    <group
      ref={group}
      position={[from[0], from[1], 0.2]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (e.button !== 0) return
        e.stopPropagation()
        if (!useCanvas.getState().linkFrom) select(feature.id)
      }}
      onPointerUp={(e) => {
        if (!useCanvas.getState().linkFrom) return
        e.stopPropagation()
        onLinkDrop(feature.id)
        endLink()
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = ''
      }}
    >
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[CHIP_W + 0.02, CHIP_H + 0.02]} />
        <meshBasicMaterial color={edge} toneMapped={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[CHIP_W, CHIP_H]} />
        <meshBasicMaterial color={colors.chip} toneMapped={false} />
      </mesh>
      <mesh position={[-CHIP_W / 2 + 0.02, 0, 0.001]}>
        <planeGeometry args={[0.04, CHIP_H]} />
        <meshBasicMaterial color={colors.yellow} transparent opacity={0.6} toneMapped={false} />
      </mesh>
      <Text
        font={fontUrls.mono}
        fontSize={0.1}
        color={colors.fg}
        anchorX="left"
        anchorY="middle"
        position={[-CHIP_W / 2 + 0.14, 0, 0.002]}
        maxWidth={CHIP_W - 0.7}
      >
        {truncate(feature.name || 'Untitled', 24)}
      </Text>
      {feature.category && (
        <Text
          font={fontUrls.mono}
          fontSize={0.07}
          letterSpacing={0.08}
          color={colors.fgDim}
          anchorX="right"
          anchorY="middle"
          position={[CHIP_W / 2 - 0.12, 0, 0.002]}
        >
          {truncate(feature.category.toUpperCase(), 12)}
        </Text>
      )}
    </group>
  )
}
