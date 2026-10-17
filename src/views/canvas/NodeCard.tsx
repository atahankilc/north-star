// One card on the board: a lit slab with SDF text (D-019), shaped by its type (docs/specs/domains.md §4).
// Editing happens in the DetailPanel.
import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { MathUtils, MeshBasicMaterial, Plane, Shape, Vector3, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { moveNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { colors } from '../../styles/tokens'
import { fontUrls } from '../../three/fonts'
import { BOARD_KINDS, TYPE_ACCENT, type BoardItem } from './boardKinds'
import { CARD_H, cardWidth, truncate } from './cardLayout'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'

const BOARD = new Plane(new Vector3(0, 0, 1), 0)
const hit = new Vector3()
const WRITE_EVERY_MS = 120

export function boardPoint(e: ThreeEvent<PointerEvent | MouseEvent>): [number, number] | null {
  return e.ray.intersectPlane(BOARD, hit) ? [hit.x, hit.y] : null
}

// Customers are the one card with soft corners.
function roundedRect(w: number, h: number, r: number) {
  const s = new Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2)
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  s.lineTo(w / 2, h / 2 - r)
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  s.lineTo(-w / 2 + r, h / 2)
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  s.lineTo(-w / 2, -h / 2 + r)
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  return s
}

type Props = {
  wid: string
  item: BoardItem
  // Stable stacking order, so overlapping cards layer instead of z-fighting.
  layer: number
  // Tagged with the selected customer (D-044).
  related: boolean
  // Shown on the `all` tab for items without a domain.
  unsorted: boolean
  onLinkDrop: (targetId: string) => void
}

export function NodeCard({ wid, item: node, layer, related, unsorted, onLinkDrop }: Props) {
  const type = node.type
  const meta = node.meta
  const W = cardWidth(type)
  const group = useRef<Group>(null)
  const content = useRef<Group>(null)
  // Cell-by-cell entrance (D-034): shared by all of this card's materials. Text gets its own base
  // material so the reveal doesn't leak into troika's shared default.
  const cell = useMemo(makeCellUniforms, [])
  const textMaterial = useMemo(() => {
    const m = new MeshBasicMaterial()
    installCellReveal(m, cell)
    return m
  }, [cell])
  const [hovered, setHovered] = useState(false)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null

  const selected = useCanvas((s) => s.selectedId === node.id)
  const live = useCanvas((s) => s.dragging[node.id])
  const isLinkSource = useCanvas((s) => s.linkFrom === node.id)
  const isLinkTarget = useCanvas((s) => s.linkFrom !== null && s.linkFrom !== node.id) && hovered
  const { select, startLink, endLink, setDragging } = useCanvas.getState()

  const drag = useRef<{ dx: number; dy: number; lastWrite: number; moved: boolean } | null>(null)

  const [x, y] = live ?? [node.x, node.y]
  const accent = node.color ?? TYPE_ACCENT[type]

  // Glide toward the target position (remote moves animate too) and lift on hover/drag.
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const lift = (drag.current ? 0.45 : hovered || selected ? 0.14 : related ? 0.07 : 0) + layer * 0.004
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
    select(node.id)
    if (e.shiftKey) {
      startLink(node.id, p)
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
    setDragging(node.id, next)
    // Stream the move so collaborators see it live, without a write per frame.
    const now = performance.now()
    if (now - d.lastWrite > WRITE_EVERY_MS) {
      d.lastWrite = now
      void moveNode(wid, type, node.id, next[0], next[1])
    }
  }

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (d) {
      e.stopPropagation()
      drag.current = null
      ;(e.target as Element).releasePointerCapture(e.pointerId)
      const final = useCanvas.getState().dragging[node.id]
      if (d.moved && final) void moveNode(wid, type, node.id, final[0], final[1])
      setDragging(node.id, null)
    } else if (useCanvas.getState().linkFrom && !isLinkSource) {
      e.stopPropagation()
      onLinkDrop(node.id)
      endLink()
    }
    if (controls) controls.enabled = true
  }

  const rim = isLinkTarget ? colors.cyan : selected ? accent : related ? colors.cyan : hovered ? '#3a3a3a' : null
  const title = node.title.trim()
  const mark = BOARD_KINDS[type].mark
  const left = -W / 2 + 0.18
  const customerShape = useMemo(() => (type === 'customer' ? roundedRect(W, CARD_H, 0.22) : null), [type, W])
  const customerRim = useMemo(() => (type === 'customer' ? roundedRect(W + 0.06, CARD_H + 0.06, 0.25) : null), [type, W])

  return (
    <group
      ref={group}
      position={[x, y, 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      // The board under the card deselects on click; keep this click to the card.
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
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
      <group ref={content}>
        {type === 'customer' && customerShape && customerRim ? (
          <>
            {rim && (
              <mesh position={[0, 0, -0.04]}>
                <shapeGeometry args={[customerRim, 8]} />
                <meshBasicMaterial color={rim} toneMapped={false} />
              </mesh>
            )}
            <mesh position={[0, 0, 0.03]}>
              <shapeGeometry args={[customerShape, 8]} />
              <meshStandardMaterial color="#121212" roughness={0.7} metalness={0.05} />
            </mesh>
            {/* A short accent tick instead of a strip: the soft corners would cut a full one. */}
            <mesh position={[left + 0.2, CARD_H / 2 - 0.02, 0.031]}>
              <planeGeometry args={[0.4, 0.04]} />
              <meshBasicMaterial color={accent} toneMapped={false} />
            </mesh>
          </>
        ) : (
          <>
            {type === 'competitor' && (
              // Double rim: two accent lines with a dark gap.
              <>
                <mesh position={[0, 0, -0.06]}>
                  <planeGeometry args={[W + 0.2, CARD_H + 0.2]} />
                  <meshBasicMaterial color={rim ?? accent} transparent opacity={rim ? 1 : 0.45} toneMapped={false} />
                </mesh>
                <mesh position={[0, 0, -0.055]}>
                  <planeGeometry args={[W + 0.16, CARD_H + 0.16]} />
                  <meshBasicMaterial color="#000000" toneMapped={false} />
                </mesh>
              </>
            )}
            {(rim || type === 'competitor') && (
              <mesh position={[0, 0, -0.04]}>
                <planeGeometry args={[W + 0.06, CARD_H + 0.06]} />
                <meshBasicMaterial color={rim ?? accent} transparent opacity={rim ? 1 : 0.45} toneMapped={false} />
              </mesh>
            )}
            <RoundedBox args={[W, CARD_H, 0.06]} radius={0.025} smoothness={2}>
              <meshStandardMaterial color="#121212" roughness={0.7} metalness={0.05} />
            </RoundedBox>
            {/* Accent along the top edge: a wide band marks a problem. */}
            {type === 'problem' ? (
              <mesh position={[0, CARD_H / 2 - 0.08, 0.031]}>
                <planeGeometry args={[W, 0.16]} />
                <meshBasicMaterial color={accent} toneMapped={false} />
              </mesh>
            ) : (
              type !== 'competitor' && (
                <mesh position={[0, CARD_H / 2 - 0.02, 0.031]}>
                  <planeGeometry args={[W, 0.04]} />
                  <meshBasicMaterial color={accent} toneMapped={false} />
                </mesh>
              )
            )}
          </>
        )}

        <Text
          material={textMaterial}
          font={fontUrls.display}
          fontSize={0.17}
          color={title ? colors.fg : colors.fgDim}
          anchorX="left"
          anchorY="top"
          position={[left, CARD_H / 2 - (type === 'problem' ? 0.26 : 0.2), 0.032]}
          maxWidth={W - 0.36}
          letterSpacing={-0.01}
        >
          {mark + truncate(title || 'Untitled', type === 'competitor' ? 34 : 26)}
        </Text>
        {node.body && (
          <Text
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.095}
            lineHeight={1.45}
            color={type === 'competitor' ? colors.cyan : colors.fgDim}
            anchorX="left"
            anchorY="top"
            position={[left, CARD_H / 2 - 0.5, 0.032]}
            maxWidth={W - 0.36}
            clipRect={[0, -(CARD_H - 0.85), W, 0.01]}
          >
            {node.body}
          </Text>
        )}
        {meta && (
          <Text
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.085}
            color={node.color ?? colors.cyan}
            anchorX="left"
            anchorY="bottom"
            position={[left, -CARD_H / 2 + 0.14, 0.032]}
          >
            {truncate(meta, (type === 'competitor' ? 52 : 40) - (unsorted ? 11 : 0))}
          </Text>
        )}
        {unsorted && (
          <Text
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.075}
            color={colors.fgDim}
            anchorX="right"
            anchorY="bottom"
            position={[W / 2 - 0.18, -CARD_H / 2 + 0.14, 0.032]}
          >
            unsorted
          </Text>
        )}
      </group>
      <CardReveal content={content} uniforms={cell} />
    </group>
  )
}
