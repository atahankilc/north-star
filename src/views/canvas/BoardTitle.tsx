// The project's title block on the board (D-118): the workspace's name, big, and what the team is building under it,
// the same two fields as Settings → general (renaming here renames the workspace). Framed by four corner brackets with
// a small north star over it. Its place is a label of kind `title`, so it drags, selects and undoes like text; one per
// board, added from the `+` menu. Double-click the name or the description to edit it in a DOM field laid over it.
// Its right edge drags it wider or narrower, the text rewrapping (D-132). Too far out to read the description, it
// folds: the caption, rule and description fade, the star moves beside the name, and the name grows into the room
// they leave, as big as fits the unfolded block without breaking a word; the block shrinks only to what's left.
import { Html, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react'
import { MathUtils, MeshBasicMaterial, Shape, Vector3, type Group, type Mesh } from 'three'
import { getTextRenderInfo } from 'troika-three-text'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { endLabelMove, endTitleResize, moveLabel, resizeTitle, type TitleSpan } from '../../data/labels'
import type { Label } from '../../data/model'
import { DESCRIPTION_MAX, canEditIn, describeWorkspace, renameWorkspace } from '../../data/workspaces'
import { useAuth } from '../../data/auth'
import { useCanvas } from '../../state/canvasStore'
import { isReducedMotion } from '../../state/motion'
import { usePalette } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'
import { glideDt } from './cardLayout'
import { useDetail, useReadable } from './detail'
import { endGroup, moveGroup, startGroup } from './groupDrag'
import { clearGuides, placeDragged, unitsPerPixel } from './guides'
import { boardPoint } from './NodeCard'
import { rightPress } from './rightClick'
import { snapPoint } from './snap'
import {
  CAPTION,
  DESC,
  DESC_LEADING,
  GAP,
  MAX_TITLE_W,
  MIN_TITLE_W,
  NAME,
  NAME_LEADING,
  PAD,
  RULE,
  descWidth,
  estimateNameH,
  titleWidth,
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
const NAME_TRACK = -0.045
// Folded (D-132): the star's size beside the name, per unit of the name's size, and the name's indent past it; the
// smallest and biggest the name may get; how long the fold takes (a component's entrance, D-035).
const FOLD_STAR = 0.42
const foldIndent = (size: number) => size * FOLD_STAR * 2 + 0.3
const MIN_FOLD = NAME * 0.6
const MAX_FOLD = NAME * 4
const FOLD_MS = 320
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
// How wide the grip on the right edge is.
const GRIP = 0.5
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
type TroikaText = Mesh & { fillOpacity: number; fontSize: number }

// The name's laid-out size at a font size and width, from the typesetter that draws it.
const nameBounds = (text: string, fontSize: number, maxWidth: number) =>
  new Promise<{ w: number; h: number }>((done) =>
    getTextRenderInfo(
      { text, font: fontUrls.display, fontSize, lineHeight: NAME_LEADING, letterSpacing: NAME_TRACK, maxWidth, overflowWrap: 'normal', anchorX: 'left', anchorY: 'top' },
      ({ blockBounds: b }) => done({ w: b[2] - b[0], h: b[3] - b[1] }),
    ),
  )

// The name unfolded (NAME, `w` wide) and folded: the biggest size whose lines fit the unfolded block's height and none
// of whose words breaks, beside the star; then its height, which the folded block shrinks to.
type Fit = { nameH: number; fold: number; foldH: number }
async function fitName(name: string, w: number, blockH: (nameH: number) => number): Promise<Fit> {
  const nameH = Math.max(NAME * NAME_LEADING, (await nameBounds(name, NAME, w)).h)
  const room = blockH(nameH)
  const at = async (size: number) => {
    const width = w - foldIndent(size)
    const b = await nameBounds(name, size, width)
    return { fits: b.h <= room + 1e-3 && b.w <= width + 1e-3, h: Math.max(size * NAME_LEADING, b.h) }
  }
  // Usually bigger than unfolded; smaller only in a narrow block, where the star's indent would break a word.
  let lo = MIN_FOLD
  let hi = Math.max(lo, Math.min(MAX_FOLD, room / NAME_LEADING))
  const most = await at(hi)
  if (most.fits) return { nameH, fold: hi, foldH: most.h }
  let best = await at(lo)
  if (!best.fits) return { nameH, fold: lo, foldH: best.h }
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2
    const r = await at(mid)
    if (r.fits) [lo, best] = [mid, r]
    else hi = mid
  }
  return { nameH, fold: lo, foldH: best.h }
}

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
  // Too small to read the description (and the caption under it in size): folded round the name. Never while the
  // description is being written.
  const folded = !descReadable && editing !== 'description'
  // Editors see where to write it; viewers see nothing until someone has.
  const showDesc = !!description || editor
  // While the right edge is dragged: the block's centre and width, ahead of the database.
  const [resizing, setResizing] = useState<TitleSpan | null>(null)
  const tw = resizing?.w ?? titleWidth(label)

  // The description's height measured once laid out, the name's unfolded and folded typeset; estimated until then.
  const [descH, setDescH] = useState(DESC * DESC_LEADING * 2)
  const [fit, setFit] = useState<Fit>(() => {
    const nameH = estimateNameH(name, tw)
    return { nameH, fold: NAME, foldH: nameH }
  })
  useEffect(() => {
    let stale = false
    void fitName(name, tw, (nameH) => titleHeight(nameH, showDesc ? descH : null)).then((f) => !stale && setFit(f))
    return () => {
      stale = true
    }
  }, [name, tw, showDesc, descH])

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

  // Top to bottom from the block's top edge, unfolded: caption, name, rule, description. Folded: the name, the star
  // beside its first line. x/y is the block's centre, and its width stays `tw` either way.
  const { nameH, fold: foldSize, foldH } = fit
  const fullH = titleHeight(nameH, showDesc ? descH : null)
  const left = -tw / 2
  const nameTop = fullH / 2 - CAPTION - GAP
  const ruleY = nameTop - nameH - GAP - RULE / 2
  const descTop = ruleY - RULE / 2 - GAP
  const foldIn = foldIndent(foldSize)
  const bx = tw / 2 + PAD
  useEffect(() => setTitleHalf([bx, (folded ? foldH : fullH) / 2 + PAD], [bx, Math.max(fullH, foldH) / 2 + PAD]), [bx, folded, foldH, fullH])
  useEffect(() => {
    setTitleId(label.id)
    return () => setTitleId(null)
  }, [label.id])

  // The fold's progress, 0 unfolded to 1 folded, moving at an even pace (eased when drawn) so turning back halfway
  // carries on from where it is.
  const fold = useRef({ p: folded ? 1 : 0, from: folded ? 1 : 0, to: folded ? 1 : 0, t0: 0 })
  useEffect(() => {
    const f = fold.current
    const to = folded ? 1 : 0
    if (f.to === to) return
    Object.assign(f, { from: f.p, to, t0: performance.now() })
    getThree().invalidate()
  }, [folded, getThree])
  // What's drawn as it folds, set every frame below: the name's text is laid out at its size in the state the block is
  // heading for, and scaled from the size it was laid out at last (troika lays out a frame or two later).
  const brackets = useRef<(Group | null)[]>([])
  const hit = useRef<Mesh>(null)
  const grip = useRef<Mesh>(null)
  const starMesh = useRef<Mesh>(null)
  const caption = useRef<TroikaText>(null)
  const nameText = useRef<TroikaText>(null)
  const ruleLead = useRef<Mesh>(null)
  const ruleLine = useRef<Mesh>(null)
  const descText = useRef<TroikaText>(null)
  const markText = useRef<Mesh>(null)
  const laidOutAt = useRef(NAME)

  const drag = useRef<{ dx: number; dy: number; from: [number, number]; lastWrite: number; moved: boolean; group: boolean } | null>(null)
  const edge = useRef<{ from: TitleSpan; x0: number; dx: number; lastWrite: number } | null>(null)
  const [x, y] = live ?? [resizing?.x ?? label.x, label.y]

  // Exactly under the pointer while dragging; remote moves glide (D-061).
  useFrame(({ invalidate }, delta) => {
    const g = group.current
    if (!g) return
    // Also when carried along in a group drag (groupDrag.ts).
    if (drag.current || live || resizing) g.position.set(x, y, 0.01)
    else {
      const dt = glideDt(delta)
      g.position.x = MathUtils.damp(g.position.x, x, 12, dt)
      g.position.y = MathUtils.damp(g.position.y, y, 12, dt)
      if (Math.abs(g.position.x - x) > 1e-4 || Math.abs(g.position.y - y) > 1e-4) invalidate()
    }

    const f = fold.current
    const span = Math.abs(f.to - f.from) * FOLD_MS
    const t = isReducedMotion() || span === 0 ? 1 : Math.min(1, (performance.now() - f.t0) / span)
    f.p = f.from + (f.to - f.from) * t
    if (t < 1) invalidate()
    const e = easeInOut(f.p)
    const h = MathUtils.lerp(fullH, foldH, e)
    const top = h / 2
    const by = top + PAD
    brackets.current.forEach((b, i) => b?.position.setY(i < 2 ? by : -by))
    hit.current?.scale.set(bx * 2, by * 2, 1)
    grip.current?.scale.set(GRIP, by * 2, 1)
    markText.current?.position.setY(-by - 0.2)
    // The caption, rule and description fade in the fold's first half (and come back in the unfold's second), riding
    // with the block's top edge.
    const fade = MathUtils.clamp(1 - e * 2, 0, 1)
    const fromTop = top - fullH / 2
    if (caption.current) {
      caption.current.fillOpacity = fade
      caption.current.visible = fade > 0
      caption.current.position.setY(fromTop + fullH / 2 - CAPTION / 2)
    }
    for (const r of [ruleLead.current, ruleLine.current]) {
      if (!r) continue
      ;(r.material as MeshBasicMaterial).opacity = fade
      r.visible = fade > 0
      r.position.setY(fromTop + ruleY)
    }
    if (descText.current) {
      descText.current.fillOpacity = fade * (description ? 0.72 : 1)
      descText.current.visible = fade > 0 && editing !== 'description'
      descText.current.position.setY(fromTop + descTop)
    }
    const size = MathUtils.lerp(NAME, foldSize, e)
    if (nameText.current) {
      nameText.current.position.set(left + foldIn * e, MathUtils.lerp(nameTop, foldH / 2, e), 0)
      nameText.current.scale.setScalar(size / laidOutAt.current)
    }
    if (starMesh.current) {
      starMesh.current.position.set(
        MathUtils.lerp(left + STAR, left + foldSize * FOLD_STAR, e),
        MathUtils.lerp(fullH / 2 - CAPTION / 2, foldH / 2 - (foldSize * NAME_LEADING) / 2, e),
        0,
      )
      starMesh.current.scale.setScalar(MathUtils.lerp(1, (foldSize * FOLD_STAR) / STAR, e))
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

  // The right edge: the left edge stays, the width follows the pointer (in quarter units while snapping is on, D-112).
  const onEdgeDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (controls) controls.enabled = false
    select(label.id)
    if (editLocked()) return
    const p = boardPoint(e)
    if (!p) return
    edge.current = { from: { x: label.x, w: tw }, x0: label.x - tw / 2, dx: p[0] - (label.x + tw / 2), lastWrite: 0 }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const onEdgeMove = (e: ThreeEvent<PointerEvent>) => {
    const c = edge.current
    if (!c) return
    const p = boardPoint(e)
    if (!p) return
    const w = MathUtils.clamp(snapPoint([p[0] - c.dx - c.x0, 0], e.altKey)[0], MIN_TITLE_W, MAX_TITLE_W)
    const next = { x: c.x0 + w / 2, w }
    setResizing(next)
    const now = performance.now()
    if (now - c.lastWrite > WRITE_EVERY_MS) {
      c.lastWrite = now
      void resizeTitle(wid, label.id, next)
    }
  }

  const onEdgeUp = (e: ThreeEvent<PointerEvent>) => {
    const c = edge.current
    if (c) {
      e.stopPropagation()
      edge.current = null
      ;(e.target as Element).releasePointerCapture(e.pointerId)
      // Held at the new width until the final write is in, so it doesn't spring back to the last streamed one.
      if (resizing) void endTitleResize(wid, label.id, c.from, resizing).then(() => setResizing(null), () => setResizing(null))
    }
    if (controls) controls.enabled = true
  }

  // Above the rule edits the name, below it the description.
  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!editor || editLocked() || !group.current) return
    const local = group.current.worldToLocal(new Vector3().copy(e.point))
    setEditing(folded || local.y > ruleY || !showDesc ? 'name' : 'description')
  }

  const save = (field: Field, value: string) => {
    if (field === 'name' && value.trim() && value.trim() !== workspace.name) void renameWorkspace(wid, value)
    if (field === 'description' && value.trim() !== description) void describeWorkspace(wid, value)
  }

  const markColor = mark ? colors.diff[mark] : undefined
  const frame = markColor ?? (selected ? colors.cyan : hovered ? colors.hover : colors.edge)
  const measure = (set: (v: number) => void, min: number) => (t: unknown) => {
    const b = (t as { textRenderInfo?: { blockBounds: number[] } }).textRenderInfo?.blockBounds
    if (b) set(Math.max(min, b[3] - b[1]))
  }

  return (
    <group ref={group} position={[x, y, 0.01]}>
      <group ref={content}>
        <mesh
          ref={hit}
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
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Corner brackets, like a viewfinder: grey, lit on hover, cyan when selected. Their height is set as it folds. */}
        {([[-1, 1], [1, 1], [-1, -1], [1, -1]] as const).map(([sx, sy], i) => (
          <group key={`${sx}${sy}`} ref={(g) => void (brackets.current[i] = g)} position-x={sx * bx}>
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

        {/* The right edge's grip: drags the width (D-132). */}
        {editor && (
          <mesh
            ref={grip}
            position={[bx, 0, 0.002]}
            onPointerDown={onEdgeDown}
            onPointerMove={onEdgeMove}
            onPointerUp={onEdgeUp}
            onClick={(e) => e.stopPropagation()}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHovered(true)
              document.body.style.cursor = 'ew-resize'
            }}
            onPointerOut={() => {
              setHovered(false)
              document.body.style.cursor = ''
            }}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}

        {/* The caption: the north star and PROJECT, a label in small mono caps. Folded, PROJECT goes and the star
            stands beside the name's first line. Placed as it folds. */}
        <mesh ref={starMesh}>
          <shapeGeometry args={[star]} />
          <meshBasicMaterial color={colors.magenta} toneMapped={false} />
        </mesh>
        <Text
          ref={caption}
          material={textMaterial}
          font={fontUrls.mono}
          fontSize={CAPTION}
          letterSpacing={0.12}
          color={colors.fgDim}
          anchorX="left"
          anchorY="middle"
          position-x={left + STAR * 2 + 0.16}
        >
          PROJECT
        </Text>

        <Text
          ref={nameText}
          visible={editing !== 'name'}
          material={textMaterial}
          font={fontUrls.display}
          fontSize={folded ? foldSize : NAME}
          lineHeight={NAME_LEADING}
          letterSpacing={NAME_TRACK}
          maxWidth={folded ? tw - foldIn : tw}
          overflowWrap="break-word"
          color={colors.fg}
          anchorX="left"
          anchorY="top"
          onSync={(t: TroikaText) => void (laidOutAt.current = t.fontSize)}
        >
          {name}
        </Text>

        {/* The rule: a magenta lead, then a hairline across the block. */}
        <mesh ref={ruleLead} position-x={left + 0.6}>
          <planeGeometry args={[1.2, RULE]} />
          <meshBasicMaterial color={colors.magenta} toneMapped={false} transparent />
        </mesh>
        <mesh ref={ruleLine} position-x={left + 1.2 + (tw - 1.2) / 2}>
          <planeGeometry args={[tw - 1.2, STROKE / 2]} />
          <meshBasicMaterial color={colors.edgeFaint} toneMapped={false} transparent />
        </mesh>

        {showDesc && (
          <Text
            ref={descText}
            material={textMaterial}
            font={fontUrls.display}
            fontSize={DESC}
            lineHeight={DESC_LEADING}
            maxWidth={descWidth(tw)}
            color={description ? colors.fg : colors.fgDim}
            anchorX="left"
            anchorY="top"
            position-x={left}
            onSync={measure(setDescH, DESC * DESC_LEADING)}
          >
            {description || 'What are you building? Double-click to write it.'}
          </Text>
        )}

        {/* The preview's mark: the brackets in the change's colour, its sign and what it replaced under the block. */}
        {markColor && mark && (
          <Text
            ref={markText}
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.26}
            maxWidth={tw}
            color={markColor}
            anchorX="left"
            anchorY="top"
            position-x={left}
          >
            {`${MARK_SIGN[mark]} ${was ? `${was.label} ${was.value.length > 90 ? `${was.value.slice(0, 89)}…` : was.value}` : 'edited'}`}
          </Text>
        )}
      </group>

      {editing && (
        <TitleInput
          field={editing}
          size={editing === 'name' ? (folded ? foldSize : NAME) : DESC}
          width={editing === 'name' ? (folded ? tw - foldIn : tw) : descWidth(tw)}
          value={editing === 'name' ? workspace.name : description}
          at={editing === 'name' ? (folded ? [left + foldIn, foldH / 2] : [left, nameTop]) : [left, descTop]}
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
function TitleInput({ field, size, width, value, at, onDone }: { field: Field; size: number; width: number; value: string; at: [number, number]; onDone: (next: string | null) => void }) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const done = useRef(false)
  // Pixels per board unit right now, so the field matches the text it replaces.
  // Follows the zoom while it's open (D-160).
  const ppu = useDetail((s) => s.ppu)

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
  const fontPx = Math.max(12, size * ppu)
  const widthPx = width * ppu

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
