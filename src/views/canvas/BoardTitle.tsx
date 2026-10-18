// The project's title block on the board (D-118): the workspace's name, big, and what the team is building under it,
// the same two fields as Settings → general (renaming here renames the workspace). Framed by four corner brackets with
// a small north star over it. Its place is a label of kind `title`, so it drags, selects and undoes like text; one per
// board, added from the `+` menu. Double-click the name or the description to edit it in a DOM field laid over it.
import { Html, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react'
import { MathUtils, MeshBasicMaterial, Shape, Vector3, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { endLabelMove, moveLabel } from '../../data/labels'
import type { Label } from '../../data/model'
import { DESCRIPTION_MAX, canEditIn, describeWorkspace, renameWorkspace } from '../../data/workspaces'
import { useAuth } from '../../data/auth'
import { useCanvas } from '../../state/canvasStore'
import { usePalette } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'
import { glideDt } from './cardLayout'
import { useReadable } from './detail'
import { endGroup, moveGroup, startGroup } from './groupDrag'
import { clearGuides, placeDragged, unitsPerPixel } from './guides'
import { boardPoint } from './NodeCard'
import { rightPress } from './rightClick'
import {
  CAPTION,
  DESC,
  DESC_LEADING,
  DESC_W,
  GAP,
  NAME,
  NAME_LEADING,
  PAD,
  RULE,
  TITLE_W,
  estimateNameH,
  setTitleHalf,
  setTitleId,
  editTitle,
  useTitleEdit,
  titleHeight,
  type TitleField,
} from './titleBlock'
import { useWs } from '../workspace/context'
import { MARK_SIGN, type Mark } from '../workspace/preview'
import { editLocked } from '../workspace/viewerLock'
import styles from './BoardTitle.module.css'

// The corner brackets' arms, and the star over the caption.
const ARM = 0.6
const STROKE = 0.035
const STAR = 0.19
const WRITE_EVERY_MS = 120

// A four-pointed star, the app's mark, drawn as a flat shape.
function starShape(r: number) {
  const s = new Shape()
  const inner = r * 0.26
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 2
    const d = i % 2 ? inner : r
    if (i === 0) s.moveTo(Math.cos(a) * d, Math.sin(a) * d)
    else s.lineTo(Math.cos(a) * d, Math.sin(a) * d)
  }
  s.closePath()
  return s
}

type Field = TitleField

// `mark`, `was`: the assistant's preview (D-096, D-120), when a proposal renames the project or rewrites its description.
type Props = { wid: string; label: WithId<Label>; mark?: Mark; was?: { label: string; value: string } }

export function BoardTitle({ wid, label, mark, was }: Props) {
  const { workspace } = useWs()
  const { user } = useAuth()
  const editor = canEditIn(workspace, user?.id)
  const group = useRef<Group>(null)
  const content = useRef<Group>(null)
  const cell = useMemo(makeCellUniforms, [])
  const textMaterial = useMemo(() => {
    const m = new MeshBasicMaterial()
    installCellReveal(m, cell)
    return m
  }, [cell])
  const star = useMemo(() => starShape(STAR), [])
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const getThree = useThree((s) => s.get)
  const selected = useCanvas((s) => s.selection.includes(label.id))
  const live = useCanvas((s) => s.dragging[label.id])
  // The right-click menu's "edit text" (and anything else that asks to edit this label) edits the name.
  const asked = useCanvas((s) => s.editingLabel === label.id)
  const { select, toggleSelect, setDragging, setEditingLabel } = useCanvas.getState()
  const colors = usePalette()
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState<Field | null>(null)
  const descReadable = useReadable(DESC)
  const name = workspace.name.trim() || 'Untitled'
  const description = (workspace.description ?? '').trim()
  // Editors see where to write it; viewers see nothing until someone has.
  const showDesc = !!description || editor

  // Measured from the laid-out text: the name's and the description's heights. Estimated until then.
  const [nameH, setNameH] = useState(() => estimateNameH(name))
  const [descH, setDescH] = useState(DESC * DESC_LEADING * 2)

  const askedField = useTitleEdit((s) => s.field)
  useEffect(() => {
    if (asked) {
      setEditingLabel(null)
      if (editor && !editLocked()) setEditing('name')
    }
  }, [asked, editor, setEditingLabel])
  useEffect(() => {
    if (!askedField) return
    editTitle(null)
    if (editor && !editLocked()) setEditing(askedField)
  }, [askedField, editor])

  // Top to bottom from the block's top edge: caption, name, rule, description. x/y is the block's centre.
  const h = titleHeight(nameH, showDesc ? descH : null)
  const top = h / 2
  const left = -TITLE_W / 2
  const nameTop = top - CAPTION - GAP
  const ruleY = nameTop - nameH - GAP - RULE / 2
  const descTop = ruleY - RULE / 2 - GAP
  useEffect(() => setTitleHalf([TITLE_W / 2 + PAD, h / 2 + PAD]), [h])
  useEffect(() => {
    setTitleId(label.id)
    return () => setTitleId(null)
  }, [label.id])

  const drag = useRef<{ dx: number; dy: number; from: [number, number]; lastWrite: number; moved: boolean; group: boolean } | null>(null)
  const [x, y] = live ?? [label.x, label.y]

  // Exactly under the pointer while dragging; remote moves glide (D-061).
  useFrame(({ invalidate }, delta) => {
    const g = group.current
    if (!g) return
    if (drag.current) g.position.set(x, y, 0.01)
    else {
      const dt = glideDt(delta)
      g.position.x = MathUtils.damp(g.position.x, x, 12, dt)
      g.position.y = MathUtils.damp(g.position.y, y, 12, dt)
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
    const inGroup = !editLocked() && startGroup(label.id)
    if (!inGroup) select(label.id)
    if (editLocked()) return
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
        if (!endGroup(wid)) select(label.id)
      } else {
        const final = useCanvas.getState().dragging[label.id]
        if (d.moved && final) void endLabelMove(wid, label.id, d.from, final)
        setDragging(label.id, null)
      }
    }
    if (controls) controls.enabled = true
  }

  // Above the rule edits the name, below it the description.
  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!editor || editLocked() || !group.current) return
    const local = group.current.worldToLocal(new Vector3().copy(e.point))
    setEditing(local.y > ruleY || !showDesc ? 'name' : 'description')
  }

  const save = (field: Field, value: string) => {
    if (field === 'name' && value.trim() && value.trim() !== workspace.name) void renameWorkspace(wid, value)
    if (field === 'description' && value.trim() !== description) void describeWorkspace(wid, value)
  }

  const markColor = mark ? colors.diff[mark] : undefined
  const frame = markColor ?? (selected ? colors.cyan : hovered ? colors.hover : colors.edge)
  const bx = TITLE_W / 2 + PAD
  const by = h / 2 + PAD
  const measure = (set: (v: number) => void, min: number) => (t: unknown) => {
    const b = (t as { textRenderInfo?: { blockBounds: number[] } }).textRenderInfo?.blockBounds
    if (b) set(Math.max(min, b[3] - b[1]))
  }

  return (
    <group ref={group} position={[x, y, 0.01]}>
      <group ref={content}>
        <mesh
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={onDoubleClick}
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
          <planeGeometry args={[bx * 2, by * 2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Corner brackets, like a viewfinder: grey, lit on hover, cyan when selected. */}
        {([[-1, 1], [1, 1], [-1, -1], [1, -1]] as const).map(([sx, sy]) => (
          <group key={`${sx}${sy}`} position={[sx * bx, sy * by, 0]}>
            <mesh position={[(-sx * ARM) / 2, (-sy * STROKE) / 2, 0]}>
              <planeGeometry args={[ARM, STROKE]} />
              <meshBasicMaterial color={frame} toneMapped={false} />
            </mesh>
            <mesh position={[(-sx * STROKE) / 2, (-sy * ARM) / 2, 0]}>
              <planeGeometry args={[STROKE, ARM]} />
              <meshBasicMaterial color={frame} toneMapped={false} />
            </mesh>
          </group>
        ))}

        {/* The caption: the north star and PROJECT, a label in small mono caps. */}
        <mesh position={[left + STAR, top - CAPTION / 2, 0]}>
          <shapeGeometry args={[star]} />
          <meshBasicMaterial color={colors.magenta} toneMapped={false} />
        </mesh>
        <Text
          material={textMaterial}
          font={fontUrls.mono}
          fontSize={CAPTION}
          letterSpacing={0.12}
          color={colors.fgDim}
          anchorX="left"
          anchorY="middle"
          position={[left + STAR * 2 + 0.16, top - CAPTION / 2, 0]}
        >
          PROJECT
        </Text>

        <Text
          visible={editing !== 'name'}
          material={textMaterial}
          font={fontUrls.display}
          fontSize={NAME}
          lineHeight={NAME_LEADING}
          letterSpacing={-0.045}
          maxWidth={TITLE_W}
          overflowWrap="break-word"
          color={colors.fg}
          anchorX="left"
          anchorY="top"
          position={[left, nameTop, 0]}
          onSync={measure(setNameH, NAME * NAME_LEADING)}
        >
          {name}
        </Text>

        {/* The rule: a magenta lead, then a hairline across the block. */}
        <mesh position={[left + 0.6, ruleY, 0]}>
          <planeGeometry args={[1.2, RULE]} />
          <meshBasicMaterial color={colors.magenta} toneMapped={false} />
        </mesh>
        <mesh position={[left + 1.2 + (TITLE_W - 1.2) / 2, ruleY, 0]}>
          <planeGeometry args={[TITLE_W - 1.2, STROKE / 2]} />
          <meshBasicMaterial color={colors.edgeFaint} toneMapped={false} />
        </mesh>

        {showDesc && (
          <Text
            visible={descReadable && editing !== 'description'}
            material={textMaterial}
            font={fontUrls.display}
            fontSize={DESC}
            lineHeight={DESC_LEADING}
            maxWidth={DESC_W}
            color={description ? colors.fg : colors.fgDim}
            fillOpacity={description ? 0.72 : 1}
            anchorX="left"
            anchorY="top"
            position={[left, descTop, 0]}
            onSync={measure(setDescH, DESC * DESC_LEADING)}
          >
            {description || 'What are you building? Double-click to write it.'}
          </Text>
        )}

        {/* The preview's mark: the brackets in the change's colour, its sign and what it replaced under the block. */}
        {markColor && mark && (
          <Text
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.26}
            maxWidth={TITLE_W}
            color={markColor}
            anchorX="left"
            anchorY="top"
            position={[left, -by - 0.2, 0]}
          >
            {`${MARK_SIGN[mark]} ${was ? `${was.label} ${was.value.length > 90 ? `${was.value.slice(0, 89)}…` : was.value}` : 'edited'}`}
          </Text>
        )}
      </group>

      {editing && (
        <TitleInput
          field={editing}
          value={editing === 'name' ? workspace.name : description}
          at={editing === 'name' ? [left, nameTop] : [left, descTop]}
          onDone={(next) => {
            if (next !== null) save(editing, next)
            setEditing(null)
          }}
        />
      )}
      <CardReveal content={content} uniforms={cell} />
    </group>
  )
}

