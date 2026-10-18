// A link between two things on the board (D-059): a straight line from edge to edge with an arrowhead, so you can
// read it as a sentence ("idea → solves → problem"). Its colour says what kind of link it is (D-108, linkKinds.ts), its
// pattern which kind inside that group, and the kind sits on a framed chip at the midpoint, with the link's own label
// while it's hovered, selected or the selected card's (D-135) (moved along the line when links sit side by side).
// Clicking the line or the chip selects the link.
import { Text } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { memo, useMemo, useState } from 'react'
import { Shape, Vector2 } from 'three'
import { usePalette } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { BoardLine } from './BoardLine'
import { truncate } from './cardLayout'
import { useReadable } from './detail'
import { linkStyle } from './linkKinds'

type Vec2 = [number, number]

const ARROW = 0.16
const GAP = 0.05
const FONT = 0.14
// Geist Mono's advance at FONT with the letter spacing below, per character.
const CHAR_W = FONT * 0.6 + FONT * 0.04
const CHIP_H = 0.25
const BORDER = 0.018
// Wide enough to hit a thin line comfortably.
const HIT_W = 0.22

// Where the line from `a` towards `b` leaves a w×h box (or a circle) centred on `a`.
function exit(a: Vec2, b: Vec2, half: Vec2): Vec2 {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (half[0] === 0 || (dx === 0 && dy === 0)) return a
  // Equal halves: a round thing (a card seen from far out, FarNode), so stop at its circle.
  if (half[0] === half[1]) {
    const t = (half[0] + GAP) / Math.hypot(dx, dy)
    return t >= 1 ? a : [a[0] + dx * t, a[1] + dy * t]
  }
  const t = Math.min(dx ? (half[0] + GAP) / Math.abs(dx) : Infinity, dy ? (half[1] + GAP) / Math.abs(dy) : Infinity)
  return t >= 1 ? a : [a[0] + dx * t, a[1] + dy * t]
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
  // Moves the chip this far along the line from its middle (board units), so side-by-side links' chips don't overlap.
  chipShift?: number
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
}

export const EdgeLine = memo(function EdgeLine({ from, to, fromHalf, toHalf, chipShift = 0, kind = 'relates', label, active, dim, selected, tint, onSelect, onRightPress }: Props) {
  const style = linkStyle(kind)
  const colors = usePalette()
  const [hovered, setHovered] = useState(false)
  const color = tint ?? colors.link[style.group]
  const opacity = dim && !selected && !hovered ? 0.22 : 1
  // The link's own label only when it has the focus (D-135): long labels on every chip pile up into unreadable text.
  const text = chipText(kind, selected || active || hovered ? label : undefined)
  // Too small to read (D-111; mono caps on a small chip need a little more than other text): the colour and pattern still say what kind it is; a selected link keeps its chip.
  const readable = useReadable(FONT, 6.5)

  const { start, end, angle, mid, length } = useMemo(() => {
    const s = exit(from, to, fromHalf)
    const e = exit(to, from, toHalf)
    return {
      start: s,
      end: e,
      angle: Math.atan2(e[1] - s[1], e[0] - s[0]),
      mid: [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2] as Vec2,
      length: Math.hypot(e[0] - s[0], e[1] - s[1]),
    }
  }, [from, to, fromHalf, toHalf])

  // The line stops at the arrowhead's base.
  const tip: Vec2 = [end[0] - Math.cos(angle) * ARROW * 0.8, end[1] - Math.sin(angle) * ARROW * 0.8]
  if (length < ARROW * 2) return null

  const width = selected ? 3 : active || hovered ? 2.2 : 1.5
  // The chip stays on the visible line, even between close cards.
  const room = Math.max(0, (length - CHIP_H) / 2 - ARROW)
  const shift = Math.max(-room, Math.min(room, chipShift))
  const chipW = text.length * CHAR_W + 0.18
  const handlers = onSelect && {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => onRightPress?.(e),
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (e.delta < 4) onSelect()
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setHovered(true)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      setHovered(false)
      document.body.style.cursor = ''
    },
  }

  return (
    <group position={[0, 0, -0.05]}>
      {/* What the pointer hits: a band along the line, wider than it looks. Never drawn (the raycast ignores
          `visible`), so it costs no draw call. */}
      {handlers && (
        <mesh visible={false} position={[mid[0], mid[1], -0.001]} rotation={[0, 0, angle]} {...handlers}>
          <planeGeometry args={[length, HIT_W]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      <BoardLine
        points={[
          [start[0], start[1], 0],
          [tip[0], tip[1], 0],
        ]}
        color={color}
        lineWidth={width}
        dashed={Boolean(style.dash)}
        dashSize={style.dash?.[0] ?? 1}
        gapSize={style.dash?.[1] ?? 0}
        transparent
        opacity={opacity}
        toneMapped={false}
      />
      <mesh position={[end[0], end[1], 0]} rotation={[0, 0, angle]}>
        <shapeGeometry args={[arrowhead]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
      </mesh>
      {text && (readable || selected) && (
        // A framed chip on solid ground, so the words read over crossing lines and the backdrop.
        <group position={[mid[0] + Math.cos(angle) * shift, mid[1] + Math.sin(angle) * shift, 0.01]} {...handlers}>
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
            position={[0, 0.004, 0.002]}
          >
            {text}
          </Text>
        </group>
      )}
    </group>
  )
}, sameLine)

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
    if (Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((v, i) => v === y[i])) continue
    return false
  }
  return true
}

// Points along +x with its tip at the origin.
const arrowhead = new Shape([new Vector2(0, 0), new Vector2(-ARROW, ARROW * 0.5), new Vector2(-ARROW, -ARROW * 0.5)])
