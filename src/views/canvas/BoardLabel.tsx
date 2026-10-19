// Text written on the board (D-050): a heading over an area, like "Competitors", or a paragraph (D-156). Drag to move,
// double-click to edit; while editing, a DOM field sits over it (text you type is never WebGL).
// A heading (H1–H3) is set left-aligned on its centre, with an optional small line over it (`02 who we beat`, the
// number in the accent) and, for an H1, a rule fading out to the right. A paragraph wraps at its width (its right edge
// drags it) and reads light Markdown; a hairline runs down its left side. Either can be turned a quarter either way.
// A sticky note (D-158) is a paragraph in mono on dark paper, a bar of its colour along the top, signed at its foot.
// Hovered or selected, a card's corner marks go round it (D-150, D-163); a paragraph or sticky note has a thin strip
// down its right side that drags its width.
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
import { CardCorners, CORNER_THICK } from './CardCorners'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'
import { glideDt } from './cardLayout'
import { rightPress } from './rightClick'
import { useDetail, useReadable } from './detail'
import { endGroup, moveGroup, startGroup } from './groupDrag'
import { boardPoint } from './NodeCard'
import { focusField } from './focusField'
import { clearGuides, placeDragged, unitsPerPixel } from './guides'
import { snapPoint } from './snap'
import { TextBlock } from './TextBlock'
import { MAX_STICKY_W, MIN_STICKY_W, STICKY_BAR, STICKY_COLOR, STICKY_HEAD, STICKY_PAD, STICKY_TEXT_TOP, ago, isSticky, stickySetting, stickySize, stickyText } from './stickyNote'
import type { Setting } from './richText'
import { MARK_SIGN, type Mark } from '../workspace/preview'
import { editLocked } from '../workspace/viewerLock'
import { markHover, unlight } from '../workspace/stage'
import {
  MAX_PARA_W,
  MIN_PARA_W,
  inputStyle,
  isParagraph,
  kickerParts,
  kickerSize,
  labelFace,
  labelSize,
  labelTracking,
  paraBox,
  paraSetting,
  paraSize,
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
  const sticky = isSticky(label)
  const paragraph = isParagraph(label)
  const size = sticky ? stickyText(label) : paragraph ? paraSize(label) : labelSize(label)
  const [hovered, setHovered] = useState(false)
  // Held down (a press, or a drag): the corners close in, as a card's do.
  const [pressed, setPressed] = useState(false)
  // Text that would be under a few pixels on screen is left out rather than drawn as a smudge (D-111).
  const readable = useReadable(size)
  // A heading's text, measured once it's laid out: [width, height].
  const [measured, setMeasured] = useState<[number, number]>([2, size])
  // A paragraph's width while its edge is dragged, ahead of Firestore.
  const [span, setSpan] = useState<TextSpan | null>(null)
  // A paragraph's or sticky note's text while it's typed, so its box grows with it (D-162).
  const [typing, setTyping] = useState<string | null>(null)

  const drag = useRef<{ dx: number; dy: number; from: [number, number]; lastWrite: number; moved: boolean; group: boolean } | null>(null)
  const typedFlow = typing === null ? null : isParagraph(label) ? PARAGRAPH : isSticky(label) ? STICKY : null
  // While typing, its top-left corner stays put as it grows (D-162).
  const [x, y] = span
    ? [span.x, span.y]
    : typedFlow
      ? keepTopLeft(label, typedFlow.sizeOf(label), typedFlow.sizeOf({ ...label, text: typing! }))
      : (live ?? [label.x, label.y])
  const colors = usePalette()
  const tone = useThemeAccent()
  const deleted = mark === 'deleted'
  const accent = deleted ? colors.fgDim : label.color ? tone(label.color) : sticky ? tone(STICKY_COLOR) : colors.fg
  const markColor = mark ? colors.diff[mark] : undefined
  const turn = turnRad(label)

  // Exactly under the pointer while dragging; remote moves glide (D-061).
  useFrame(({ invalidate }, delta) => {
    const dt = glideDt(delta)
    const g = group.current
    if (!g) return
    // Also when carried along in a group drag (groupDrag.ts).
    if (drag.current || live || span || typing !== null) g.position.set(x, y, 0.01)
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
    setPressed(true)
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
      setPressed(false)
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
  const kicker = paragraph || sticky ? null : kickerParts(label.kicker)
  const ks = kickerSize(size)
  const [tw, th] = measured
  const left = -tw / 2
  const kickY = th / 2 + size * 0.2 + ks / 2
  const numW = kicker?.num ? kicker.num.length * ks * MONO_ADVANCE * 1.1 : 0
  const restAt = left + (kicker?.num ? numW + ks * 0.7 : 0)
  const restText = kicker ? (kicker.num && kicker.rest ? `── ${kicker.rest}` : kicker.rest) : ''
  const kickW = kicker ? restAt - left + restText.length * ks * MONO_ADVANCE * 1.14 : 0
  const ruled = !paragraph && !sticky && (label.size ?? 'heading') === 'heading'
  const ruleY = -th / 2 - size * 0.22
  const ruleW = Math.max(tw, kickW) * 1.3

  // A paragraph or a sticky note: text that flows at a width.
  const sized = { ...label, ...(span && { w: span.w }), ...(typing !== null && { text: typing }) }
  const flow = paragraph ? PARAGRAPH : sticky ? STICKY : null
  const para = flow ? flow.sizeOf(sized) : null
  const box: Box = para
    ? [-para[0] / 2 - (paragraph ? size * 0.6 : 0), -para[1] / 2, para[0] / 2, para[1] / 2]
    : [Math.min(left, -tw / 2), ruled ? ruleY : -th / 2, Math.max(tw / 2, left + kickW), kicker ? kickY + ks / 2 : th / 2]
  const bw = box[2] - box[0]
  const bh = box[3] - box[1]
  const bc: [number, number] = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]

  // The colour its marks take once it's held or selected: its own, or the text's.
  const markTone = label.color || sticky ? accent : colors.fg

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
          {/* Hovered or selected: a card's corner marks round it (D-150), on a sticky note's paper edge, a little clear of text. */}
          {!mark && (
            <group position={[bc[0], bc[1], 0.002]}>
              <CardCorners
                w={bw + (sticky ? 0 : PAD)}
                h={bh + (sticky ? 0 : PAD)}
                // Also while it's being edited: the box grows with what's typed.
                on={editing || hovered || pressed || selected || !!span}
                out={pressed ? -CORNER_THICK : selected || editing ? 0.06 : 0.12}
                len={pressed ? 0.28 : 0.2}
                color={pressed || selected || editing || span ? markTone : colors.hover}
              />
            </group>
          )}

          {sticky && para && (
            <>
              {/* A shade quieter than a card. */}
              <mesh position={[0, 0, -0.002]}>
                <planeGeometry args={[para[0], para[1]]} />
                <meshBasicMaterial color={colors.cardBehind} toneMapped={false} />
              </mesh>
              <mesh position={[0, para[1] / 2 - STICKY_BAR / 2, -0.001]}>
                <planeGeometry args={[para[0], STICKY_BAR]} />
                <meshBasicMaterial color={accent} toneMapped={false} />
              </mesh>
              <StickyMark at={[para[0] / 2 - STICKY_PAD, para[1] / 2 - STICKY_BAR - STICKY_PAD * 0.8 - STICKY_HEAD / 2]} color={accent} />
              {!editing && (
                <group position={STICKY.textAt(para)}>
                  <TextBlock text={text || 'Write something…'} setting={stickySetting(sized)} ink={text ? { ...ink, text: colors.fg, strong: colors.fgStrong } : { ...ink, text: colors.fgDim }} />
                </group>
              )}
              {/* Who wrote it and when, small, along the top. */}
              <Text material={textMaterial} font={fontUrls.mono} fontSize={STICKY_HEAD} letterSpacing={0.08} color={colors.fgDim} anchorX="left" anchorY="middle" position={[-para[0] / 2 + STICKY_PAD, para[1] / 2 - STICKY_BAR - STICKY_PAD * 0.8 - STICKY_HEAD / 2, 0]}>
                {`${(label.author ?? 'someone').split(/\s+/)[0].toUpperCase()} · ${ago(label.createdAt)}`}
              </Text>
            </>
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
                <group position={PARAGRAPH.textAt(para)}>
                  <TextBlock text={shown} setting={paraSetting(sized)} ink={text ? ink : { ...ink, text: colors.fgDim }} />
                </group>
              )}
            </>
          )}

          {!flow && !editing && (
            <>
              {/* Always drawn, however small, like a paragraph: headings are what you find your way by zoomed out. */}
              <Text
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

        {/* A paragraph's or sticky note's right side, dragged: its width (D-163). */}
        {flow && para && !editing && !mark && !editLocked() && (
          <WidthHandle
            wid={wid}
            label={label}
            flow={flow}
            at={[para[0] / 2, 0]}
            height={para[1]}
            shown={hovered || only || !!span}
            color={only || span ? markTone : colors.hover}
            onHover={setHovered}
            onSpan={setSpan}
          />
        )}
      </group>
      {editing &&
        (flow && para ? (
          <ParagraphInput
            wid={wid}
            label={label}
            flow={flow}
            at={flow.textAt(para)}
            onDraft={setTyping}
            onDone={() => {
              setEditingLabel(null)
              // Held a moment, until the saved text is in, so the box doesn't jump back and forth.
              setTimeout(() => setTyping(null), 300)
            }}
          />
        ) : (
          <LabelInput wid={wid} label={label} size={size} onDone={() => setEditingLabel(null)} />
        ))}
      <CardReveal content={content} uniforms={cell} />
    </group>
  )
}

