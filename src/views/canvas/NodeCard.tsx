// One card on the board: a flat card with SDF text (D-019). Every type has the same shape; a left border and a small
// label in the type's colour say what it is (D-055). Tags (white #chips) group cards within a type (D-056).
// Notes stay in the panel, not on the card (D-057), so cards stay small.
// Editing happens in the DetailPanel.
import { Html, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { MathUtils, MeshBasicMaterial, Plane, Vector3, type Group, type Object3D } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { endMove, moveNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { usePalette, useThemeAccent } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { BOARD_KINDS, typeAccent, type BoardItem } from './boardKinds'
import { CARD_H, CARD_W, glideDt, truncate } from './cardLayout'
import { CardReveal, installCellReveal, makeCellUniforms } from './CardReveal'
import { COMPACT_TITLE, useDetail } from './detail'
import { FarNode } from './FarNode'
import { endGroup, moveGroup, startGroup } from './groupDrag'
import { snapPoint } from './snap'
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
// The link handle on a hovered card's right edge.
const HANDLE = 0.1
// What the pointer can grab around it: wider than it looks, it's small.
const HANDLE_HIT = 0.2
const WAS_H = 0.24

export function NodeCard({ wid, item: node, layer, related, stack = 0, peers = [], mark, was, lit = false, onLinkDrop }: Props) {
  const type = node.type
  const W = CARD_W
  const H = CARD_H
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
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null

  const selected = useCanvas((s) => s.selection.includes(node.id))
  const live = useCanvas((s) => s.dragging[node.id])
  const isLinkSource = useCanvas((s) => s.linkFrom === node.id)
  const isLinkTarget = useCanvas((s) => s.linkFrom !== null && s.linkFrom !== node.id) && hovered
  const { select, toggleSelect, startLink, endLink, setDragging, setPressing, setHover } = useCanvas.getState()

  // `group`: the card is one of several selected, and they all move with it (groupDrag.ts).
  const drag = useRef<{ dx: number; dy: number; from: [number, number]; lastWrite: number; moved: boolean; group: boolean } | null>(null)
  // Shift held at the press: a link if the pointer leaves the card, a toggle of the selection if it doesn't.
  const shiftPress = useRef(false)
  const overHandle = useRef(false)

  const [x, y] = live ?? [node.x, node.y]
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

  // The card stays flat and its size never changes (D-061): no lift or scale on hover, selection or drag, which also made
  // a dragged card land somewhere other than under the pointer. While dragging it sits exactly under the pointer;
  // otherwise it glides to its position, so collaborators' moves animate. The dragged card is drawn on top.
  useFrame(({ invalidate }, delta) => {
    const dt = glideDt(delta)
    const g = group.current
    if (!g) return
    // Stacking uses tiny depth steps, too small to make a card look bigger or drift from the pointer.
    if (drag.current) g.position.set(x, y, 0.06)
    else {
      g.position.x = MathUtils.damp(g.position.x, x, 12, dt)
      g.position.y = MathUtils.damp(g.position.y, y, 12, dt)
      g.position.z = Math.min(layer, 150) * 0.0003
      if (Math.abs(g.position.x - x) > 1e-4 || Math.abs(g.position.y - y) > 1e-4) invalidate()
    }
  })

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
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
    drag.current = { dx: p[0] - x, dy: p[1] - y, from: [node.x, node.y], lastWrite: 0, moved: false, group }
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
    const p = boardPoint(e)
    if (!p) return
    // On the grid while snapping is on (D-112); alt drags freely.
    const next = snapPoint([p[0] - d.dx, p[1] - d.dy], e.altKey)
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
      ;(e.target as Element).releasePointerCapture(e.pointerId)
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

  const rim = isLinkTarget ? colors.cyan : selected ? accent : related ? colors.cyan : hovered ? colors.hover : null
  const title = node.title.trim()
  const left = -W / 2 + 0.22
  const inner = W - 0.22 - 0.16
  const titleTop = full ? H / 2 - 0.27 : 0
  const tags = node.tags.map((t) => `#${t}`).join('  ')

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
      {far && <FarNode color={accent} rim={rim} mark={markColor} />}
      <group ref={content} visible={!far}>
        {/* Up to three plates peeking out behind: this competitor has features to fan out. */}
        {Array.from({ length: Math.min(3, stack) }, (_, i) => (
          <group key={i} position={[(i + 1) * 0.07, -(i + 1) * 0.07, -0.006 - i * 0.002]}>
            <mesh position={[0, 0, -0.001]}>
              <planeGeometry args={[W + 0.02, H + 0.02]} />
              <meshBasicMaterial color={colors.hairline} toneMapped={false} />
            </mesh>
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
        {/* Edge: a hairline, or the highlight when hovered, selected, related or a link target. */}
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[W + (rim ? 0.05 : 0.02), H + (rim ? 0.05 : 0.02)]} />
          <meshBasicMaterial color={rim ?? colors.hairline} toneMapped={false} />
        </mesh>
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
          fontSize={0.072}
          letterSpacing={0.14}
          color={accent}
          anchorX="left"
          anchorY="top"
          position={[left, H / 2 - 0.12, 0.002]}
        >
          {BOARD_KINDS[type].label.toUpperCase()}
        </Text>

        <Text
          visible={!far}
          material={textMaterial}
          font={fontUrls.display}
          fontSize={full ? 0.17 : COMPACT_TITLE}
          color={title && !deleted ? colors.fg : colors.fgDim}
          onSync={(t: { textRenderInfo?: TextLayout }) => setTitleLayout(t.textRenderInfo)}
          anchorX="left"
          anchorY={full ? 'top' : 'middle'}
          position={[left, titleTop, 0.002]}
          maxWidth={inner}
          letterSpacing={-0.01}
        >
          {truncate(title || 'Untitled', full ? 44 : 26)}
        </Text>
        {deleted && !far && (
          <group position={[left, titleTop, 0]}>
            <StrikeLines strikes={strikesOf(titleLayout)} color={colors.diff.deleted} />
          </group>
        )}
        {tags && (
          <Text
            visible={full}
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.085}
            color={colors.fg}
            anchorX="left"
            anchorY="bottom"
            position={[left, -H / 2 + 0.12 + (node.meta ? 0.15 : 0), 0.002]}
          >
            {truncate(tags, 40)}
          </Text>
        )}
        {node.meta && (
          <Text
            visible={full}
            material={textMaterial}
            font={fontUrls.mono}
            fontSize={0.08}
            color={colors.fgDim}
            anchorX="left"
            anchorY="bottom"
            position={[left, -H / 2 + 0.12, 0.002]}
          >
            {truncate(node.meta, 42)}
          </Text>
        )}
        {/* The diff sign in the top-right corner: outlined, filled while lit. */}
        {mark && markColor && (
          <group position={[W / 2 - BADGE / 2 - 0.08, H / 2 - BADGE / 2 - 0.08, 0.002]}>
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
      {(hovered || isLinkSource) && !editLocked() && (
        <group position={[W / 2, 0, 0.004]}>
          <mesh
            onPointerDown={onHandleDown}
            // Not stopped: the card has to keep its hover, or the handle goes away under the pointer.
            onPointerOver={() => (overHandle.current = true)}
            onPointerOut={() => {
              overHandle.current = false
              document.body.style.cursor = 'grab'
            }}
          >
            <circleGeometry args={[HANDLE_HIT, 20]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>
          <mesh>
            <circleGeometry args={[HANDLE, 20]} />
            <meshBasicMaterial color={isLinkSource ? colors.cyan : colors.fg} toneMapped={false} />
          </mesh>
        </group>
      )}
      {/* Coming back from a star, the card builds up again. */}
      <CardReveal key={far ? 'far' : 'card'} content={content} uniforms={cell} />
    </group>
  )
}
