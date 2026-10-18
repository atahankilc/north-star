// A link between two things on the board (D-059): a straight line from edge to edge with an arrowhead, so you can
// read it as a sentence ("idea → solves → problem"). Its colour says what kind of link it is (D-108, linkKinds.ts), its
// pattern which kind inside that group, and the kind (and the link's own label) sits on a framed chip at the midpoint.
// Clicking the line or the chip selects the link.
import { Line, Text } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { Shape, Vector2 } from 'three'
import { usePalette } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
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
}

export function EdgeLine({ from, to, fromHalf, toHalf, kind = 'relates', label, active, dim, selected, tint, onSelect }: Props) {
  const style = linkStyle(kind)
  const colors = usePalette()
  const [hovered, setHovered] = useState(false)
  const color = tint ?? colors.link[style.group]
  const opacity = dim && !selected && !hovered ? 0.22 : 1
  const text = chipText(kind, label)
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
  const chipW = text.length * CHAR_W + 0.18
  const handlers = onSelect && {
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
      {/* What the pointer hits: a band along the line, wider than it looks. */}
      {handlers && (
        <mesh position={[mid[0], mid[1], -0.001]} rotation={[0, 0, angle]} {...handlers}>
          <planeGeometry args={[length, HIT_W]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      <Line
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
        <group position={[mid[0], mid[1], 0.01]} {...handlers}>
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
}

// Points along +x with its tip at the origin.
const arrowhead = new Shape([new Vector2(0, 0), new Vector2(-ARROW, ARROW * 0.5), new Vector2(-ARROW, -ARROW * 0.5)])
