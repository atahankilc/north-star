// Text written straight on the board (D-050): a heading over an area, like "COMPETITORS". Drag to move,
// double-click to edit; while editing, a DOM input sits exactly over it (text you type is never WebGL).
import { Html, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MathUtils, MeshBasicMaterial, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { deleteLabel, endLabelMove, moveLabel, updateLabel } from '../../data/labels'
import type { Label } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { usePalette, useThemeAccent } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'
import { glideDt } from './cardLayout'
import { boardPoint } from './NodeCard'
import { isPreviewing } from '../workspace/preview'
import styles from './BoardLabel.module.css'

export const LABEL_SIZE = 0.6
const WRITE_EVERY_MS = 120
const PAD = 0.18

type Props = { wid: string; label: WithId<Label> }

export function BoardLabel({ wid, label }: Props) {
  const group = useRef<Group>(null)
  const content = useRef<Group>(null)
  const cell = useMemo(makeCellUniforms, [])
  const textMaterial = useMemo(() => {
    const m = new MeshBasicMaterial()
    installCellReveal(m, cell)
    return m
  }, [cell])
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const selected = useCanvas((s) => s.selectedId === label.id)
  const editing = useCanvas((s) => s.editingLabel === label.id)
  const live = useCanvas((s) => s.dragging[label.id])
  const { select, setDragging, setEditingLabel } = useCanvas.getState()
  const [hovered, setHovered] = useState(false)
  // Measured from the rendered text, for the hit area and underline.
  const [box, setBox] = useState<[number, number]>([2, LABEL_SIZE])

  const drag = useRef<{ dx: number; dy: number; from: [number, number]; lastWrite: number; moved: boolean } | null>(null)
  const [x, y] = live ?? [label.x, label.y]
  const colors = usePalette()
  const tone = useThemeAccent()
  const accent = label.color ? tone(label.color) : colors.fg

  // Exactly under the pointer while dragging; remote moves glide (D-061).
  useFrame(({ invalidate }, delta) => {
    const dt = glideDt(delta)
    const g = group.current
    if (!g) return
    if (drag.current) g.position.set(x, y, 0.01)
    else {
      g.position.x = MathUtils.damp(g.position.x, x, 12, dt)
      g.position.y = MathUtils.damp(g.position.y, y, 12, dt)
      if (Math.abs(g.position.x - x) > 1e-4 || Math.abs(g.position.y - y) > 1e-4) invalidate()
    }
  })

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || editing) return
    e.stopPropagation()
    if (controls) controls.enabled = false
    const p = boardPoint(e)
    if (!p) return
    select(label.id)
    // The assistant's preview (D-087) can be looked at, not changed.
    if (isPreviewing()) return
    drag.current = { dx: p[0] - x, dy: p[1] - y, from: [label.x, label.y], lastWrite: 0, moved: false }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    const p = boardPoint(e)
    if (!p) return
    const next: [number, number] = [p[0] - d.dx, p[1] - d.dy]
    d.moved = true
    setDragging(label.id, next)
    const now = performance.now()
    if (now - d.lastWrite > WRITE_EVERY_MS) {
      d.lastWrite = now
      void moveLabel(wid, label.id, next[0], next[1])
    }
  }

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (d) {
      e.stopPropagation()
      drag.current = null
      ;(e.target as Element).releasePointerCapture(e.pointerId)
      const final = useCanvas.getState().dragging[label.id]
      if (d.moved && final) void endLabelMove(wid, label.id, d.from, final)
      setDragging(label.id, null)
    }
    if (controls) controls.enabled = true
  }

  const text = label.text.trim()

  return (
    <group ref={group} position={[x, y, 0.01]}>
      <group ref={content}>
        <mesh
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (!isPreviewing()) setEditingLabel(label.id)
          }}
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
          <planeGeometry args={[box[0] + PAD * 2, box[1] + PAD]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Underline: faint on hover, the label's colour when selected. */}
        {(selected || hovered) && !editing && (
          <mesh position={[0, -box[1] / 2 - 0.08, 0]}>
            <planeGeometry args={[box[0], 0.03]} />
            <meshBasicMaterial color={selected ? colors.cyan : colors.hover} toneMapped={false} />
          </mesh>
        )}
        {!editing && (
          <Text
            material={textMaterial}
            font={fontUrls.display}
            fontSize={LABEL_SIZE}
            letterSpacing={-0.02}
            color={text ? accent : colors.fgDim}
            anchorX="center"
            anchorY="middle"
            onSync={(t) => {
              const b = (t as unknown as { textRenderInfo?: { blockBounds: number[] } }).textRenderInfo?.blockBounds
              if (b) setBox([Math.max(0.6, b[2] - b[0]), Math.max(LABEL_SIZE, b[3] - b[1])])
            }}
          >
            {text || 'Text'}
          </Text>
        )}
      </group>
      {editing && <LabelInput wid={wid} label={label} onDone={() => setEditingLabel(null)} />}
      <CardReveal content={content} uniforms={cell} />
    </group>
  )
}

// Enter or clicking away saves; Escape cancels. Text left empty deletes the label.
function LabelInput({ wid, label, onDone }: { wid: string; label: WithId<Label>; onDone: () => void }) {
  const [draft, setDraft] = useState(label.text)
  const input = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  // How big LABEL_SIZE world units are on screen right now, so the input matches the text it replaces.
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const fontPx = useMemo(() => {
    const fov = ((camera as { fov?: number }).fov ?? 40) * (Math.PI / 180)
    const visible = 2 * Math.tan(fov / 2) * camera.position.z
    return (LABEL_SIZE / visible) * size.height
  }, [camera, size])

  useEffect(() => {
    requestAnimationFrame(() => input.current?.select())
  }, [])

  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    const next = draft.trim()
    if (save && next && next !== label.text) void updateLabel(wid, label.id, { text: next }, !label.text.trim())
    // A label that never got any text isn't worth keeping.
    if ((save && !next) || (!save && !label.text.trim())) void deleteLabel(wid, label.id)
    onDone()
  }

  return (
    <Html center zIndexRange={[20, 10]}>
      <input
        ref={input}
        className={styles.input}
        // Roughly the width of the display face, so the underline hugs the text.
        style={{ fontSize: `${Math.max(12, fontPx)}px`, width: `${Math.max(3, draft.length * 0.62 + 0.6)}em` }}
        value={draft}
        maxLength={200}
        placeholder="Text"
        aria-label="Text on the board"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') finish(true)
          if (e.key === 'Escape') finish(false)
        }}
      />
    </Html>
  )
}
