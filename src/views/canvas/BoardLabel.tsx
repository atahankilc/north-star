// Text written straight on the board (D-050): a heading over an area, like "COMPETITORS". Drag to move,
// double-click to edit; while editing, a DOM input sits exactly over it (text you type is never WebGL).
import { Html, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MathUtils, MeshBasicMaterial, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { deleteLabel, endLabelMove, moveLabel, updateLabel } from '../../data/labels'
import type { Label, LabelSize } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { usePalette, useThemeAccent } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'
import { glideDt } from './cardLayout'
import { endGroup, moveGroup, startGroup } from './groupDrag'
import { boardPoint } from './NodeCard'
import { MARK_SIGN, type Mark } from '../workspace/preview'
import { editLocked } from '../workspace/viewerLock'
import { markHover, unlight } from '../workspace/stage'
import styles from './BoardLabel.module.css'

export const LABEL_SIZE = 0.6
// Heading (the default), subheading, note (D-108). Notes are mono, like an annotation.
const SIZES: Record<LabelSize, number> = { heading: LABEL_SIZE, subheading: 0.36, note: 0.2 }
export const labelSize = (l: Pick<Label, 'size'>) => SIZES[l.size ?? 'heading']
const WRITE_EVERY_MS = 120
const PAD = 0.18

// In the assistant's preview (D-096): what a change does to it, its old text, whether its checklist row is lit.
type Props = { wid: string; label: WithId<Label>; mark?: Mark; was?: { label: string; value: string }; lit?: boolean }

export function BoardLabel({ wid, label, mark, was, lit = false }: Props) {
  const group = useRef<Group>(null)
  const content = useRef<Group>(null)
  const cell = useMemo(makeCellUniforms, [])
  const textMaterial = useMemo(() => {
    const m = new MeshBasicMaterial()
    installCellReveal(m, cell)
    return m
  }, [cell])
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const selected = useCanvas((s) => s.selection.includes(label.id))
  const editing = useCanvas((s) => s.editingLabel === label.id)
  const live = useCanvas((s) => s.dragging[label.id])
  const { select, toggleSelect, setDragging, setEditingLabel } = useCanvas.getState()
  const size = labelSize(label)
  const note = label.size === 'note'
  const [hovered, setHovered] = useState(false)
  // Measured from the rendered text, for the hit area and underline.
  const [box, setBox] = useState<[number, number]>([2, size])

  const drag = useRef<{ dx: number; dy: number; from: [number, number]; lastWrite: number; moved: boolean; group: boolean } | null>(null)
  const [x, y] = live ?? [label.x, label.y]
  const colors = usePalette()
  const tone = useThemeAccent()
  const deleted = mark === 'deleted'
  const accent = deleted ? colors.fgDim : label.color ? tone(label.color) : colors.fg
  const markColor = mark ? colors.diff[mark] : undefined

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
    // Shift+click: in or out of the selection (D-108).
    if (e.shiftKey) {
      toggleSelect(label.id)
      return
    }
    const group = !editLocked() && startGroup(label.id)
    if (!group) select(label.id)
    // The assistant's preview (D-087) can be looked at, not changed.
    if (editLocked()) return
    drag.current = { dx: p[0] - x, dy: p[1] - y, from: [label.x, label.y], lastWrite: 0, moved: false, group }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    const p = boardPoint(e)
    if (!p) return
    const next: [number, number] = [p[0] - d.dx, p[1] - d.dy]
    d.moved = true
    if (d.group) {
      moveGroup(wid, [next[0] - d.from[0], next[1] - d.from[1]])
      return
    }
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
      if (d.group) {
        if (!endGroup(wid)) select(label.id)
      } else {
        const final = useCanvas.getState().dragging[label.id]
        if (d.moved && final) void endLabelMove(wid, label.id, d.from, final)
        setDragging(label.id, null)
      }
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
            if (!editLocked()) setEditingLabel(label.id)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            document.body.style.cursor = 'grab'
            if (mark) markHover(label.id).onPointerEnter()
          }}
          onPointerOut={() => {
            setHovered(false)
            document.body.style.cursor = ''
            if (mark) unlight()
          }}
        >
          <planeGeometry args={[box[0] + PAD * 2, box[1] + PAD]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* The preview's mark (D-096): an underline in the change's colour, its diff sign before the text, a strike
            through a removed label, and a renamed one's old text under it. */}
        {markColor && mark && !editing && (
          <>
            <mesh position={[0, -box[1] / 2 - 0.08, 0]}>
              <planeGeometry args={[box[0], lit ? 0.07 : 0.035]} />
              <meshBasicMaterial color={markColor} toneMapped={false} />
            </mesh>
            <Text material={textMaterial} font={fontUrls.mono} fontSize={0.34} color={markColor} anchorX="right" anchorY="middle" position={[-box[0] / 2 - 0.16, 0, 0]}>
              {MARK_SIGN[mark]}
            </Text>
            {deleted && (
              <mesh position={[0, -0.02, 0.001]}>
                <planeGeometry args={[box[0] + 0.1, 0.035]} />
                <meshBasicMaterial color={markColor} toneMapped={false} />
              </mesh>
            )}
            {was && (
              <Text material={textMaterial} font={fontUrls.mono} fontSize={0.16} color={colors.fgDim} anchorX="center" anchorY="top" position={[0, -box[1] / 2 - 0.2, 0]}>
                {`${was.label} ${was.value}`}
              </Text>
            )}
          </>
        )}
        {/* Underline: faint on hover, the label's colour when selected. */}
        {(selected || hovered) && !editing && !mark && (
          <mesh position={[0, -box[1] / 2 - size * 0.13, 0]}>
            <planeGeometry args={[box[0], Math.max(0.014, size * 0.05)]} />
            <meshBasicMaterial color={selected ? colors.cyan : colors.hover} toneMapped={false} />
          </mesh>
        )}
        {!editing && (
          <Text
            material={textMaterial}
            font={note ? fontUrls.mono : fontUrls.display}
            fontSize={size}
            letterSpacing={note ? 0 : -0.02}
            color={text ? (note && !label.color ? colors.fgDim : accent) : colors.fgDim}
            anchorX="center"
            anchorY="middle"
            onSync={(t) => {
              const b = (t as unknown as { textRenderInfo?: { blockBounds: number[] } }).textRenderInfo?.blockBounds
              if (b) setBox([Math.max(size, b[2] - b[0]), Math.max(size, b[3] - b[1])])
            }}
          >
            {text || 'Text'}
          </Text>
        )}
      </group>
      {editing && <LabelInput wid={wid} label={label} size={size} onDone={() => setEditingLabel(null)} />}
      <CardReveal content={content} uniforms={cell} />
    </group>
  )
}

// Enter or clicking away saves; Escape cancels. Text left empty deletes the label.
function LabelInput({ wid, label, size, onDone }: { wid: string; label: WithId<Label>; size: number; onDone: () => void }) {
  const [draft, setDraft] = useState(label.text)
  const input = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  // How big LABEL_SIZE world units are on screen right now, so the input matches the text it replaces.
  const camera = useThree((s) => s.camera)
  const view = useThree((s) => s.size)
  const fontPx = useMemo(() => {
    const fov = ((camera as { fov?: number }).fov ?? 40) * (Math.PI / 180)
    const visible = 2 * Math.tan(fov / 2) * camera.position.z
    return (size / visible) * view.height
  }, [camera, view, size])

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
        data-note={label.size === 'note' || undefined}
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
