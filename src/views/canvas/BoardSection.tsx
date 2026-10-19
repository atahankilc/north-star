// A section on the board (D-130): a named frame round part of the board (sections.ts says what it holds). Its name sits
// in the frame's top edge, or up its left edge (D-157), the line breaking round it, in the section's colour as the line
// is; grab the name or the frame's edge to drag it, and everything it holds comes along
// (groupDrag.ts). The handle in its bottom-right corner resizes it, the top-left corner staying put and what's inside
// staying where it is. Double-click the name to rename it. The empty middle belongs to the board: clicks and drags
// there reach the cards inside or pan, as if the section weren't there. In the focus view (D-127) it's only drawn.
import { Html, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MathUtils, MeshBasicMaterial, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { endLabelMove, endSectionResize, moveLabel, resizeSection, updateLabel, type LabelEdit } from '../../data/labels'
import { KICKER_MAX, LABEL_TEXT_MAX, type Label } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { usePalette, useThemeAccent } from '../../state/theme'
import { BoardLine } from './BoardLine'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'
import { glideDt } from './cardLayout'
import { useReadable } from './detail'
import { endGroup, moveGroup, startGroup } from './groupDrag'
import { focusField } from './focusField'
import { clearGuides, placeDragged, unitsPerPixel } from './guides'
import { boardPoint } from './NodeCard'
import { rightPress } from './rightClick'
import { MIN_H, MIN_W, sectionInset, sectionNameSize, sizeOf, type SectionRect } from './sections'
import { inputStyle, kickerParts, kickerSize, labelFace, labelTracking, shownText } from './textStyle'
import { fontUrls } from '../../three/fonts'
import { snapPoint } from './snap'
import { editLocked } from '../workspace/viewerLock'
import styles from './BoardLabel.module.css'

const WRITE_EVERY_MS = 120
// The frame's edges can be grabbed this far in from the line (board units); the corner handle's size.
const EDGE = 0.22
const HANDLE = 0.42
// Sections lie under every card and above the grid; inner ones over outer ones.
const Z = -0.05
const Z_STEP = 0.004

type Props = {
  wid: string
  label: WithId<Label>
  // How many sections it sits inside.
  depth: number
  // Drawn only (the focus view): nothing to grab, click or edit.
  fixed?: boolean
}

export function BoardSection({ wid, label, depth, fixed = false }: Props) {
  const group = useRef<Group>(null)
  const content = useRef<Group>(null)
  const cell = useMemo(makeCellUniforms, [])
  const textMaterial = useMemo(() => {
    const m = new MeshBasicMaterial()
    installCellReveal(m, cell)
    return m
  }, [cell])
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const getThree = useThree((s) => s.get)
  const selected = useCanvas((s) => !fixed && s.selection.includes(label.id))
  const editing = useCanvas((s) => !fixed && s.editingLabel === label.id)
  const live = useCanvas((s) => s.dragging[label.id])
  const { select, toggleSelect, setDragging, setEditingLabel } = useCanvas.getState()
  const [hovered, setHovered] = useState(false)
  // The frame while its corner is dragged, ahead of Firestore.
  const [resizing, setResizing] = useState<SectionRect | null>(null)
  // The name's width as laid out, for the break in the line round it.
  const [nameMeasured, setNameMeasured] = useState<number | null>(null)

  const [w, h] = resizing ? [resizing.w, resizing.h] : sizeOf(label)
  const [x, y] = resizing ? [resizing.x, resizing.y] : (live ?? [label.x, label.y])
  // Set like text (H1, H2, H3, bold, italic, caps), whatever the frame's size.
  const size = sectionNameSize(label)
  const readable = useReadable(size)
  const colors = usePalette()
  const tone = useThemeAccent()
  const accent = label.color ? tone(label.color) : colors.fg
  const line = selected ? colors.cyan : hovered ? colors.hover : label.color ? accent : colors.edge
  const z = Z + Math.min(depth, 8) * Z_STEP

  const drag = useRef<{ dx: number; dy: number; from: [number, number]; lastWrite: number; moved: boolean; group: boolean } | null>(null)
  const corner = useRef<{ from: SectionRect; x0: number; y1: number; lastWrite: number } | null>(null)

  // Exactly under the pointer while dragging; remote moves glide (D-061).
  useFrame(({ invalidate }, delta) => {
    const g = group.current
    if (!g) return
    if (drag.current || live || resizing) g.position.set(x, y, z)
    else {
      const dt = glideDt(delta)
      g.position.x = MathUtils.damp(g.position.x, x, 12, dt)
      g.position.y = MathUtils.damp(g.position.y, y, 12, dt)
      g.position.z = z
      if (Math.abs(g.position.x - x) > 1e-4 || Math.abs(g.position.y - y) > 1e-4) invalidate()
    }
  })

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!editing && rightPress(e, { kind: 'label', id: label.id })) return
    if (e.button !== 0 || editing) return
    e.stopPropagation()
    if (controls) controls.enabled = false
    const p = boardPoint(e)
    if (!p) return
    if (e.shiftKey) {
      toggleSelect(label.id)
      return
    }
    // One of several selected: they all move. Otherwise it's selected, and carries what it holds.
    const { selection } = useCanvas.getState()
    if (!(selection.length > 1 && selection.includes(label.id))) select(label.id)
    if (editLocked()) return
    const inGroup = startGroup(label.id)
    drag.current = { dx: p[0] - x, dy: p[1] - y, from: [label.x, label.y], lastWrite: 0, moved: false, group: inGroup }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    const p = boardPoint(e)
    if (!p) return
    const { camera, size } = getThree()
    const next = placeDragged(label.id, [p[0] - d.dx, p[1] - d.dy], e.altKey, unitsPerPixel(camera, size.height))
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
      clearGuides()
      if (d.group) {
        // A click on one of several selected picks it alone.
        if (!endGroup(wid)) select(label.id)
      } else {
        const final = useCanvas.getState().dragging[label.id]
        if (d.moved && final) void endLabelMove(wid, label.id, d.from, final)
        setDragging(label.id, null)
      }
    }
    if (controls) controls.enabled = true
  }

  // The corner: the top-left stays, the bottom-right follows the pointer (on the grid while snapping is on).
  const onCornerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (controls) controls.enabled = false
    select(label.id)
    if (editLocked()) return
    const from = { x: label.x, y: label.y, w, h }
    corner.current = { from, x0: label.x - w / 2, y1: label.y + h / 2, lastWrite: 0 }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const onCornerMove = (e: ThreeEvent<PointerEvent>) => {
    const c = corner.current
    if (!c) return
    const p = boardPoint(e)
    if (!p) return
    const [px, py] = snapPoint(p, e.altKey)
    const nw = Math.max(MIN_W, px - c.x0)
    const nh = Math.max(MIN_H, c.y1 - py)
    const next = { x: c.x0 + nw / 2, y: c.y1 - nh / 2, w: nw, h: nh }
    setResizing(next)
    const now = performance.now()
    if (now - c.lastWrite > WRITE_EVERY_MS) {
      c.lastWrite = now
      void resizeSection(wid, label.id, next)
    }
  }

  const onCornerUp = (e: ThreeEvent<PointerEvent>) => {
    const c = corner.current
    if (c) {
      e.stopPropagation()
      corner.current = null
      ;(e.target as Element).releasePointerCapture(e.pointerId)
      // Held at the new size until the final write is in, so it doesn't spring back to the last streamed one.
      if (resizing) void endSectionResize(wid, label.id, c.from, resizing).then(() => setResizing(null), () => setResizing(null))
    }
    if (controls) controls.enabled = true
  }

  const grab = fixed
    ? {}
    : {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
        onDoubleClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          if (!editLocked()) setEditingLabel(label.id)
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'grab'
        },
        onPointerOut: () => {
          setHovered(false)
          document.body.style.cursor = ''
        },
      }

  const name = label.text.trim()
  const left = -w / 2
  const top = h / 2
  // The name sits in the frame's edge (D-157): along the top from near its left corner, or up the left edge ending
  // near the top. The line breaks round it; a leading number from its small line goes before it in the accent.
  const onLeft = label.side === 'left'
  const inset = sectionInset(label)
  const kicker = kickerParts(label.kicker)
  const ks = Math.max(0.1, size * 0.42)
  const kickText = kicker ? [kicker.num, kicker.rest].filter(Boolean).join(' ') : ''
  const kickW = kickText ? kickText.length * ks * 0.6 * 1.12 + size * 0.45 : 0
  const edge = onLeft ? h : w
  // One line in the edge: cut to what fits (Geist is about half its size wide per character).
  const room = Math.max(4, Math.floor((edge - inset * 2 - kickW) / (size * (label.caps || label.bold ? 0.66 : 0.55))))
  const shown = shownText(label, name.length > room ? `${name.slice(0, room - 1)}…` : name)
  const nameW = Math.min(edge - inset * 2, kickW + (nameMeasured ?? (shown || 'Section').length * size * 0.55))
  const gap = size * 0.35
  // The frame, open where the name is: from the name's far end round the corners back to its near end.
  const frame: [number, number, number][] = onLeft
    ? [
        [left, top - inset - nameW - gap, 0],
        [left, -top, 0],
        [-left, -top, 0],
        [-left, top, 0],
        [left, top, 0],
        [left, top - inset + gap, 0],
      ]
    : [
        [left + inset + nameW + gap, top, 0],
        [-left, top, 0],
        [-left, -top, 0],
        [left, -top, 0],
        [left, top, 0],
        [left + inset - gap, top, 0],
      ]
  // The name's place and turn: its start on the edge.
  const nameAt: [number, number] = onLeft ? [left, top - inset - nameW] : [left + inset, top]
  const nameTurn = onLeft ? Math.PI / 2 : 0
  const grip = EDGE

  return (
    <group ref={group} position={[x, y, z]}>
      <group ref={content}>
        <BoardLine points={frame} color={line} lineWidth={selected ? 1.6 : 1} toneMapped={false} />

        {/* What can be grabbed: the name and the frame's four edges. */}
        {!fixed &&
          ([
            [left, 0, grip, h],
            [-left, 0, grip, h],
            [0, -top, w, grip],
            [0, top, w, grip],
          ] as const).map(([ex, ey, ew, eh], i) => (
            <mesh key={i} position={[ex, ey, 0]} {...grab}>
              <planeGeometry args={[ew, eh]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}

        <group position={[nameAt[0], nameAt[1], 0.001]} rotation={[0, 0, nameTurn]}>
          <mesh position={[nameW / 2, 0, 0]} {...grab}>
            <planeGeometry args={[nameW + gap * 2, size * 1.3]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {!editing && kickText && (
            <Text visible={readable} material={textMaterial} font={fontUrls.mono} fontSize={ks} letterSpacing={0.1} color={label.color ? accent : colors.magenta} anchorX="left" anchorY="middle">
              {kickText}
            </Text>
          )}
          {!editing && (
            <Text
              visible={readable}
              material={textMaterial}
              font={labelFace({ ...label, size: undefined })}
              fontSize={size}
              letterSpacing={labelTracking({ ...label, size: undefined })}
              color={name ? accent : colors.fgDim}
              anchorX="left"
              anchorY="middle"
              position={[kickW, 0, 0]}
              onSync={(t) => {
                const b = (t as unknown as { textRenderInfo?: { blockBounds: number[] } }).textRenderInfo?.blockBounds
                if (b) setNameMeasured(b[2] - b[0])
              }}
            >
              {shown || 'Section'}
            </Text>
          )}
        </group>

        {/* The resize handle: an L in the corner, shown while it's hovered or selected. */}
        {!fixed && (
          <group position={[-left, -top, 0.002]}>
            {(hovered || selected || resizing) && (
              <BoardLine
                points={[
                  [-HANDLE, 0.06, 0],
                  [-0.06, 0.06, 0],
                  [-0.06, HANDLE, 0],
                ]}
                color={selected ? colors.cyan : colors.hover}
                lineWidth={2}
                toneMapped={false}
              />
            )}
            <mesh
              position={[-HANDLE / 2, HANDLE / 2, 0]}
              onPointerDown={onCornerDown}
              onPointerMove={onCornerMove}
              onPointerUp={onCornerUp}
              onClick={(e) => e.stopPropagation()}
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
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        )}
      </group>
      {editing && <NameInput wid={wid} label={label} size={size} at={[left + inset, top]} onDone={() => setEditingLabel(null)} />}
      <CardReveal content={content} uniforms={cell} />
    </group>
  )
}

// Enter or clicking away saves, Escape cancels. A section may have no name; it stays either way. Its small line (a
// number, D-157) has its own field over the name's (Tab between the two).
function NameInput({ wid, label, size, at, onDone }: { wid: string; label: WithId<Label>; size: number; at: [number, number]; onDone: () => void }) {
  const [draft, setDraft] = useState(label.text)
  const [kick, setKick] = useState(label.kicker ?? '')
  const input = useRef<HTMLInputElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  const camera = useThree((s) => s.camera)
  const view = useThree((s) => s.size)
  const upp = useMemo(() => unitsPerPixel(camera, view.height), [camera, view])

  useEffect(() => focusField(() => input.current), [])

  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    const next = draft.trim()
    const nextKick = kick.trim()
    const fields: LabelEdit = {}
    if (next !== label.text) fields.text = next
    if (nextKick !== (label.kicker ?? '')) fields.kicker = nextKick || undefined
    // A new section's first name undoes together with making it.
    if (save && Object.keys(fields).length) void updateLabel(wid, label.id, fields, !label.text.trim())
    onDone()
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') finish(true)
    if (e.key === 'Escape') finish(false)
  }

  return (
    <Html position={[at[0], at[1], 0]} zIndexRange={[20, 10]}>
      <div
        ref={wrap}
        className={styles.heading}
        data-section
        onBlur={(e) => {
          if (!wrap.current?.contains(e.relatedTarget as Node)) finish(true)
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          className={styles.kicker}
          style={{ fontSize: `${Math.max(10, kickerSize(size) / upp)}px` }}
          value={kick}
          maxLength={KICKER_MAX}
          placeholder="01"
          aria-label="Number before the name"
          onChange={(e) => setKick(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <input
          ref={input}
          className={styles.input}
          data-section
          style={{ ...inputStyle(label), fontSize: `${Math.max(12, size / upp)}px`, width: `${Math.max(6, draft.length * 0.62 + 0.6)}em` }}
          value={draft}
          maxLength={LABEL_TEXT_MAX}
          placeholder="Section"
          aria-label="Section name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    </Html>
  )
}
