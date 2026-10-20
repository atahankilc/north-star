// A line on the board, drawn a few pixels wide like drei's <Line>, but one that keeps its geometry and material for as
// long as it's mounted. drei's builds a new geometry whenever `points` is a new array (every render, for inline
// points) and disposes its material with the old one; with every material of a kind disposed in the same commit,
// three frees the shared shader and compiles it again on the next frame. On a board with many links that was a
// recompile on every hover, drag step and collaborator's cursor. Here a move only rewrites the points in place.
import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import type { InterleavedBufferAttribute } from 'three'
import { Line2, LineGeometry, LineMaterial } from 'three-stdlib'

type Point = [number, number, number]

type Props = {
  points: Point[]
  color: string
  lineWidth?: number
  dashed?: boolean
  dashSize?: number
  gapSize?: number
  transparent?: boolean
  opacity?: number
  toneMapped?: boolean
}

// Writes the points into the line's buffers, or sets them up when the number of points changed.
function setPoints(line: Line2, points: Point[], dashed: boolean) {
  const g = line.geometry as LineGeometry
  const start = g.getAttribute('instanceStart') as InterleavedBufferAttribute | undefined
  const segments = points.length - 1
  if (!start || start.data.array.length !== segments * 6) {
    g.setPositions(points.flat())
  } else {
    const a = start.data.array as Float32Array
    for (let i = 0; i < segments; i++) {
      a.set(points[i], i * 6)
      a.set(points[i + 1], i * 6 + 3)
    }
    start.data.needsUpdate = true
    g.computeBoundingBox()
    g.computeBoundingSphere()
  }
  if (!dashed) return
  const d = g.getAttribute('instanceDistanceStart') as InterleavedBufferAttribute | undefined
  if (!d || d.data.array.length !== segments * 2) {
    line.computeLineDistances()
    return
  }
  const a = d.data.array as Float32Array
  let at = 0
  for (let i = 0; i < segments; i++) {
    const [x0, y0, z0] = points[i]
    const [x1, y1, z1] = points[i + 1]
    a[i * 2] = at
    at += Math.hypot(x1 - x0, y1 - y0, z1 - z0)
    a[i * 2 + 1] = at
  }
  d.data.needsUpdate = true
}

export function BoardLine({ points, color, lineWidth = 1, dashed = false, dashSize = 1, gapSize = 0, transparent, opacity = 1, toneMapped }: Props) {
  const size = useThree((s) => s.size)
  const line = useMemo(() => new Line2(new LineGeometry(), new LineMaterial()), [])
  useEffect(
    () => () => {
      line.geometry.dispose()
      line.material.dispose()
    },
    [line],
  )
  // Only when a point actually moves (or dashes switch on), not on every render.
  const key = points.map((p) => p.join(',')).join(' ')
  useLayoutEffect(() => {
    setPoints(line, points, dashed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, key, dashed])

  return (
    <primitive object={line}>
      <primitive
        object={line.material}
        attach="material"
        color={color}
        linewidth={lineWidth}
        resolution={[size.width, size.height]}
        dashed={dashed}
        dashSize={dashSize}
        gapSize={gapSize}
        transparent={transparent}
        opacity={opacity}
        toneMapped={toneMapped}
      />
    </primitive>
  )
}
