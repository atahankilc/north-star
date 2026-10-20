// A link between two things on the board (D-059): a straight line from edge to edge with an arrowhead, so you can
// read it as a sentence ("idea → solves → problem"). Its colour says what kind of link it is (D-108, linkKinds.ts), and
// the kind sits on a small framed chip (D-154) at the midpoint, with the link's own label while it's hovered, selected
// or the selected card's (D-135) (moved along the line when links sit side by side). Clicking the line or the chip
// selects the link. A selected link can be bent (D-155): drag a piece to put a bend point there, drag a point to move
// it, double-click it to take it out. Nothing else ever moves them.
import { Text } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { memo, useRef, useState } from 'react'
import { Shape, Vector2 } from 'three'
import { usePalette } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { BoardLine } from './BoardLine'
import { truncate } from './cardLayout'
import { useReadable } from './detail'
import { linkStyle } from './linkKinds'
import { boardPoint } from './NodeCard'
import { SNAP_STEP, useSnap } from './snap'

type Vec2 = [number, number]

const ARROW = 0.16
const GAP = 0.05
// The same size as a card's small text (its type, facts, tags), well under its title: a chip names the link, it isn't
// something to read first.
const FONT = 0.085
// Geist Mono's advance at FONT with the letter spacing below, per character.
const CHAR_W = FONT * 0.6 + FONT * 0.04
const CHIP_H = 0.15
const BORDER = 0.008
// Wide enough to hit a thin line comfortably.
const HIT_W = 0.22
// A bend point's square, and the hollow one in the middle of each piece that says it can be pulled.
const HANDLE = 0.09
const GHOST = 0.07

// Where the line from `a` towards `b` leaves a w×h box centred on `a`.
export function edgeExit(a: Vec2, b: Vec2, half: Vec2): Vec2 {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (half[0] === 0 || (dx === 0 && dy === 0)) return a
  const t = Math.min(dx ? (half[0] + GAP) / Math.abs(dx) : Infinity, dy ? (half[1] + GAP) / Math.abs(dy) : Infinity)
  return t >= 1 ? a : [a[0] + dx * t, a[1] + dy * t]
}

// The line through its bend points, from edge to edge.
export function linePoints(from: Vec2, to: Vec2, fromHalf: Vec2, toHalf: Vec2, bends: Vec2[] = []): Vec2[] {
  if (!bends.length) return [edgeExit(from, to, fromHalf), edgeExit(to, from, toHalf)]
  return [edgeExit(from, bends[0], fromHalf), ...bends, edgeExit(to, bends[bends.length - 1], toHalf)]
}

const span = (p: Vec2, q: Vec2) => Math.hypot(q[0] - p[0], q[1] - p[1])

// Where the chip goes: on a straight line its middle, moved `shift` along it (kept on the line); on a bent one the
// middle of its longest piece.
export function linkChipAt(pts: Vec2[], shift = 0): Vec2 {
  if (pts.length === 2) {
    const [s, e] = pts
    const length = span(s, e)
    const room = Math.max(0, (length - CHIP_H) / 2 - ARROW)
    const k = length ? Math.max(-room, Math.min(room, shift)) / length : 0
    return [(s[0] + e[0]) / 2 + (e[0] - s[0]) * k, (s[1] + e[1]) / 2 + (e[1] - s[1]) * k]
  }
  let best = 0
  for (let k = 1; k + 1 < pts.length; k++) if (span(pts[k], pts[k + 1]) > span(pts[best], pts[best + 1])) best = k
  return [(pts[best][0] + pts[best + 1][0]) / 2, (pts[best][1] + pts[best + 1][1]) / 2]
}

// The words on a link's chip: its kind, then its own label if it has one ("relates" alone stays unwritten).
export function chipText(kind: string, label?: string): string {
  const style = linkStyle(kind)
  const own = label?.trim() ? truncate(label.trim(), 32) : ''
  if (style.group === 'plain' && kind === 'relates') return own
  return own ? `${style.label} · ${own}` : style.label
}

type Props = {
  from: Vec2
  to: Vec2
  // Half the size of what sits at each end, so the line stops at its edge (0 for the pointer while linking).
  fromHalf: Vec2
  toHalf: Vec2
  // Moves the chip this far along a straight line from its middle (board units), so side-by-side links' chips don't overlap.
  chipShift?: number
  // Its bend points on the board, in order (D-155).
  bends?: Vec2[]
  kind?: string
  label?: string
  // Touches the selected card: drawn thicker.
  active?: boolean
  // Something else has the focus (a hovered or selected card, another link): drawn faint.
  dim?: boolean
  selected?: boolean
  // A link the assistant's preview adds, in its diff colour (D-096).
  tint?: string
  onSelect?: () => void
  // A right press on it (the board's menu, D-117).
  onRightPress?: (e: ThreeEvent<PointerEvent>) => void
  // The bend points after one was added, moved or taken out; only for a link that can be changed.
  onBends?: (bends: Vec2[]) => void
}

