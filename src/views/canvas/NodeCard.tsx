// One card on the board: a lit slab with SDF text (D-019), shaped by its type (D-051, cardShapes.ts).
// Editing happens in the DetailPanel.
import { Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { MathUtils, MeshBasicMaterial, Plane, Shape, Vector3, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { endMove, moveNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { colors } from '../../styles/tokens'
import { fontUrls } from '../../three/fonts'
import { BOARD_KINDS, TYPE_ACCENT, type BoardItem } from './boardKinds'
import { truncate } from './cardLayout'
import { CARD_SIZE, DOG_EAR, outlineGeometry, slabGeometry, TEXT_INSET } from './cardShapes'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'

const BOARD = new Plane(new Vector3(0, 0, 1), 0)
const hit = new Vector3()
const WRITE_EVERY_MS = 120

// The problem card's folded corner: the flap inside the cut.
const dogEar = (() => {
  const t = new Shape()
  t.moveTo(-DOG_EAR / 2, -DOG_EAR / 2)
  t.lineTo(DOG_EAR / 2, -DOG_EAR / 2)
  t.lineTo(-DOG_EAR / 2, DOG_EAR / 2)
  t.closePath()
  return t
})()

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
  const meta = node.meta
  const [W, H] = CARD_SIZE[type]
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

  const rim = isLinkTarget ? colors.cyan : selected ? accent : related ? colors.cyan : hovered ? colors.fg : null
  const title = node.title.trim()
  const mark = BOARD_KINDS[type].mark
  const left = -W / 2 + TEXT_INSET[type]
  const inner = W - TEXT_INSET[type] * 2
  // Short shapes (pill, tag) carry a title and one meta line; the rest also show notes.
  const tall = H > 1.2
  const maxChars = Math.floor(inner / 0.092)
  const titleTop = H / 2 - 0.22

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
        {/* Competitor: an outer rim with a dark gap, so its edge reads double. */}
        {type === 'competitor' && (
          <>
            <mesh position={[0, 0, -0.06]} geometry={outlineGeometry(type, 0.11)}>
              <meshBasicMaterial color={rim ?? accent} transparent opacity={rim ? 1 : 0.6} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, -0.055]} geometry={outlineGeometry(type, 0.08)}>
              <meshBasicMaterial color="#000000" toneMapped={false} />
            </mesh>
          </>
        )}
        {/* The outline is always there in the type's colour; it brightens on hover, selection and link targets. */}
        <mesh position={[0, 0, -0.04]} geometry={outlineGeometry(type, 0.035)}>
          <meshBasicMaterial color={rim ?? accent} transparent opacity={rim ? 1 : 0.6} toneMapped={false} />
        </mesh>
        <mesh geometry={slabGeometry(type)}>
          <meshStandardMaterial color="#121212" roughness={0.7} metalness={0.05} />
        </mesh>
        {type === 'problem' && (
          // The folded corner.
          <mesh position={[W / 2 - DOG_EAR / 2, H / 2 - DOG_EAR / 2, 0.031]}>
            <shapeGeometry args={[dogEar]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
        )}
        {type === 'idea' && (
          // Post-it strip along the top edge.
          <mesh position={[0, H / 2 - 0.03, 0.031]}>
            <planeGeometry args={[W - 0.08, 0.06]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
        )}

        <Text
          material={textMaterial}
          font={fontUrls.display}
          fontSize={0.17}
          color={title ? colors.fg : colors.fgDim}
          anchorX="left"
          // Short cards: the title grows upward from just above the meta line, so two lines never meet it.
          anchorY={tall ? 'top' : meta ? 'bottom' : 'middle'}
          position={[left, tall ? titleTop : meta ? 0.01 : 0, 0.032]}
          maxWidth={inner - (type === 'problem' ? DOG_EAR : 0)}
          letterSpacing={-0.01}
          // Notes start under however many lines the title took.
          onSync={(t) => {
            const b = (t as unknown as { textRenderInfo?: { blockBounds: number[] } }).textRenderInfo?.blockBounds
            if (b) setTitleH(b[3] - b[1])
          }}
        >
          {mark + truncate(title || 'Untitled', tall ? 48 : 40)}
        </Text>
        {tall && node.body && (
          <Text
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.095}
            lineHeight={1.45}
            color={type === 'competitor' ? colors.cyan : colors.fgDim}
            anchorX="left"
            anchorY="top"
            position={[left, titleTop - titleH - 0.1, 0.032]}
            maxWidth={inner}
            // Stop above the meta line.
            clipRect={[0, -(titleTop - titleH - 0.1 + H / 2 - 0.3), W, 0.01]}
          >
            {node.body}
          </Text>
        )}
        {meta && (
          <Text
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.085}
            color={node.color ?? (type === 'idea' ? colors.cyan : accent)}
            anchorX="left"
            anchorY={tall ? 'bottom' : 'top'}
            position={[left, tall ? -H / 2 + 0.14 : -0.07, 0.032]}
          >
            {truncate(meta, maxChars)}
          </Text>
        )}
      </group>
      <CardReveal content={content} uniforms={cell} />
    </group>
  )
}