// Text that flows at a width (D-156, D-158): its size from its text and width, how it's set, where its text starts
// (from the centre, level), and how narrow or wide its edge may drag it.
type Flow = {
  sizeOf: (l: Label) => [number, number]
  setting: (l: Label) => Setting
  textAt: (box: [number, number]) => [number, number, number]
  min: number
  max: number
  mono?: boolean
}
const PARAGRAPH: Flow = {
  sizeOf: paraBox,
  setting: paraSetting,
  textAt: ([w, h]) => [-w / 2, h / 2, 0],
  min: MIN_PARA_W,
  max: MAX_PARA_W,
}
const STICKY: Flow = {
  sizeOf: stickySize,
  setting: stickySetting,
  textAt: ([w, h]) => [-w / 2 + STICKY_PAD, h / 2 - STICKY_TEXT_TOP, 0],
  min: MIN_STICKY_W,
  max: MAX_STICKY_W,
  mono: true,
}

// A sticky note's corner mark: three little checks, like ▚▚▚, in its colour.
function StickyMark({ at, color }: { at: [number, number]; color: string }) {
  const c = 0.035
  return (
    <group position={[at[0], at[1], 0]}>
      {[0, 1, 2].flatMap((i) =>
        [
          [-i * c * 2.6 - c / 2, c / 2],
          [-i * c * 2.6 - c * 1.5, -c / 2],
        ].map(([dx, dy], j) => (
          <mesh key={`${i}${j}`} position={[dx, dy, 0]}>
            <planeGeometry args={[c, c]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        )),
      )}
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

// The grip down a paragraph's or sticky note's right side (D-163): a thin strip as tall as it, a little clear of its
// edge, shown while it's hovered or selected; drag it to set how wide the text runs, the top-left corner staying put
// (the height follows the text).
const GRIP_GAP = 0.1
const GRIP_W = 0.03
const GRIP_HIT = 0.24
function WidthHandle({
  wid,
  label,
  flow,
  at,
  height,
  shown,
  color,
  onHover,
  onSpan,
}: {
  wid: string
  label: WithId<Label>
  flow: Flow
  at: [number, number]
  height: number
  shown: boolean
  color: string
  onHover: (on: boolean) => void
  onSpan: (s: TextSpan | null) => void
}) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const drag = useRef<{ from: TextSpan; box: [number, number]; left: [number, number]; lastWrite: number; last: TextSpan | null } | null>(null)
  const r = turnRad(label)

  const spanAt = (p: [number, number], free: boolean, d: NonNullable<typeof drag.current>): TextSpan => {
    // How far along the text's own direction from its left edge.
    const along = (p[0] - d.left[0]) * Math.cos(r) + (p[1] - d.left[1]) * Math.sin(r)
    const snapped = free ? along : snapPoint([along, 0], false)[0]
    const w = MathUtils.clamp(snapped, flow.min, flow.max)
    const next = flow.sizeOf({ ...label, w })
    // From where it was when the drag began: the streamed writes move `label` meanwhile (D-160).
    const [x, y] = keepTopLeft({ ...label, x: d.from.x, y: d.from.y }, d.box, next)
    return { x, y, w }
  }

  return (
    <group position={[at[0] + GRIP_GAP + GRIP_W / 2, at[1], 0.004]}>
      {shown && (
        <mesh>
          <planeGeometry args={[GRIP_W, Math.max(0.2, height * 0.6)]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
      <mesh
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          if (controls) controls.enabled = false
          const box = flow.sizeOf(label)
          const left: [number, number] = [label.x - (Math.cos(r) * box[0]) / 2, label.y - (Math.sin(r) * box[0]) / 2]
          drag.current = { from: { x: label.x, y: label.y, w: box[0] }, box, left, lastWrite: 0, last: null }
          useCanvas.getState().select(label.id)
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
          onHover(true)
          document.body.style.cursor = Math.abs(label.rotate ?? 0) === 90 ? 'ns-resize' : 'ew-resize'
        }}
        onPointerOut={() => {
          onHover(false)
          document.body.style.cursor = ''
        }}
      >
        <planeGeometry args={[GRIP_HIT, Math.max(0.3, height)]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
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
  // Follows the zoom while it's open (D-160), so the field always matches the text it replaces.
  const ppu = useDetail((s) => s.ppu)
  const fontPx = size * ppu

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
          style={{ fontSize: `${Math.max(10, kickerSize(size) * ppu)}px` }}
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
function ParagraphInput({
  wid,
  label,
  flow,
  at,
  onDraft,
  onDone,
}: {
  wid: string
  label: WithId<Label>
  flow: Flow
  at: [number, number, number]
  // What's typed so far, for the box round it.
  onDraft: (text: string) => void
  onDone: () => void
}) {
  const [draft, setDraft] = useState(label.text)
  const area = useRef<HTMLTextAreaElement>(null)
  const done = useRef(false)
  const setting = flow.setting(label)
  // Follows the zoom while it's open (D-160).
  const upp = 1 / useDetail((s) => s.ppu)

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
      const from = flow.sizeOf(label)
      const to = flow.sizeOf({ ...label, text: next })
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
  // Exactly the drawn text's size, width and line height (D-162), so what's typed wraps as it will be drawn and the box
  // round it grows with it. Under 11 px it's set at 11 and scaled down, which stays readable while typing.
  const fontPx = setting.size / upp
  const base = Math.max(11, fontPx)
  const k = fontPx / base
  return (
    <Html position={[corner[0], corner[1], 0]} zIndexRange={[20, 10]}>
      <textarea
        ref={area}
        className={styles.area}
        data-mono={flow.mono || undefined}
        style={{
          ...inputStyle(label),
          fontSize: `${base}px`,
          lineHeight: setting.leading,
          width: `${setting.width / upp / k}px`,
          transform: k < 1 ? `scale(${k})` : undefined,
          transformOrigin: 'top left',
        }}
        rows={1}
        value={draft}
        maxLength={LONG_TEXT_MAX}
        placeholder={'Text: **bold**, *italic*, - bullets'}
        aria-label="Paragraph on the board"
        onChange={(e) => {
          setDraft(e.target.value)
          onDraft(e.target.value)
        }}
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