export const EdgeLine = memo(function EdgeLine({ from, to, fromHalf, toHalf, chipShift = 0, bends = NONE, kind = 'relates', label, active, dim, selected, tint, onSelect, onRightPress, onBends }: Props) {
  const style = linkStyle(kind)
  const colors = usePalette()
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  const [hovered, setHovered] = useState(false)
  // The bend points while one is being dragged, ahead of the write.
  const [draft, setDraft] = useState<Vec2[] | null>(null)
  // A press on a piece (a new point goes in at `at` once the pointer moves) or on a point (`at` is its place).
  const press = useRef<{ adding: boolean; at: number; x: number; y: number; moved: boolean; bends: Vec2[] } | null>(null)
  const color = tint ?? colors.link[style.group]
  const opacity = dim && !selected && !hovered ? 0.22 : 1
  // The link's own label only when it has the focus (D-135): long labels on every chip pile up into unreadable text.
  // A selected `relates` link says so, unwritten otherwise.
  const text = chipText(kind, selected || active || hovered ? label : undefined) || (selected ? style.label : '')
  // Too small to read (D-111; small words like a card's facts, with a little more for the frame round them): the colour and pattern still say what kind it is; a selected link keeps its chip.
  const readable = useReadable(FONT, 4.5)

  const shown = draft ?? bends
  const pts = linePoints(from, to, fromHalf, toHalf, shown)
  const end = pts[pts.length - 1]
  const before = pts[pts.length - 2]
  if (span(before, end) < ARROW * 2 && shown.length === 0) return null
  const angle = Math.atan2(end[1] - before[1], end[0] - before[0])
  // The line stops at the arrowhead's base.
  const tip: Vec2 = [end[0] - Math.cos(angle) * ARROW * 0.8, end[1] - Math.sin(angle) * ARROW * 0.8]
  const drawn = [...pts.slice(0, -1), tip].map(([x, y]) => [x, y, 0] as [number, number, number])

  const width = selected ? 3 : active || hovered ? 2.2 : 1.5
  const chipW = text.length * CHAR_W + 0.08
  const chip = linkChipAt(pts, shown.length ? 0 : chipShift)
  const editing = Boolean(selected && onBends)
  const pieces = pts.slice(0, -1).map((p, k) => ({ k, p, q: pts[k + 1], len: span(p, pts[k + 1]) }))

  // On the grid's fifths like a card (D-149), unless snapping is off or alt is held.
  const snap = (p: Vec2, free: boolean): Vec2 =>
    useSnap.getState().on && !free ? [Math.round(p[0] / SNAP_STEP) * SNAP_STEP, Math.round(p[1] / SNAP_STEP) * SNAP_STEP] : p

  // `adding`: a press on piece `at` (a point goes in there); otherwise on point `at`.
  const handlers = (adding: boolean | null, at = 0) =>
    onSelect && {
      onPointerDown: (e: ThreeEvent<PointerEvent>) => {
        onRightPress?.(e)
        if (e.button !== 0 || adding === null || !editing) return
        // Bending the selected link: the board doesn't pan.
        e.stopPropagation()
        if (controls) controls.enabled = false
        press.current = { adding, at, x: e.clientX, y: e.clientY, moved: false, bends: [...bends] }
        ;(e.target as unknown as Element).setPointerCapture(e.pointerId)
      },
      onPointerMove: (e: ThreeEvent<PointerEvent>) => {
        const d = press.current
        if (!d) return
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return
        const p = boardPoint(e)
        if (!p) return
        const point = snap(p, e.altKey)
        if (!d.moved && d.adding) d.bends.splice(d.at, 0, point)
        d.moved = true
        d.bends[d.at] = point
        setDraft([...d.bends])
      },
      onPointerUp: (e: ThreeEvent<PointerEvent>) => {
        const d = press.current
        if (!d) return
        press.current = null
        ;(e.target as unknown as Element).releasePointerCapture?.(e.pointerId)
        if (controls) controls.enabled = true
        if (d.moved) onBends?.(d.bends)
        setDraft(null)
      },
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (e.delta < 4) onSelect()
      },
      // A point double-clicked goes.
      onDoubleClick: (e: ThreeEvent<MouseEvent>) => {
        if (adding !== false || !editing) return
        e.stopPropagation()
        onBends?.(bends.filter((_, i) => i !== at))
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = editing && adding === false ? 'move' : editing && adding ? 'crosshair' : 'pointer'
      },
      onPointerOut: () => {
        setHovered(false)
        if (!press.current) document.body.style.cursor = ''
      },
    }

  // The hollow square in the middle of a piece, or beside the chip when the chip is there.
  const ghostAt = (p: Vec2, q: Vec2): Vec2 => {
    const along = (t: number): Vec2 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
    const clear = (c: Vec2) => Math.abs(c[0] - chip[0]) > chipW / 2 + 0.12 || Math.abs(c[1] - chip[1]) > CHIP_H / 2 + 0.12
    return [0.5, 0.3, 0.7, 0.15, 0.85].map(along).find(clear) ?? along(0.5)
  }

  return (
    <group position={[0, 0, -0.05]}>
      {/* What the pointer hits: a band along each piece, wider than it looks. Never drawn (the raycast ignores
          `visible`), so it costs no draw call. */}
      {onSelect &&
        pieces.map(({ k, p, q, len }) =>
          len < 1e-3 ? null : (
            <mesh
              key={k}
              visible={false}
              position={[(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, -0.001]}
              rotation={[0, 0, Math.atan2(q[1] - p[1], q[0] - p[0])]}
              {...handlers(true, k)}
            >
              <planeGeometry args={[len, HIT_W]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          ),
        )}
      {/* A new line when a bend point comes or goes: three keeps a line's first count of pieces once drawn. */}
      <BoardLine key={drawn.length} points={drawn} color={color} lineWidth={width} transparent opacity={opacity} toneMapped={false} />
      <mesh position={[end[0], end[1], 0]} rotation={[0, 0, angle]}>
        <shapeGeometry args={[arrowhead]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
      </mesh>
      {editing &&
        pieces.map(({ k, p, q, len }) => {
          if (len < 0.4) return null
          const at = ghostAt(p, q)
          return (
            <group key={`g${k}`} position={[at[0], at[1], 0.012]} {...handlers(true, k)}>
              <mesh>
                <planeGeometry args={[GHOST, GHOST]} />
                <meshBasicMaterial color={color} toneMapped={false} />
              </mesh>
              <mesh position={[0, 0, 0.001]}>
                <planeGeometry args={[GHOST - 0.03, GHOST - 0.03]} />
                <meshBasicMaterial color={colors.bg} toneMapped={false} />
              </mesh>
            </group>
          )
        })}
      {editing &&
        shown.map((b, i) => (
          <group key={`b${i}`} position={[b[0], b[1], 0.013]} {...handlers(false, i)}>
            <mesh>
              <planeGeometry args={[HANDLE + 0.03, HANDLE + 0.03]} />
              <meshBasicMaterial color={colors.bg} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, 0.001]}>
              <planeGeometry args={[HANDLE, HANDLE]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          </group>
        ))}
      {text && (readable || selected) && (
        // A framed chip on solid ground, so the words read over crossing lines and the backdrop.
        <group position={[chip[0], chip[1], 0.01]} {...handlers(null)}>
          <mesh>
            <planeGeometry args={[chipW + BORDER * 2, CHIP_H + BORDER * 2]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[chipW, CHIP_H]} />
            <meshBasicMaterial color={selected ? color : colors.bg} toneMapped={false} />
          </mesh>
          <Text
            font={fontUrls.mono}
            fontSize={FONT}
            letterSpacing={0.04}
            color={selected ? colors.bg : color}
            fillOpacity={opacity}
            anchorX="center"
            anchorY="middle"
            position={[0, 0.0025, 0.002]}
          >
            {text}
          </Text>
        </group>
      )}
    </group>
  )
}, sameLine)

const NONE: Vec2[] = []

// The board passes new arrays and handlers on every render; a link is drawn again only when what it shows changes.
// Handlers only ever act on the link itself (its id is the key), so whether there is one is all that matters.
function sameLine(a: Props, b: Props): boolean {
  for (const k of Object.keys({ ...a, ...b }) as (keyof Props)[]) {
    const x = a[k]
    const y = b[k]
    if (x === y) continue
    if (typeof x === 'function' || typeof y === 'function') {
      if (typeof x !== typeof y) return false
      continue
    }
    if (Array.isArray(x) && Array.isArray(y) && sameArray(x, y)) continue
    return false
  }
  return true
}

const sameArray = (x: unknown[], y: unknown[]): boolean =>
  x.length === y.length && x.every((v, i) => v === y[i] || (Array.isArray(v) && Array.isArray(y[i]) && sameArray(v, y[i] as unknown[])))

// Points along +x with its tip at the origin.
const arrowhead = new Shape([new Vector2(0, 0), new Vector2(-ARROW, ARROW * 0.5), new Vector2(-ARROW, -ARROW * 0.5)])
