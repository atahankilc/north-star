// A link between two things on the board (D-059): a straight line from edge to edge with an arrowhead, so you can
// read it as a sentence ("idea → solves → problem"). The kind is written at the midpoint and sets the line style.
import { Line, Text } from '@react-three/drei'
import { useMemo } from 'react'
import { Shape, Vector2 } from 'three'
import { colors } from '../../styles/tokens'
import { fontUrls } from '../../three/fonts'

type Vec2 = [number, number]

// Line pattern per kind; colour stays neutral (colours mean card types, D-055).
const STYLE: Record<string, { dash?: [number, number]; faint?: boolean; label?: string }> = {
  solves: { label: 'solves' },
  'competes-with': { dash: [0.18, 0.1], label: 'competes' },
  'inspired-by': { dash: [0.03, 0.07], label: 'inspired by' },
  'depends-on': { dash: [0.18, 0.1], label: 'depends on' },
  'part-of': { label: 'part of' },
  contradicts: { dash: [0.06, 0.06], label: 'contradicts' },
  for: { dash: [0.03, 0.07], label: 'for' },
  relates: { faint: true },
}

const ARROW = 0.14
const GAP = 0.05

// Where the line from `a` towards `b` leaves a w×h box centred on `a`.
function exit(a: Vec2, b: Vec2, half: Vec2): Vec2 {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (half[0] === 0 || (dx === 0 && dy === 0)) return a
  const t = Math.min(dx ? (half[0] + GAP) / Math.abs(dx) : Infinity, dy ? (half[1] + GAP) / Math.abs(dy) : Infinity)
  return t >= 1 ? a : [a[0] + dx * t, a[1] + dy * t]
}

type Props = {
  from: Vec2
  to: Vec2
  // Half the size of what sits at each end, so the line stops at its edge (0 for the pointer while linking).
  fromHalf: Vec2
  toHalf: Vec2
  kind?: string
  active?: boolean
}

export function EdgeLine({ from, to, fromHalf, toHalf, kind = 'relates', active }: Props) {
  const style = STYLE[kind] ?? { label: kind }
  const color = active ? colors.cyan : style.faint ? '#3a3a3a' : '#6a6a6a'

  const { start, end, angle, mid } = useMemo(() => {
    const s = exit(from, to, fromHalf)
    const e = exit(to, from, toHalf)
    return { start: s, end: e, angle: Math.atan2(e[1] - s[1], e[0] - s[0]), mid: [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2] as Vec2 }
  }, [from, to, fromHalf, toHalf])

  // The line stops at the arrowhead's base.
  const tip: Vec2 = [end[0] - Math.cos(angle) * ARROW * 0.8, end[1] - Math.sin(angle) * ARROW * 0.8]
  if (Math.hypot(end[0] - start[0], end[1] - start[1]) < ARROW * 2) return null

  return (
    <group position={[0, 0, -0.05]}>
      <Line
        points={[
          [start[0], start[1], 0],
          [tip[0], tip[1], 0],
        ]}
        color={color}
        lineWidth={active ? 2 : 1.4}
        dashed={Boolean(style.dash)}
        dashSize={style.dash?.[0] ?? 1}
        gapSize={style.dash?.[1] ?? 0}
        toneMapped={false}
      />
      <mesh position={[end[0], end[1], 0]} rotation={[0, 0, angle]}>
        <shapeGeometry args={[arrowhead]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {style.label && (
        <group position={[mid[0], mid[1], 0.01]}>
          <mesh>
            <planeGeometry args={[style.label.length * 0.062 + 0.12, 0.16]} />
            <meshBasicMaterial color="#000000" toneMapped={false} />
          </mesh>
          <Text font={fontUrls.mono} fontSize={0.09} letterSpacing={0.04} color={active ? colors.cyan : '#8a8a8a'} anchorX="center" anchorY="middle">
            {style.label}
          </Text>
        </group>
      )}
    </group>
  )
}

// Points along +x with its tip at the origin.
const arrowhead = new Shape([new Vector2(0, 0), new Vector2(-ARROW, ARROW * 0.5), new Vector2(-ARROW, -ARROW * 0.5)])
