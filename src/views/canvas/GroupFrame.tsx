// A group on the board (Q-012, D-047): a labelled frame behind the cards. Drag the label to move it with everything
// inside; drag the corner to resize; click the label to edit it in the side panel.
import { Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { MathUtils, MeshBasicMaterial, type Group as ThreeGroup } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { endGroupMove, moveGroupLive, updateGroup, type Passenger } from '../../data/groups'
import type { Group } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { colors } from '../../styles/tokens'
import { fontUrls } from '../../three/fonts'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'
import { truncate } from './cardLayout'
import { boardPoint } from './NodeCard'

const LABEL_H = 0.4
const EDGE = 0.014
const HANDLE = 0.22
const MIN_W = 2
const MIN_H = 1.2
const WRITE_EVERY_MS = 120

type Props = {
  wid: string
  group: WithId<Group>
  // Who rides along when this frame moves (cards and smaller frames inside it, at drag start).
  passengersOf: (group: WithId<Group>) => Passenger[]
}

export function GroupFrame({ wid, group, passengersOf }: Props) {
  const content = useRef<ThreeGroup>(null)
  const cell = useMemo(makeCellUniforms, [])
  const textMaterial = useMemo(() => {
    const m = new MeshBasicMaterial()
    installCellReveal(m, cell)
    return m
  }, [cell])
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const selected = useCanvas((s) => s.selectedId === group.id)
  const live = useCanvas((s) => s.dragging[group.id])
  const { select, setDragging } = useCanvas.getState()
  const [hovered, setHovered] = useState(false)
  // While resizing: the live size, ahead of Firestore.
  const [size, setSize] = useState<[number, number] | null>(null)

  const drag = useRef<{ start: [number, number]; riders: Passenger[]; lastWrite: number; moved: boolean } | null>(null)
  const resize = useRef<{ corner: [number, number] } | null>(null)

  const [x, y] = live ?? [group.x, group.y]
  const [w, h] = size ?? [group.w, group.h]
  const accent = group.color ?? colors.fgDim
  const outer = useRef<ThreeGroup>(null)

  // Remote moves glide like cards do.
  useFrame((_, dt) => {
    const g = outer.current
    if (!g) return
    const k = drag.current ? 40 : 12
    g.position.x = MathUtils.damp(g.position.x, x, k, dt)
    g.position.y = MathUtils.damp(g.position.y, y, k, dt)
  })

  const grab = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return false
    e.stopPropagation()
    if (controls) controls.enabled = false
    ;(e.target as Element).setPointerCapture(e.pointerId)
    return true
  }

  const release = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    if (controls) controls.enabled = true
  }

  // ── move by the label ──
  const onLabelDown = (e: ThreeEvent<PointerEvent>) => {
    if (!grab(e)) return
    const p = boardPoint(e)
    if (!p) return
    select(group.id)
    drag.current = { start: p, riders: passengersOf(group), lastWrite: 0, moved: false }
  }

  const onLabelMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    const p = boardPoint(e)
    if (!p) return
    const delta: [number, number] = [p[0] - d.start[0], p[1] - d.start[1]]
    d.moved = true
    for (const r of d.riders) setDragging(r.id, [r.from[0] + delta[0], r.from[1] + delta[1]])
    const now = performance.now()
    if (now - d.lastWrite > WRITE_EVERY_MS) {
      d.lastWrite = now
      void moveGroupLive(wid, d.riders, delta)
    }
  }

  const onLabelUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    release(e)
    drag.current = null
    // Measured from where the drag started: the live stream has already moved `group` part of the way.
    const end = useCanvas.getState().dragging[group.id]
    const self = d.riders[0]
    if (d.moved && end) void endGroupMove(wid, d.riders, [end[0] - self.from[0], end[1] - self.from[1]])
    for (const r of d.riders) setDragging(r.id, null)
  }

  // ── resize by the bottom-right corner; the top-left corner stays put ──
  const onHandleDown = (e: ThreeEvent<PointerEvent>) => {
    if (!grab(e)) return
    select(group.id)
    resize.current = { corner: [group.x - group.w / 2, group.y + group.h / 2] }
  }

  const onHandleMove = (e: ThreeEvent<PointerEvent>) => {
    const r = resize.current
    if (!r) return
    const p = boardPoint(e)
    if (!p) return
    setSize([Math.max(MIN_W, p[0] - r.corner[0]), Math.max(MIN_H, r.corner[1] - p[1])])
  }

  const onHandleUp = (e: ThreeEvent<PointerEvent>) => {
    const r = resize.current
    if (!r) return
    release(e)
    resize.current = null
    if (size) {
      const [nw, nh] = size
      void updateGroup(wid, group.id, { w: nw, h: nh, x: r.corner[0] + nw / 2, y: r.corner[1] - nh / 2 }).finally(() => setSize(null))
    }
  }

  // While resizing, keep the top-left corner fixed on screen.
  const offset: [number, number] = size ? [(w - group.w) / 2, -(h - group.h) / 2] : [0, 0]
  const active = selected || hovered
  const edgeColor = selected ? accent === colors.fgDim ? colors.fg : accent : active ? '#5a5a5a' : '#3a3a3a'
  const name = group.name.trim()

  return (
    <group ref={outer} position={[x, y, -0.08]}>
      <group ref={content} position={[offset[0], offset[1], 0]}>
        {/* Fill: no handlers, so the board under it still pans and takes double-clicks. */}
        <mesh>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color={accent} transparent opacity={0.035} depthWrite={false} toneMapped={false} />
        </mesh>
        {[
          [0, h / 2, w, EDGE],
          [0, -h / 2, w, EDGE],
          [-w / 2, 0, EDGE, h],
          [w / 2, 0, EDGE, h],
        ].map(([ex, ey, ew, eh], i) => (
          <mesh key={i} position={[ex, ey, 0.001]}>
            <planeGeometry args={[ew, eh]} />
            <meshBasicMaterial color={edgeColor} toneMapped={false} />
          </mesh>
        ))}

        {/* Label strip along the top edge: the handle for moving and selecting. */}
        <mesh
          position={[0, h / 2 - LABEL_H / 2, 0.002]}
          onPointerDown={onLabelDown}
          onPointerMove={onLabelMove}
          onPointerUp={onLabelUp}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            document.body.style.cursor = 'grab'
          }}
          onPointerOut={() => {
            setHovered(false)
            document.body.style.cursor = ''
          }}
        >
          <planeGeometry args={[w, LABEL_H]} />
          <meshBasicMaterial color={accent} transparent opacity={active ? 0.12 : 0.06} depthWrite={false} toneMapped={false} />
        </mesh>
        <Text
          material={textMaterial}
          font={fontUrls.mono}
          fontSize={0.13}
          letterSpacing={0.08}
          color={name ? (group.color ?? colors.fg) : colors.fgDim}
          anchorX="left"
          anchorY="middle"
          position={[-w / 2 + 0.16, h / 2 - LABEL_H / 2, 0.003]}
        >
          {`┌ ${truncate((name || 'Untitled group').toUpperCase(), Math.max(8, Math.floor(w * 8)))}`}
        </Text>

        {/* Resize handle, bottom-right. */}
        <mesh
          position={[w / 2 - HANDLE / 2, -h / 2 + HANDLE / 2, 0.002]}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            document.body.style.cursor = 'nwse-resize'
          }}
          onPointerOut={() => {
            setHovered(false)
            document.body.style.cursor = ''
          }}
        >
          <planeGeometry args={[HANDLE, HANDLE]} />
          <meshBasicMaterial color={edgeColor} transparent opacity={active ? 0.9 : 0} toneMapped={false} />
        </mesh>
      </group>
      <CardReveal content={content} uniforms={cell} />
    </group>
  )
}
