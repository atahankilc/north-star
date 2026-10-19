// One card on the board: a flat card with SDF text (D-019). Every type has the same shape; a left border and a small
// label in the type's colour say what it is (D-055). Tags (white #chips) group cards within a type (D-056).
// Notes stay in the panel, not on the card (D-057), so cards stay small.
// Editing happens in the DetailPanel.
import { Html, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { memo, useMemo, useRef, useState } from 'react'
import { MathUtils, MeshBasicMaterial, Plane, Vector3, type Group, type Object3D } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { endMove, moveNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { isReducedMotion } from '../../state/motion'
import { usePalette, useThemeAccent } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { BOARD_KINDS, typeAccent, type BoardItem } from './boardKinds'
import { CARD_H, CARD_W, glideDt, truncate } from './cardLayout'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'
import { COMPACT_TITLE, useDetail } from './detail'
import { FarNode } from './FarNode'
import { rightPress } from './rightClick'
import { endGroup, groupIds, moveGroup, startGroup } from './groupDrag'
import { CardCorners, CORNER_THICK } from './CardCorners'
import { ProofCells, proofWidth, TagChips } from './CardFacts'
import { clearGuides, placeDragged, unitsPerPixel } from './guides'
import { MARK_SIGN, type Mark } from '../workspace/preview'
import { editLocked } from '../workspace/viewerLock'
import { markHover, unlight } from '../workspace/stage'
import styles from './NodeCard.module.css'

const BOARD = new Plane(new Vector3(0, 0, 1), 0)
const hit = new Vector3()
const WRITE_EVERY_MS = 120
// Rings around a card for each collaborator who has it selected: one band each, with a dark gap between.
const RING = 0.05
const RING_GAP = 0.025

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
  // A competitor's features, waiting behind it as a stack (D-058); 0 when fanned out or not a competitor.
  stack?: number
  // Collaborators who have this card selected, in their colours (D-065, D-067).
  peers?: { name: string; color: string }[]
  // The assistant's preview (D-096): what a change does to it, an edit's old value in a few words, and whether its
  // checklist row is lit.
  mark?: Mark
  was?: { label: string; value: string }
  lit?: boolean
  // The card the focus view is on (D-127): a magenta ring.
  centre?: boolean
  onLinkDrop: (targetId: string) => void
}

// Where the lines of a text sit, from troika's caret positions (left, right, bottom, top per character): for strikes.
type Strike = { x0: number; x1: number; y: number }
type TextLayout = { caretPositions?: Float32Array }
function strikesOf(info: TextLayout | undefined): Strike[] {
  const c = info?.caretPositions
  if (!c) return []
  const lines = new Map<number, Strike>()
  for (let i = 0; i < c.length; i += 4) {
    const bottom = c[i + 2]
    const key = Math.round(bottom * 1000)
    const y = bottom + (c[i + 3] - bottom) * 0.42
    const l = lines.get(key)
    if (l) {
      l.x0 = Math.min(l.x0, c[i], c[i + 1])
      l.x1 = Math.max(l.x1, c[i], c[i + 1])
    } else lines.set(key, { x0: Math.min(c[i], c[i + 1]), x1: Math.max(c[i], c[i + 1]), y })
  }
  return [...lines.values()].filter((l) => l.x1 > l.x0)
}

function StrikeLines({ strikes, color, z = 0.003 }: { strikes: Strike[]; color: string; z?: number }) {
  return strikes.map((l, i) => (
    <mesh key={i} position={[(l.x0 + l.x1) / 2, l.y, z]}>
      <planeGeometry args={[l.x1 - l.x0 + 0.04, 0.014]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  ))
}

const isWithin = (o: Object3D | null, root: Object3D | null) => {
  for (; o; o = o.parent) if (o === root) return true
  return false
}

const BADGE = 0.17
// The card's layout (D-152): everything this far in from its edges (and from the type stripe on the left); a header
// row (type, status), the title, then the facts line and the tag chips.
const PAD = 0.06
const STRIPE = 0.06
const SMALL = 0.072
// The link handle (D-152): a `›` just right of a hovered card.
const HANDLE = 0.3
// What the pointer can grab round it: a band over the card's right edge, wider and taller than the `›`.
const HANDLE_HIT: [number, number] = [0.32, 0.5]
const WAS_H = 0.24
// How small a card goes while it's dragged (D-150): its corner marks show where it lands, full size.
const CARRIED = 0.8
// How far the pointer goes, in screen pixels, before a press on a card becomes a drag.
const DRAG_PX = 5

// Memoised: hovering, dragging or selecting one card re-renders the board, and only the cards whose props changed
// should follow.
export const NodeCard = memo(function NodeCard({ wid, item: node, layer, related, stack = 0, peers = [], mark, was, lit = false, centre = false, onLinkDrop }: Props) {
  const type = node.type
  const W = CARD_W
  const H = CARD_H
  const group = useRef<Group>(null)
  const content = useRef<Group>(null)
  const corners = useRef<Group>(null)
  const scale = useRef(1)
  // Just dropped after a drag: it glides from under the pointer to where it landed, even while a group drag's last
  // write keeps it in `dragging`.
  const settle = useRef(false)
  // Where the card is drawn on the board, before it's lifted for stacking (see `flat` below).
  const shown = useRef<[number, number]>([node.x, node.y])
  // Cell-by-cell entrance (D-034): shared by all of this card's materials. Text gets its own base
  // material so the reveal doesn't leak into troika's shared default.
  const cell = useMemo(makeCellUniforms, [])
  const textMaterial = useMemo(() => {
    const m = new MeshBasicMaterial()
    installCellReveal(m, cell)
    return m
  }, [cell])
  const [hovered, setHovered] = useState(false)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const getThree = useThree((s) => s.get)

  const selected = useCanvas((s) => s.selection.includes(node.id))
  const live = useCanvas((s) => s.dragging[node.id])
  const isLinkSource = useCanvas((s) => s.linkFrom === node.id)
  const isLinkTarget = useCanvas((s) => s.linkFrom !== null && s.linkFrom !== node.id) && hovered
  const pressing = useCanvas((s) => s.pressing)
  const { select, toggleSelect, startLink, endLink, setDragging, setPressing, setHover } = useCanvas.getState()

  // `group`: the card is one of several selected, and they all move with it (groupDrag.ts). `press`: where on screen it
  // was pressed. `raw`: where the pointer would put it, before the grid or the guides place it.
  const drag = useRef<{ dx: number; dy: number; from: [number, number]; lastWrite: number; moved: boolean; group: boolean; press: [number, number]; raw?: [number, number] } | null>(null)
  // Shift held at the press: a link if the pointer leaves the card, a toggle of the selection if it doesn't.
  const shiftPress = useRef(false)
  const overHandle = useRef(false)
  const [handleHot, setHandleHot] = useState(false)

  const [x, y] = live ?? [node.x, node.y]
  // Dragged by this tab's card drag (D-150): the one held, or carried along in a group drag that a card started. Not
  // when a section carries it, and not the moment after the drop while the last write is still on its way.
  const carried = !!live && pressing !== null && (pressing === node.id || !!groupIds()?.has(node.id))
  const colors = usePalette()
  const tone = useThemeAccent()
  const deleted = mark === 'deleted'
  // A deleted card stays on the preview, greyed out (D-096).
  const accent = deleted ? colors.fgDim : typeAccent(type, colors)
  const markColor = mark ? colors.diff[mark] : undefined
  // How it's drawn depends on how big it is on screen (D-111): everything; the title alone, bigger and centred, once
  // the small text can't be read; or, with no text readable at all, a star in its type's colour (FarNode).
  const detail = useDetail((s) => s.card)
  const full = detail === 'full'
  const far = detail === 'far'
  // troika reports a text's layout only when it changes, so the title's is kept for whenever the card gets deleted.
  const [titleLayout, setTitleLayout] = useState<TextLayout>()
  const [wasStrikes, setWasStrikes] = useState<Strike[]>([])

  // The card stays flat and doesn't lift (D-061). Only a drag changes its size (D-150): it goes small round the point
  // the pointer holds, so it stays under the pointer, and follows the pointer freely while its corner marks show where
  // the grid or the guides put it. Otherwise it glides to its position, so collaborators' moves animate. The dragged
  // card is drawn on top.
  useFrame(({ camera, invalidate }, delta) => {
    const dt = glideDt(delta)
    const g = group.current
    if (!g) return
    const to = carried ? CARRIED : 1
    scale.current = isReducedMotion() ? to : MathUtils.damp(scale.current, to, 20, dt)
    if (Math.abs(scale.current - to) < 1e-3) scale.current = to
    else invalidate()
    const s = scale.current
    const at = shown.current
    const d = drag.current
    let z = Math.min(layer, 150) * 0.0003
    if (d) {
      // Full size it would sit at `raw`; small, it shrinks toward the point held (`dx`, `dy` from its centre).
      const [rx, ry] = d.raw ?? [x, y]
      at[0] = rx + (1 - s) * d.dx
      at[1] = ry + (1 - s) * d.dy
      z = 0.06
    }
    // Carried along in a group drag (groupDrag.ts): exactly where the drag puts it too, no glide trailing the pointer.
    else if (live && !settle.current) {
      at[0] = x
      at[1] = y
    } else {
      at[0] = MathUtils.damp(at[0], x, 12, dt)
      at[1] = MathUtils.damp(at[1], y, 12, dt)
      if (Math.abs(at[0] - x) > 1e-4 || Math.abs(at[1] - y) > 1e-4) invalidate()
      else settle.current = false
    }
    // Stacking lifts a card toward the camera, which is perspective: drawn as it is, a held card grew a little and
    // slid off the pointer. Each piece is drawn smaller and toward the camera's axis by as much as it's lifted, so it
    // looks exactly as it would on the board (z = 0) and only the stacking is left.
    const flat = (o: Object3D, px: number, py: number, pz: number, ps: number) => {
      const k = (camera.position.z - pz) / camera.position.z
      o.position.set(camera.position.x + (px - camera.position.x) * k, camera.position.y + (py - camera.position.y) * k, pz)
      o.scale.setScalar(ps * k)
    }
    flat(g, at[0], at[1], z, s)
    // The corner marks: where it lands while dragged, otherwise with the card.
    const c = corners.current
    if (c) {
      if (carried) flat(c, x, y, 0.061, 1)
      else flat(c, at[0], at[1], z + 0.003, 1)
    }
  })

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    // A right click opens the board's menu on it (D-117); a right drag pans.
    if (rightPress(e, { kind: 'card', id: node.id })) return
    if (e.button !== 0) return
    e.stopPropagation()
    // Runs before OrbitControls' own listener, so the board doesn't pan.
    if (controls) controls.enabled = false
    const p = boardPoint(e)
    if (!p) return
    setPressing(node.id)
    shiftPress.current = e.shiftKey
    if (e.shiftKey) {
      // The assistant's preview (D-087) can be looked at, not changed: no links there, only selecting.
      if (!editLocked()) startLink(node.id, p)
      return
    }
    // A press on one of several selected cards keeps the selection, so they can be dragged together.
    const group = !editLocked() && startGroup(node.id)
    if (!group) select(node.id)
    if (editLocked()) return
    drag.current = { dx: p[0] - x, dy: p[1] - y, from: [node.x, node.y], lastWrite: 0, moved: false, group, press: [e.clientX, e.clientY] }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  // The handle on the card's right edge: drag from it to link, without knowing about shift (D-108).
  const onHandleDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (controls) controls.enabled = false
    const p = boardPoint(e)
    if (p) startLink(node.id, p)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    // A click that wobbles a little is still a click (D-150): nothing moves or shrinks until the pointer has gone a few
    // pixels, and then it follows the pointer.
    if (!d.moved && Math.hypot(e.clientX - d.press[0], e.clientY - d.press[1]) < DRAG_PX) return
    const p = boardPoint(e)
    if (!p) return
    // In line with other cards (D-117) or on the grid (D-112), as switched on; alt drags freely.
    const { camera, size } = getThree()
    d.raw = [p[0] - d.dx, p[1] - d.dy]
    const next = placeDragged(node.id, d.raw, e.altKey, unitsPerPixel(camera, size.height))
    d.moved = true
    if (d.group) {
      moveGroup(wid, [next[0] - d.from[0], next[1] - d.from[1]])
      return
    }
    setDragging(node.id, next)
    // Stream the move so collaborators see it live, without a write per frame.
    const now = performance.now()
    if (now - d.lastWrite > WRITE_EVERY_MS) {
      d.lastWrite = now
      void moveNode(wid, type, node.id, next[0], next[1])
    }
  }

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    setPressing(null)
    const d = drag.current
    if (d) {
      e.stopPropagation()
      drag.current = null
      settle.current = d.moved
      ;(e.target as Element).releasePointerCapture(e.pointerId)
      clearGuides()
      if (d.group) {
        // A click (no drag) on one of several selected cards picks just that one.
        if (!endGroup(wid)) select(node.id)
      } else {
        const final = useCanvas.getState().dragging[node.id]
        // One undo step for the whole drag.
        if (d.moved && final) void endMove(wid, type, node.id, d.from, final)
        setDragging(node.id, null)
      }
    } else if (useCanvas.getState().linkFrom && !isLinkSource) {
      e.stopPropagation()
      onLinkDrop(node.id)
      endLink()
    } else if (shiftPress.current) {
      // Shift+click without leaving the card: in or out of the selection.
      e.stopPropagation()
      endLink()
      toggleSelect(node.id)
    }
    shiftPress.current = false
    if (controls) controls.enabled = true
  }

  // From far out a card is a star with a ring round it; up close hover and selection are corner marks (D-150), and
  // only a card tagged with the chosen customer keeps an edge.
  const farRim = isLinkTarget ? colors.cyan : selected ? accent : related ? colors.cyan : hovered ? colors.hover : null
  const rim = related ? colors.cyan : null
  const pressed = pressing === node.id
  const title = node.title.trim()
  const left = -W / 2 + STRIPE + PAD
  const right = W / 2 - PAD
  const inner = right - left
  const top = H / 2 - PAD
  const bottom = -H / 2 + PAD
  const titleTop = full ? top - 0.14 : 0
  // The header ends left of the preview's diff sign, when there is one.
  const headRight = mark ? right - BADGE - 0.05 : right
  const proof = node.proof
  const cells = proof ? proofWidth(proof) : 0
  // The facts line sits on the tag chips, or at the bottom without any. Mono text is 0.6 em a character.
  const factsY = node.tags.length ? bottom + 0.17 : bottom
  const factsFit = Math.floor(inner / (SMALL * 0.6))

  return (
    <>
      {/* Hover, press, selection and where a drag lands (D-150): outside the card's group, which shrinks in a drag. */}
      <group ref={corners} position={[x, y, 0]} visible={!far}>
        <CardCorners
          w={W}
          h={H}
          on={hovered || pressed || selected || isLinkTarget || carried}
          // Pressed or dragged they sit on the corners, inside the card (or the spot where it lands).
          out={carried || pressed ? -CORNER_THICK : selected ? 0.06 : 0.12}
          len={carried ? 0.3 : pressed ? 0.32 : 0.22}
          color={isLinkTarget ? colors.cyan : pressed || selected || carried ? accent : colors.hover}
        />
      </group>
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
          setHover(node.id)
          document.body.style.cursor = e.shiftKey || overHandle.current ? 'crosshair' : 'grab'
          // Lights its row in the assistant's checklist (D-096).
          if (mark) markHover(node.id).onPointerEnter()
        }}
        onPointerOut={(e) => {
          // Moving between the card's own parts (body, text, the link handle) isn't leaving it: R3F reports an out
          // whenever the part first hit is no longer under the pointer.
          if (e.intersections.some((h) => isWithin(h.object, group.current))) return
          setHovered(false)
          if (useCanvas.getState().hoverId === node.id) setHover(null)
          document.body.style.cursor = ''
          if (mark) unlight()
        }}
      >
        {far && <FarNode color={accent} rim={farRim} mark={markColor} />}
        <group ref={content} visible={!far}>
          {/* Up to three plates peeking out behind: this competitor has features to fan out. */}
          {Array.from({ length: Math.min(3, stack) }, (_, i) => (
            <group key={i} position={[(i + 1) * 0.07, -(i + 1) * 0.07, -0.006 - i * 0.002]}>
              <mesh>
                <planeGeometry args={[W, H]} />
                <meshBasicMaterial color={colors.cardBehind} toneMapped={false} />
              </mesh>
            </group>
          ))}
          {/* Collaborators' selections: outermost first, each band a little further back. */}
          {peers.map((p, i) => {
            const out = 0.05 + (peers.length - i) * (RING + RING_GAP)
            return (
              <group key={p.name + i} position={[0, 0, -0.003 - (peers.length - i) * 0.0004]}>
                <mesh position={[0, 0, -0.0002]}>
                  <planeGeometry args={[W + out, H + out]} />
                  <meshBasicMaterial color={tone(p.color)} toneMapped={false} />
                </mesh>
                <mesh>
                  <planeGeometry args={[W + out - RING, H + out - RING]} />
                  <meshBasicMaterial color={colors.bg} toneMapped={false} />
                </mesh>
              </group>
            )
          })}
          {/* The preview's mark (D-096): a ring in the change's colour, thicker while its checklist row is lit. */}
          {markColor && (
            // Takes in the "was" strip under the card too.
            <group position={[0, was ? -(WAS_H + 0.02) / 2 : 0, -0.0025]}>
              <mesh position={[0, 0, -0.0002]}>
                <planeGeometry args={[W + (lit ? 0.2 : 0.11), H + (lit ? 0.2 : 0.11) + (was ? WAS_H + 0.02 : 0)]} />
                <meshBasicMaterial color={markColor} toneMapped={false} />
              </mesh>
              <mesh>
                <planeGeometry args={[W + 0.05, H + 0.05 + (was ? WAS_H + 0.02 : 0)]} />
                <meshBasicMaterial color={colors.bg} toneMapped={false} />
              </mesh>
            </group>
          )}
          {/* The focus view's card (D-127): a ring like the preview's, in magenta. */}
          {centre && !markColor && (
            <group position={[0, 0, -0.0025]}>
              <mesh position={[0, 0, -0.0002]}>
                <planeGeometry args={[W + 0.16, H + 0.16]} />
                <meshBasicMaterial color={colors.magenta} toneMapped={false} />
              </mesh>
              <mesh>
                <planeGeometry args={[W + 0.06, H + 0.06]} />
                <meshBasicMaterial color={colors.bg} toneMapped={false} />
              </mesh>
            </group>
          )}
          {/* No edge of its own (D-148): only the highlight when related. */}
          {rim && (
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[W + 0.05, H + 0.05]} />
              <meshBasicMaterial color={rim} toneMapped={false} />
            </mesh>
          )}
          <mesh>
            <planeGeometry args={[W, H]} />
            <meshBasicMaterial color={colors.card} toneMapped={false} />
          </mesh>
          {/* The type, at a glance: a left border and a small label. */}
          <mesh position={[-W / 2 + 0.03, 0, 0.001]}>
            <planeGeometry args={[0.06, H]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
          <Text
            visible={full}
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={SMALL}
            letterSpacing={0.14}
            color={accent}
            anchorX="left"
            anchorY="top"
            position={[left, top, 0.002]}
          >
            {BOARD_KINDS[type].label.toUpperCase()}
          </Text>
          {/* Status (or regions, priority, rating) right of the type, then the evidence as cells (D-152). */}
          {node.head && (
            <Text
              visible={full}
              material={textMaterial}
              font={fontUrls.mono}
              fontSize={SMALL}
              color={proof?.clash ? colors.magenta : colors.fgDim}
              anchorX="right"
              anchorY="top"
              position={[headRight - (cells ? cells + 0.05 : 0), top, 0.002]}
            >
              {truncate(node.head, 24)}
            </Text>
          )}
          {proof && full && <ProofCells proof={proof} right={headRight} y={top - 0.032} />}

          <Text
            visible={!far}
            material={textMaterial}
            font={fontUrls.display}
            fontSize={full ? 0.165 : COMPACT_TITLE}
            lineHeight={1.12}
            color={title && !deleted ? colors.fg : colors.fgDim}
            onSync={(t: { textRenderInfo?: TextLayout }) => setTitleLayout(t.textRenderInfo)}
            anchorX="left"
            anchorY={full ? 'top' : 'middle'}
            position={[left, titleTop, 0.002]}
            maxWidth={inner}
            letterSpacing={-0.01}
          >
            {truncate(title || 'Untitled', full ? 80 : 26)}
          </Text>
          {deleted && !far && (
            <group position={[left, titleTop, 0]}>
              <StrikeLines strikes={strikesOf(titleLayout)} color={colors.diff.deleted} />
            </group>
          )}
          {node.meta && (
            <Text
              visible={full}
              material={textMaterial}
              font={fontUrls.mono}
              fontSize={SMALL}
              color={colors.fgDim}
              anchorX="left"
              anchorY="bottom"
              position={[left, factsY, 0.002]}
            >
              {truncate(node.meta, factsFit)}
            </Text>
          )}
          {full && node.tags.length > 0 && <TagChips tags={node.tags} left={left} right={right} y={bottom} material={textMaterial} />}
          {/* The diff sign in the top-right corner: outlined, filled while lit. */}
          {mark && markColor && (
            <group position={[W / 2 - BADGE / 2 - PAD, H / 2 - BADGE / 2 - PAD, 0.002]}>
              <mesh>
                <planeGeometry args={[BADGE, BADGE]} />
                <meshBasicMaterial color={markColor} toneMapped={false} />
              </mesh>
              {!lit && (
                <mesh position={[0, 0, 0.0005]}>
                  <planeGeometry args={[BADGE - 0.03, BADGE - 0.03]} />
                  <meshBasicMaterial color={colors.card} toneMapped={false} />
                </mesh>
              )}
              <Text visible={!far} material={textMaterial} font={fontUrls.mono} fontSize={0.12} color={lit ? colors.bg : markColor} anchorX="center" anchorY="middle" position={[0, 0.005, 0.001]}>
                {MARK_SIGN[mark]}
              </Text>
            </group>
          )}
          {/* An edit's old value on a strip under the card: "was" and the old text, struck through. */}
          {was && (
            <group position={[0, -H / 2 - WAS_H / 2 - 0.02, 0]}>
              <mesh position={[0, 0, -0.001]}>
                <planeGeometry args={[W, WAS_H]} />
                <meshBasicMaterial color={colors.cardBehind} toneMapped={false} />
              </mesh>
              <Text visible={full} material={textMaterial} font={fontUrls.mono} fontSize={0.08} color={colors.diff.edited} anchorX="left" anchorY="middle" position={[left, 0, 0.002]}>
                {was.label}
              </Text>
              <group position={[left + was.label.length * 0.05 + 0.06, 0, 0]}>
                <Text
                  visible={full}
                  material={textMaterial}
                  font={fontUrls.mono}
                  fontSize={0.08}
                  color={colors.fgDim}
                  anchorX="left"
                  anchorY="middle"
                  position={[0, 0, 0.002]}
                  onSync={(t: { textRenderInfo?: { caretPositions?: Float32Array } }) => setWasStrikes(strikesOf(t.textRenderInfo))}
                >
                  {truncate(was.value, Math.max(8, 40 - was.label.length))}
                </Text>
                {full && <StrikeLines strikes={wasStrikes} color={colors.diff.edited} />}
              </group>
            </group>
          )}
        </group>
        {peers.length > 0 && (
          // Who has it open, above its top-left corner (DOM, so the names stay crisp at any zoom).
          <Html position={[-W / 2 - (0.05 + peers.length * (RING + RING_GAP)) / 2, H / 2 + (0.05 + peers.length * (RING + RING_GAP)) / 2, 0]} zIndexRange={[1, 1]} pointerEvents="none">
            <div className={styles.peers}>
              {peers.map((p, i) => (
                <span key={p.name + i} className={styles.peer} style={{ ['--peer' as string]: tone(p.color) }}>
                  {p.name}
                </span>
              ))}
            </div>
          </Html>
        )}
        {/* Not while the card is dragged, nor on a star far out (D-152). */}
        {(hovered || isLinkSource) && !carried && !far && !editLocked() && (
          <group position={[W / 2, 0, 0.004]}>
            <mesh
              position={[HANDLE_HIT[0] / 2 - 0.06, 0, 0]}
              onPointerDown={onHandleDown}
              // Stopped, so a link ending under it doesn't take the pointer (and its cursor) away. The card keeps its
              // hover: the handle is only there while the card is hovered, and it's part of the card.
              onPointerOver={(e) => {
                e.stopPropagation()
                overHandle.current = true
                setHandleHot(true)
                document.body.style.cursor = 'crosshair'
              }}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerOut={(e) => {
                overHandle.current = false
                setHandleHot(false)
                // Back to the card's cursor if it's still on the card, otherwise none.
                document.body.style.cursor = e.intersections.some((h) => isWithin(h.object, group.current)) ? 'grab' : ''
              }}
            >
              <planeGeometry args={HANDLE_HIT} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
            </mesh>
            {/* Dim while shown, bright with the pointer on it, cyan while a link is drawn from it. Never hit itself:
                its glyph's outline made the hover flicker. */}
            <Text
              raycast={() => null}
              font={fontUrls.mono}
              fontSize={HANDLE}
              color={isLinkSource ? colors.cyan : handleHot ? colors.fg : colors.fgDim}
              anchorX="left"
              anchorY="middle"
              position={[0.02, 0.012, 0]}
            >
              ›
            </Text>
          </group>
        )}
        {/* Coming back from a star, the card builds up again. */}
        <CardReveal key={far ? 'far' : 'card'} content={content} uniforms={cell} />
      </group>
    </>
  )
})
