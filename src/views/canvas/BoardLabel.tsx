// Text written on the board (D-050): a heading over an area, like "Competitors", or a paragraph (D-156). Drag to move,
// double-click to edit; while editing, a DOM field sits over it (text you type is never WebGL).
// A heading (H1–H3) is set left-aligned on its centre, with an optional small line over it (`02 who we beat`, the
// number in the accent) and, for an H1, a rule fading out to the right. A paragraph wraps at its width (its right edge
// drags it) and reads light Markdown; a hairline runs down its left side. Either can be turned a quarter either way.
// Hovered or selected, a dashed box goes round it.
import { Html, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, MathUtils, MeshBasicMaterial, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { WithId } from '../../data/hooks'
import { deleteLabel, endLabelMove, endTextResize, moveLabel, resizeText, updateLabel, type LabelEdit, type TextSpan } from '../../data/labels'
import { KICKER_MAX, LABEL_TEXT_MAX, LONG_TEXT_MAX, type Label } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { usePalette, useThemeAccent } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { BoardLine } from './BoardLine'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'
import { glideDt } from './cardLayout'
import { rightPress } from './rightClick'
import { useReadable } from './detail'
import { endGroup, moveGroup, startGroup } from './groupDrag'
import { boardPoint } from './NodeCard'
import { focusField } from './focusField'
import { clearGuides, placeDragged, unitsPerPixel } from './guides'
import { snapPoint } from './snap'
import { TextBlock } from './TextBlock'
import { MARK_SIGN, type Mark } from '../workspace/preview'
import { editLocked } from '../workspace/viewerLock'
import { markHover, unlight } from '../workspace/stage'
import {
  MAX_PARA_W,
  MIN_PARA_W,
  PARA_LEADING,
  inputStyle,
  isParagraph,
  kickerParts,
  kickerSize,
  labelFace,
  labelSize,
  labelTracking,
  layoutOf,
  paraBox,
  paraSetting,
  shownText,
  turnRad,
} from './textStyle'
import styles from './BoardLabel.module.css'

// Sizes and setting live in textStyle.ts (D-108, D-130, D-156).
export { LABEL_SIZE, labelSize } from './textStyle'
const WRITE_EVERY_MS = 120
const PAD = 0.18
// Geist Mono's advance, of its size.
const MONO_ADVANCE = 0.6

// [x0, y0, x1, y1] round the text, level, from its centre.
type Box = [number, number, number, number]

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
  const getThree = useThree((s) => s.get)
  const selected = useCanvas((s) => s.selection.includes(label.id))
  const only = useCanvas((s) => s.selection.length === 1 && s.selection[0] === label.id)
  const editing = useCanvas((s) => s.editingLabel === label.id)
  const live = useCanvas((s) => s.dragging[label.id])
  const { select, toggleSelect, setDragging, setEditingLabel } = useCanvas.getState()
  const size = labelSize(label)
  const paragraph = isParagraph(label)
  const [hovered, setHovered] = useState(false)
  // Text that would be under a few pixels on screen is left out rather than drawn as a smudge (D-111).
  const readable = useReadable(size)
  // A heading's text, measured once it's laid out: [width, height].
  const [measured, setMeasured] = useState<[number, number]>([2, size])
  // A paragraph's width while its edge is dragged, ahead of Firestore.
  const [span, setSpan] = useState<TextSpan | null>(null)

  const drag = useRef<{ dx: number; dy: number; from: [number, number]; lastWrite: number; moved: boolean; group: boolean } | null>(null)
  const [x, y] = span ? [span.x, span.y] : (live ?? [label.x, label.y])
  const colors = usePalette()
  const tone = useThemeAccent()
  const deleted = mark === 'deleted'
  const accent = deleted ? colors.fgDim : label.color ? tone(label.color) : colors.fg
  const markColor = mark ? colors.diff[mark] : undefined
  const turn = turnRad(label)

  // Exactly under the pointer while dragging; remote moves glide (D-061).
  useFrame(({ invalidate }, delta) => {
    const dt = glideDt(delta)
    const g = group.current
    if (!g) return
    // Also when carried along in a group drag (groupDrag.ts).
    if (drag.current || live || span) g.position.set(x, y, 0.01)
    else {
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
    // In line with other cards (D-117) or on the grid (D-112), as switched on; alt drags freely.
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

  const text = label.text.trim()
  const shown = text ? shownText(label, text) : 'Text'

  // The heading's parts, laid out from its centre: the text centred there, the small line over its left edge, the rule
  // under it.
  const kicker = paragraph ? null : kickerParts(label.kicker)
  const ks = kickerSize(size)
  const [tw, th] = measured
  const left = -tw / 2
  const kickY = th / 2 + size * 0.2 + ks / 2
  const numW = kicker?.num ? kicker.num.length * ks * MONO_ADVANCE * 1.1 : 0
  const restAt = left + (kicker?.num ? numW + ks * 0.7 : 0)
  const restText = kicker ? (kicker.num && kicker.rest ? `── ${kicker.rest}` : kicker.rest) : ''
  const kickW = kicker ? restAt - left + restText.length * ks * MONO_ADVANCE * 1.14 : 0
  const ruled = !paragraph && (label.size ?? 'heading') === 'heading'
  const ruleY = -th / 2 - size * 0.22
  const ruleW = Math.max(tw, kickW) * 1.3

  const para = paragraph ? paraBox(span ? { ...label, w: span.w } : label) : null
  const box: Box = para
    ? [-para[0] / 2 - size * 0.6, -para[1] / 2, para[0] / 2, para[1] / 2]
    : [Math.min(left, -tw / 2), ruled ? ruleY : -th / 2, Math.max(tw / 2, left + kickW), kicker ? kickY + ks / 2 : th / 2]
  const bw = box[2] - box[0]
  const bh = box[3] - box[1]
  const bc: [number, number] = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]

  const frame = (pad: number): [number, number, number][] => [
    [box[0] - pad, box[3] + pad, 0],
    [box[2] + pad, box[3] + pad, 0],
    [box[2] + pad, box[1] - pad, 0],
    [box[0] - pad, box[1] - pad, 0],
    [box[0] - pad, box[3] + pad, 0],
  ]

  const ink = useMemo(
    () => ({
      text: label.color ? accent : colors.fg,
      strong: label.color ? accent : colors.fgStrong,
      dim: colors.fgDim,
      link: colors.cyan,
      code: colors.edgeLabel,
    }),
    [label.color, accent, colors],
  )

  return (
    <group ref={group} position={[x, y, 0.01]}>
      <group rotation={[0, 0, turn]}>
        <group ref={content}>
          <mesh
            position={[bc[0], bc[1], 0]}
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
            <planeGeometry args={[bw + PAD * 2, bh + PAD * 2]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {/* The preview's mark (D-096): an underline in the change's colour, its diff sign before the text, a strike
              through a removed label, and a renamed one's old text under it. */}
          {markColor && mark && !editing && (
            <>
              <mesh position={[bc[0], box[1] - 0.08, 0]}>
                <planeGeometry args={[bw, lit ? 0.07 : 0.035]} />
                <meshBasicMaterial color={markColor} toneMapped={false} />
              </mesh>
              <Text material={textMaterial} font={fontUrls.mono} fontSize={0.34} color={markColor} anchorX="right" anchorY="middle" position={[box[0] - 0.16, bc[1], 0]}>
                {MARK_SIGN[mark]}
              </Text>
              {deleted && (
                <mesh position={[bc[0], bc[1] - 0.02, 0.001]}>
                  <planeGeometry args={[bw + 0.1, 0.035]} />
                  <meshBasicMaterial color={markColor} toneMapped={false} />
                </mesh>
              )}
              {was && (
                <Text material={textMaterial} font={fontUrls.mono} fontSize={0.16} color={colors.fgDim} anchorX="center" anchorY="top" position={[bc[0], box[1] - 0.2, 0]}>
                  {`${was.label} ${was.value}`}
                </Text>
              )}
            </>
          )}
          {/* Hovered or selected: a dashed box round it, grey or cyan. */}
          {(selected || hovered) && !editing && !mark && (
            <BoardLine points={frame(PAD)} color={selected ? colors.cyan : colors.hover} lineWidth={1} dashed dashSize={0.1} gapSize={0.07} toneMapped={false} />
          )}

          {paragraph && para && (
            <>
              {/* The hairline down its left side. */}
              <BoardLine
                points={[
                  [box[0], box[3], 0],
                  [box[0], box[1], 0],
                ]}
                color={label.color ? accent : colors.edgeFaint}
                lineWidth={1}
                toneMapped={false}
              />
              {!editing && (
                <group position={[-para[0] / 2, para[1] / 2, 0]}>
                  <TextBlock text={shown} setting={paraSetting(span ? { ...label, w: span.w } : label)} ink={text ? ink : { ...ink, text: colors.fgDim }} />
                </group>
              )}
            </>
          )}

          {!paragraph && !editing && (
            <>
              <Text
                visible={readable}
                material={textMaterial}
                font={labelFace(label)}
                fontSize={size}
                letterSpacing={labelTracking(label)}
                color={text ? accent : colors.fgDim}
                anchorX="center"
                anchorY="middle"
                onSync={(t) => {
                  const b = (t as unknown as { textRenderInfo?: { blockBounds: number[] } }).textRenderInfo?.blockBounds
                  if (b) setMeasured([Math.max(size, b[2] - b[0]), Math.max(size, b[3] - b[1])])
                }}
              >
                {shown}
              </Text>
              {kicker && (
                <>
                  {kicker.num && (
                    <Text visible={readable} material={textMaterial} font={fontUrls.mono} fontSize={ks} letterSpacing={0.1} color={label.color ? accent : colors.magenta} anchorX="left" anchorY="middle" position={[left, kickY, 0]}>
                      {kicker.num}
                    </Text>
                  )}
                  {restText && (
                    <Text visible={readable} material={textMaterial} font={fontUrls.mono} fontSize={ks} letterSpacing={0.14} color={colors.fgDim} anchorX="left" anchorY="middle" position={[restAt, kickY, 0]}>
                      {restText}
                    </Text>
                  )}
                </>
              )}
              {ruled && <FadingRule at={[left, ruleY]} width={ruleW} height={Math.max(0.012, size * 0.028)} color={label.color ? accent : colors.fgDim} />}
            </>
          )}
        </group>

        {/* A paragraph's right edge, dragged: its width. */}
        {paragraph && para && only && !editing && !mark && !editLocked() && (
          <WidthHandle
            wid={wid}
            label={label}
            at={[para[0] / 2, 0]}
            color={colors.cyan}
            bg={colors.bg}
            onSpan={setSpan}
          />
        )}
      </group>
      {editing &&
        (paragraph && para ? (
          <ParagraphInput wid={wid} label={label} at={[-para[0] / 2, para[1] / 2]} onDone={() => setEditingLabel(null)} />
        ) : (
          <LabelInput wid={wid} label={label} size={size} onDone={() => setEditingLabel(null)} />
        ))}
      <CardReveal content={content} uniforms={cell} />
    </group>
  )
}

// A rule that fades out to the right, from its left end.
let fade: CanvasTexture | null = null
function fadeMap() {
  if (fade) return fade
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 1
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 128, 0)
  g.addColorStop(0, '#fff')
  g.addColorStop(1, '#000')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 1)
  fade = new CanvasTexture(c)
  return fade
}

function FadingRule({ at, width, height, color }: { at: [number, number]; width: number; height: number; color: string }) {
  return (
    <mesh position={[at[0] + width / 2, at[1], 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={color} alphaMap={fadeMap()} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

// Where a paragraph's centre goes when its box changes size with one corner kept: its top-left, as you read it (a
// turned one's too).
export function keepTopLeft(l: Pick<Label, 'x' | 'y' | 'rotate'>, from: [number, number], to: [number, number]): [number, number] {
  const r = ((l.rotate ?? 0) * Math.PI) / 180
  const dir: [number, number] = [Math.cos(r), Math.sin(r)]
  const up: [number, number] = [-Math.sin(r), Math.cos(r)]
  const dw = (to[0] - from[0]) / 2
  const dh = (to[1] - from[1]) / 2
  return [l.x + dir[0] * dw - up[0] * dh, l.y + dir[1] * dw - up[1] * dh]
}

// The grip on a paragraph's right edge: drag it to set how wide the text runs, the left edge and top staying put.
function WidthHandle({
  wid,
  label,
  at,
  color,
  bg,
  onSpan,
}: {
  wid: string
  label: WithId<Label>
  at: [number, number]
  color: string
  bg: string
  onSpan: (s: TextSpan | null) => void
}) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const drag = useRef<{ from: TextSpan; box: [number, number]; left: [number, number]; lastWrite: number; last: TextSpan | null } | null>(null)
  const H = 0.36
  const W = 0.12
  const r = turnRad(label)

  const spanAt = (p: [number, number], free: boolean, d: NonNullable<typeof drag.current>): TextSpan => {
    // How far along the text's own direction from its left edge.
    const along = (p[0] - d.left[0]) * Math.cos(r) + (p[1] - d.left[1]) * Math.sin(r)
    const snapped = free ? along : snapPoint([along, 0], false)[0]
    const w = MathUtils.clamp(snapped, MIN_PARA_W, MAX_PARA_W)
    const next = paraBox({ ...label, w })
    const [x, y] = keepTopLeft(label, d.box, next)
    return { x, y, w }
  }

  return (
    <mesh
      position={[at[0] + W / 2, at[1], 0.002]}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        if (controls) controls.enabled = false
        const box = paraBox(label)
        const left: [number, number] = [label.x - (Math.cos(r) * box[0]) / 2, label.y - (Math.sin(r) * box[0]) / 2]
        drag.current = { from: { x: label.x, y: label.y, w: box[0] }, box, left, lastWrite: 0, last: null }
        ;(e.target as Element).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const d = drag.current
        const p = d && boardPoint(e)
        if (!d || !p) return
        const next = spanAt(p, e.altKey, d)
        d.last = next
        onSpan(next)
        const now = performance.now()
        if (now - d.lastWrite > WRITE_EVERY_MS) {
          d.lastWrite = now
          void resizeText(wid, label.id, next)
        }
      }}
      onPointerUp={(e) => {
        const d = drag.current
        if (!d) return
        e.stopPropagation()
        drag.current = null
        ;(e.target as Element).releasePointerCapture(e.pointerId)
        if (controls) controls.enabled = true
        if (d.last) void endTextResize(wid, label.id, d.from, d.last).then(() => onSpan(null), () => onSpan(null))
        else onSpan(null)
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = Math.abs(label.rotate ?? 0) === 90 ? 'ns-resize' : 'ew-resize'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <planeGeometry args={[W * 2.5, H * 1.6]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <group position={[0, 0, 0.001]}>
        <mesh>
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial color={bg} toneMapped={false} />
        </mesh>
        <BoardLine
          points={[
            [-W / 2, H / 2, 0.001],
            [W / 2, H / 2, 0.001],
            [W / 2, -H / 2, 0.001],
            [-W / 2, -H / 2, 0.001],
            [-W / 2, H / 2, 0.001],
          ]}
          color={color}
          lineWidth={1}
          toneMapped={false}
        />
      </group>
    </mesh>
  )
}

// Enter or clicking away saves; Escape cancels. Text left empty deletes the label. A heading's small line has its own
// field over it (Tab between the two).
function LabelInput({ wid, label, size, onDone }: { wid: string; label: WithId<Label>; size: number; onDone: () => void }) {
  const [draft, setDraft] = useState(label.text)
  const [kick, setKick] = useState(label.kicker ?? '')
  const input = useRef<HTMLInputElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  // How big `size` world units are on screen right now, so the input matches the text it replaces.
  const camera = useThree((s) => s.camera)
  const view = useThree((s) => s.size)
  const fontPx = useMemo(() => size / unitsPerPixel(camera, view.height), [camera, view, size])

  useEffect(() => focusField(() => input.current), [])

  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    const next = draft.trim()
    const nextKick = kick.trim()
    const fields: LabelEdit = {}
    if (next !== label.text) fields.text = next
    if (nextKick !== (label.kicker ?? '')) fields.kicker = nextKick || undefined
    if (save && next && Object.keys(fields).length) void updateLabel(wid, label.id, fields, !label.text.trim())
    // A label that never got any text isn't worth keeping.
    if ((save && !next) || (!save && !label.text.trim())) void deleteLabel(wid, label.id)
    onDone()
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') finish(true)
    if (e.key === 'Escape') finish(false)
  }

  return (
    <Html center zIndexRange={[20, 10]}>
      <div
        ref={wrap}
        className={styles.heading}
        // Clicking away saves; moving between its two fields doesn't.
        onBlur={(e) => {
          if (!wrap.current?.contains(e.relatedTarget as Node)) finish(true)
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          className={styles.kicker}
          style={{ fontSize: `${Math.max(10, kickerSize(size) / unitsPerPixel(camera, view.height))}px` }}
          value={kick}
          maxLength={KICKER_MAX}
          placeholder="01 small line"
          aria-label="Small line over the text"
          onChange={(e) => setKick(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <input
          ref={input}
          className={styles.input}
          style={{ ...inputStyle(label), fontSize: `${Math.max(12, fontPx)}px`, width: `${Math.max(3, draft.length * (label.caps || label.bold ? 0.72 : 0.62) + 0.6)}em` }}
          value={draft}
          maxLength={LABEL_TEXT_MAX}
          placeholder="Text"
          aria-label="Text on the board"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    </Html>
  )
}

// A paragraph's field (D-156): its lines as typed, Markdown and all. Enter is a new line; ⌘Enter or clicking away
// saves, Escape cancels. Its top-left corner stays where it is however long the text gets.
function ParagraphInput({ wid, label, at, onDone }: { wid: string; label: WithId<Label>; at: [number, number]; onDone: () => void }) {
  const [draft, setDraft] = useState(label.text)
  const area = useRef<HTMLTextAreaElement>(null)
  const done = useRef(false)
  const camera = useThree((s) => s.camera)
  const view = useThree((s) => s.size)
  const setting = paraSetting(label)
  const upp = unitsPerPixel(camera, view.height)

  // The caret at the end, nothing selected: it's usually added to.
  useEffect(() => focusField(() => area.current, false), [])
  // As tall as what's in it; drei puts the field on the page a frame or two after it renders, so measured then too.
  const fit = () => {
    const a = area.current
    if (!a?.isConnected) return false
    a.style.height = '0px'
    a.style.height = `${a.scrollHeight}px`
    return true
  }
  useEffect(() => {
    let frames = 10
    const tryFit = () => {
      if (!fit() && frames-- > 0) requestAnimationFrame(tryFit)
    }
    tryFit()
  }, [draft])

  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    const next = draft.replace(/\s+$/, '')
    if (save && next.trim() && next !== label.text) {
      // Kept by its top-left corner: the centre moves by how much the box grew.
      const from = paraBox(label)
      const to = paraBox({ ...label, text: next })
      const [x, y] = keepTopLeft(label, from, to)
      const moved = Math.abs(x - label.x) > 1e-4 || Math.abs(y - label.y) > 1e-4
      void updateLabel(wid, label.id, { text: next, ...(moved ? { x, y } : {}) }, !label.text.trim())
    }
    if ((save && !next.trim()) || (!save && !label.text.trim())) void deleteLabel(wid, label.id)
    onDone()
  }

  // Unturned, at its top-left corner.
  const r = turnRad(label)
  const corner: [number, number] = [at[0] * Math.cos(r) - at[1] * Math.sin(r), at[0] * Math.sin(r) + at[1] * Math.cos(r)]
  const widthPx = Math.max(setting.width, layoutOf(label.text || 'Text', setting).width) / upp
  return (
    <Html position={[corner[0], corner[1], 0]} zIndexRange={[20, 10]}>
      <textarea
        ref={area}
        className={styles.area}
        style={{
          ...inputStyle(label),
          fontSize: `${Math.max(11, setting.size / upp)}px`,
          lineHeight: PARA_LEADING,
          width: `${Math.max(160, widthPx)}px`,
        }}
        rows={1}
        value={draft}
        maxLength={LONG_TEXT_MAX}
        placeholder={'Text: **bold**, *italic*, - bullets'}
        aria-label="Paragraph on the board"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) finish(true)
          if (e.key === 'Escape') finish(false)
        }}
      />
    </Html>
  )
}
