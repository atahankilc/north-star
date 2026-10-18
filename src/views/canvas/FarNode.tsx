// A card seen from far out (D-111): too small for any text, it becomes a star on the board's map: a ring in its type's
// colour around a small bright core, built up cell by cell like everything else (D-034).
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { usePalette } from '../../state/theme'
import { CardReveal, makeCellUniforms } from './CardReveal'

export const NODE_R = 0.55
// A competitor's feature (FeatureChip), a smaller star beside its competitor.
export const SMALL_NODE_R = 0.3
const RING = 0.11
const CORE = 0.16

type Props = {
  color: string
  // Hovered, selected, related or a link target: a second ring outside.
  rim: string | null
  // The assistant's preview mark (D-096), drawn as that outer ring too.
  mark?: string
  r?: number
}

export function FarNode({ color, rim, mark, r = NODE_R }: Props) {
  const colors = usePalette()
  const content = useRef<Group>(null)
  const cell = useMemo(makeCellUniforms, [])
  const outer = mark ?? rim

  return (
    <>
      <group ref={content}>
        {outer && (
          <mesh position={[0, 0, -0.002]}>
            <ringGeometry args={[r + 0.06, r + 0.06 + RING, 40]} />
            <meshBasicMaterial color={outer} toneMapped={false} />
          </mesh>
        )}
        {/* Dark inside, so links running under it don't show through. */}
        <mesh position={[0, 0, -0.001]}>
          <circleGeometry args={[r, 40]} />
          <meshBasicMaterial color={colors.card} toneMapped={false} />
        </mesh>
        <mesh>
          <ringGeometry args={[r - RING, r, 40]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh>
          <circleGeometry args={[CORE * (r / NODE_R), 24]} />
          <meshBasicMaterial color={colors.fg} toneMapped={false} />
        </mesh>
      </group>
      <CardReveal content={content} uniforms={cell} />
    </>
  )
}
