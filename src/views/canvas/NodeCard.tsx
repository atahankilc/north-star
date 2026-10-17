// One card on the board: a flat card with SDF text (D-019). Every type has the same shape; a left border and a small
// label in the type's colour say what it is (D-055). Tags (white #chips) group cards within a type (D-056).
// Editing happens in the DetailPanel.
import { Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { MathUtils, MeshBasicMaterial, Plane, Vector3, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { endMove, moveNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { colors } from '../../styles/tokens'
import { fontUrls } from '../../three/fonts'
import { BOARD_KINDS, TYPE_ACCENT, type BoardItem } from './boardKinds'
import { CARD_H, CARD_W, truncate } from './cardLayout'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'

const BOARD = new Plane(new Vector3(0, 0, 1), 0)
const hit = new Vector3()
const WRITE_EVERY_MS = 120

export function boardPoint(e: ThreeEvent<PointerEvent | MouseEvent>): [number, number] | null {
  return e.ray.intersectPlane(BOARD, hit) ? [hit.x, hit.y] : null
}

type Props = {
  wid: string
  item: BoardItem
  // Stable stacking order, so overlapping cards layer instead of z-fighting.
  layer: number
  // Tagged with the selected customer (D-044).
  related: boolean
  onLinkDrop: (targetId: string) => void
}

export function NodeCard({ wid, item: node, layer, related, onLinkDrop }: Props) {
  const type = node.type
  const W = CARD_W
  const H = CARD_H
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
  // Rendered height of the title, so notes start below it.
  const [titleH, setTitleH] = useState(0.2)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null

  const selected = useCanvas((s) => s.selectedId === node.id)
  const live = useCanvas((s) => s.dragging[node.id])
  const isLinkSource = useCanvas((s) => s.linkFrom === node.id)
  const isLinkTarget = useCanvas((s) => s.linkFrom !== null && s.linkFrom !== node.id) && hovered
  const { select, startLink, endLink, setDragging } = useCanvas.getState()

  const drag = useRef<{ dx: number; dy: number; from: [number, number]; lastWrite: number; moved: boolean } | null>(null)

  const [x, y] = live ?? [node.x, node.y]
  const accent = TYPE_ACCENT[type]

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
    drag.current = { dx: p[0] - x, dy: p[1] - y, from: [node.x, node.y], lastWrite: 0, moved: false }
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
      // One undo step for the whole drag.
      if (d.moved && final) void endMove(wid, type, node.id, d.from, final)
      setDragging(node.id, null)
    } else if (useCanvas.getState().linkFrom && !isLinkSource) {
      e.stopPropagation()
      onLinkDrop(node.id)
      endLink()
    }
    if (controls) controls.enabled = true
  }

  const rim = isLinkTarget ? colors.cyan : selected ? accent : related ? colors.cyan : hovered ? '#5a5a5a' : null
  const title = node.title.trim()
  const left = -W / 2 + 0.22
  const inner = W - 0.22 - 0.16
  const titleTop = H / 2 - 0.32
  const tags = node.tags.map((t) => `#${t}`).join('  ')
  // Notes stop above the tag and meta lines.
  const bottomLines = (tags ? 0.16 : 0) + (node.meta ? 0.16 : 0)
  const bodyTop = titleTop - titleH - 0.08
  const bodyBottom = -H / 2 + 0.14 + bottomLines

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
        {/* Edge: a hairline, or the highlight when hovered, selected, related or a link target. */}
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[W + (rim ? 0.05 : 0.02), H + (rim ? 0.05 : 0.02)]} />
          <meshBasicMaterial color={rim ?? '#2a2a2a'} toneMapped={false} />
        </mesh>
        <mesh>
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial color="#121212" toneMapped={false} />
        </mesh>
        {/* The type, at a glance: a left border and a small label. */}
        <mesh position={[-W / 2 + 0.03, 0, 0.001]}>
          <planeGeometry args={[0.06, H]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        <Text
          material={textMaterial}
          font={fontUrls.mono}
          fontSize={0.072}
          letterSpacing={0.14}
          color={accent}
          anchorX="left"
          anchorY="top"
          position={[left, H / 2 - 0.13, 0.002]}
        >
          {BOARD_KINDS[type].label.toUpperCase()}
        </Text>

        <Text
          material={textMaterial}
          font={fontUrls.display}
          fontSize={0.17}
          color={title ? colors.fg : colors.fgDim}
          anchorX="left"
          anchorY="top"
          position={[left, titleTop, 0.002]}
          maxWidth={inner}
          letterSpacing={-0.01}
          // Notes start under however many lines the title took.
          onSync={(t) => {
            const b = (t as unknown as { textRenderInfo?: { blockBounds: number[] } }).textRenderInfo?.blockBounds
            if (b) setTitleH(b[3] - b[1])
          }}
        >
          {truncate(title || 'Untitled', 48)}
        </Text>
        {node.body && bodyTop - bodyBottom > 0.1 && (
          <Text
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.09}
            lineHeight={1.45}
            color={type === 'competitor' ? colors.cyan : colors.fgDim}
            anchorX="left"
            anchorY="top"
            position={[left, bodyTop, 0.002]}
            maxWidth={inner}
            clipRect={[0, -(bodyTop - bodyBottom), W, 0.01]}
          >
            {node.body}
          </Text>
        )}
        {tags && (
          <Text
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.085}
            color={colors.fg}
            anchorX="left"
            anchorY="bottom"
            position={[left, -H / 2 + 0.14 + (node.meta ? 0.16 : 0), 0.002]}
          >
            {truncate(tags, 40)}
          </Text>
        )}
        {node.meta && (
          <Text
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.08}
            color={colors.fgDim}
            anchorX="left"
            anchorY="bottom"
            position={[left, -H / 2 + 0.14, 0.002]}
          >
            {truncate(node.meta, 42)}
          </Text>
        )}
      </group>
      <CardReveal content={content} uniforms={cell} />
    </group>
  )
}