// A DOM field over the text it edits, at the same size. Enter or clicking away saves, Escape cancels; in the
// description shift+Enter starts a new line.
function TitleInput({ field, value, at, onDone }: { field: Field; value: string; at: [number, number]; onDone: (next: string | null) => void }) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const done = useRef(false)
  // Pixels per board unit right now, so the field matches the text it replaces.
  const camera = useThree((s) => s.camera)
  const view = useThree((s) => s.size)
  const ppu = useMemo(() => 1 / unitsPerPixel(camera, view.height), [camera, view])

  // The name is selected, to retype; the description gets the caret at its end, to add to it.
  useEffect(() => {
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      grow()
      el.focus()
      if (field === 'name') el.select()
      else el.setSelectionRange(el.value.length, el.value.length)
    })
  }, [field])

  // The description's field grows with what's written in it; again once it's on screen, where it can be measured.
  const grow = () => {
    const el = ref.current
    if (field !== 'description' || !el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  useEffect(grow, [draft, field])

  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    onDone(save ? draft : null)
  }
  const common = {
    ref,
    className: styles.input,
    'data-field': field,
    value: draft,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: () => finish(true),
    onPointerDown: (e: ReactPointerEvent) => e.stopPropagation(),
    onWheel: (e: WheelEvent) => e.stopPropagation(),
    onKeyDown: (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        finish(true)
      }
      if (e.key === 'Escape') finish(false)
    },
  }
  const fontPx = Math.max(12, (field === 'name' ? NAME : DESC) * ppu)
  const widthPx = (field === 'name' ? TITLE_W : DESC_W) * ppu

  return (
    <Html position={[at[0], at[1], 0]} zIndexRange={[20, 10]}>
      {field === 'name' ? (
        <input {...common} style={{ fontSize: `${fontPx}px`, width: `${widthPx}px` }} maxLength={200} aria-label="Workspace name" />
      ) : (
        <textarea
          {...common}
          rows={1}
          style={{ fontSize: `${fontPx}px`, width: `${widthPx}px` }}
          maxLength={DESCRIPTION_MAX}
          placeholder="What are you building?"
          aria-label="What we're building"
        />
      )}
    </Html>
  )
}
