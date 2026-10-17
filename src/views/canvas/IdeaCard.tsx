// One post-it on the board: a lit slab with SDF text (D-019). Editing happens in the DetailPanel.
import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { MathUtils, Plane, Vector3, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { moveIdea } from '../../data/ideas'
import type { Idea } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { colors } from '../../styles/tokens'
import { fontUrls } from '../../three/fonts'
import { CARD_H, CARD_W, truncate } from './cardLayout'

const BOARD = new Plane(new Vector3(0, 0, 1), 0)
const hit = new Vector3()
const WRITE_EVERY_MS = 120

export function boardPoint(e: ThreeEvent<PointerEvent | MouseEvent>): [number, number] | null {
  return e.ray.intersectPlane(BOARD, hit) ? [hit.x, hit.y] : null
}

type Props = {
  wid: string
  idea: WithId<Idea>
  // Stable stacking order, so overlapping cards layer instead of z-fighting.
  layer: number
  onLinkDrop: (targetId: string) => void
}

export function IdeaCard({ wid, idea, layer, onLinkDrop }: Props) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null

  const selected = useCanvas((s) => s.selectedId === idea.id)
  const live = useCanvas((s) => s.dragging[idea.id])
  const isLinkSource = useCanvas((s) => s.linkFrom === idea.id)
  const isLinkTarget = useCanvas((s) => s.linkFrom !== null && s.linkFrom !== idea.id) && hovered
  const { select, startLink, endLink, setDragging } = useCanvas.getState()

  const drag = useRef<{ dx: number; dy: number; lastWrite: number; moved: boolean } | null>(null)

  const [x, y] = live ?? [idea.x, idea.y]
  const accent = idea.color ?? colors.fg

  // Glide toward the target position (remote moves animate too) and lift on hover/drag.
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const lift = (drag.current ? 0.45 : hovered || selected ? 0.14 : 0) + layer * 0.004
    const k = drag.current ? 40 : 12
    g.position.x = MathUtils.damp(g.position.x, x, k, dt)
    g.position.y = MathUtils.damp(g.position.y, y, k, dt)
    g.position.z = MathUtils.damp(g.position.z, lift, 10, dt)
    const s = drag.current ? 1.04 : 1
    g.scale.setScalar(MathUtils.damp(g.scale.x, s, 10, dt))
  })

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    // Runs before OrbitControls' own listener, so the board doesn't pan.
    if (controls) controls.enabled = false
    const p = boardPoint(e)
    if (!p) return
    select(idea.id)
    if (e.shiftKey) {
      startLink(idea.id, p)
      return
    }
    drag.current = { dx: p[0] - x, dy: p[1] - y, lastWrite: 0, moved: false }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    const p = boardPoint(e)
    if (!p) return
    const next: [number, number] = [p[0] - d.dx, p[1] - d.dy]
    d.moved = true
    setDragging(idea.id, next)
    // Stream the move so collaborators see it live, without a write per frame.
    const now = performance.now()
    if (now - d.lastWrite > WRITE_EVERY_MS) {
      d.lastWrite = now
      void moveIdea(wid, idea.id, next[0], next[1])
    }
  }

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (d) {
      e.stopPropagation()
      drag.current = null
      ;(e.target as Element).releasePointerCapture(e.pointerId)
      const final = useCanvas.getState().dragging[idea.id]
      if (d.moved && final) void moveIdea(wid, idea.id, final[0], final[1])
      setDragging(idea.id, null)
    } else if (useCanvas.getState().linkFrom && !isLinkSource) {
      e.stopPropagation()
      onLinkDrop(idea.id)
      endLink()
    }
    if (controls) controls.enabled = true
  }

  const rim = isLinkTarget ? colors.cyan : selected ? accent : hovered ? '#3a3a3a' : null
  const title = idea.title.trim()
  const tags = (idea.tags ?? []).map((t) => `#${t}`).join('  ')

  return (
    <group
      ref={group}
      position={[x, y, 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = e.shiftKey ? 'crosshair' : 'grab'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = ''
      }}
    >
      {rim && (
        <mesh position={[0, 0, -0.04]}>
          <planeGeometry args={[CARD_W + 0.06, CARD_H + 0.06]} />
          <meshBasicMaterial color={rim} toneMapped={false} />
        </mesh>
      )}
      <RoundedBox args={[CARD_W, CARD_H, 0.06]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#121212" roughness={0.7} metalness={0.05} />
      </RoundedBox>
      {/* Accent strip along the top edge. */}
      <mesh position={[0, CARD_H / 2 - 0.02, 0.031]}>
        <planeGeometry args={[CARD_W, 0.04]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>

      <Text
        font={fontUrls.display}
        fontSize={0.17}
        color={title ? colors.fg : colors.fgDim}
        anchorX="left"
        anchorY="top"
        position={[-CARD_W / 2 + 0.18, CARD_H / 2 - 0.2, 0.032]}
        maxWidth={CARD_W - 0.36}
        letterSpacing={-0.01}
      >
        {truncate(title || 'Untitled', 26)}
      </Text>
      {idea.body && (
        <Text
          font={fontUrls.mono}
          fontSize={0.095}
          lineHeight={1.45}
          color={colors.fgDim}
          anchorX="left"
          anchorY="top"
          position={[-CARD_W / 2 + 0.18, CARD_H / 2 - 0.5, 0.032]}
          maxWidth={CARD_W - 0.36}
          clipRect={[0, -(CARD_H - 0.85), CARD_W, 0.01]}
        >
          {idea.body}
        </Text>
      )}
      {tags && (
        <Text
          font={fontUrls.mono}
          fontSize={0.085}
          color={idea.color ?? colors.cyan}
          anchorX="left"
          anchorY="bottom"
          position={[-CARD_W / 2 + 0.18, -CARD_H / 2 + 0.14, 0.032]}
        >
          {truncate(tags, 40)}
        </Text>
      )}
    </group>
  )
}
