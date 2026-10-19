// The small parts of a card's layout (D-152): its evidence as a row of cells, and its tags as framed chips.
import { Text } from '@react-three/drei'
import type { Material } from 'three'
import { usePalette } from '../../state/theme'
import { fontUrls } from '../../three/fonts'

const CELL = 0.055
const CELL_GAP = 0.025
const LINE = 0.012
// Up to this many cells each way; more evidence than that still reads as "a lot".
const MOST = 5

// How wide the cells for this much evidence are, to put the status left of them.
export const proofWidth = (p: { supports: number; contradicts: number }) => {
  const n = Math.min(MOST, p.supports) + Math.min(MOST, p.contradicts)
  return n ? n * CELL + (n - 1) * CELL_GAP : 0
}

function Bar({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  return (
    <mesh position={[x, y, 0]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

// An outlined box: four thin bars.
function Box({ x, y, w, h, t, color }: { x: number; y: number; w: number; h: number; t: number; color: string }) {
  return (
    <>
      <Bar x={x} y={y + h / 2 - t / 2} w={w} h={t} color={color} />
      <Bar x={x} y={y - h / 2 + t / 2} w={w} h={t} color={color} />
      <Bar x={x - w / 2 + t / 2} y={y} w={t} h={h} color={color} />
      <Bar x={x + w / 2 - t / 2} y={y} w={t} h={h} color={color} />
    </>
  )
}

// Evidence as cells, ending at `right`: filled for each piece that supports it, outlined for each against; magenta when
// the evidence and the status disagree.
export function ProofCells({ proof, right, y }: { proof: { supports: number; contradicts: number; clash: boolean }; right: number; y: number }) {
  const colors = usePalette()
  const color = proof.clash ? colors.magenta : colors.fg
  const cells = [...Array<boolean>(Math.min(MOST, proof.supports)).fill(true), ...Array<boolean>(Math.min(MOST, proof.contradicts)).fill(false)]
  return (
    <group position={[0, y, 0.002]}>
      {cells.map((filled, i) => {
        const x = right - (cells.length - 1 - i) * (CELL + CELL_GAP) - CELL / 2
        return filled ? <Bar key={i} x={x} y={0} w={CELL} h={CELL} color={color} /> : <Box key={i} x={x} y={0} w={CELL} h={CELL} t={LINE} color={color} />
      })}
    </group>
  )
}

const CHIP_TEXT = 0.068
const CHIP_H = 0.12
const CHIP_PAD = 0.04
const CHIP_GAP = 0.05
// Geist Mono's advance is 0.6 em.
const chipWidth = (text: string) => text.length * CHIP_TEXT * 0.6 + CHIP_PAD * 2

// Tags as framed chips in a row from `left`, bottom at `y`; what doesn't fit before `right` becomes `+N`.
export function TagChips({ tags, left, right, y, material }: { tags: string[]; left: number; right: number; y: number; material: Material }) {
  const colors = usePalette()
  const shown: { text: string; x: number }[] = []
  let x = left
  for (let i = 0; i < tags.length; i++) {
    const text = `#${tags[i]}`
    const rest = `+${tags.length - i}`
    // Keep room for the `+N` chip unless this is the last tag.
    const need = chipWidth(text) + (i < tags.length - 1 ? CHIP_GAP + chipWidth(`+${tags.length - i - 1}`) : 0)
    if (x + need > right) {
      shown.push({ text: rest, x })
      break
    }
    shown.push({ text, x })
    x += chipWidth(text) + CHIP_GAP
  }
  return (
    <>
      {shown.map(({ text, x }) => {
        const w = chipWidth(text)
        return (
          <group key={text} position={[x + w / 2, y + CHIP_H / 2, 0.002]}>
            <Bar x={0} y={0} w={w} h={CHIP_H} color={colors.chip} />
            <group position={[0, 0, 0.0005]}>
              <Box x={0} y={0} w={w} h={CHIP_H} t={0.008} color={colors.hairline} />
            </group>
            <Text material={material} font={fontUrls.mono} fontSize={CHIP_TEXT} color={colors.fg} anchorX="center" anchorY="middle" position={[0, 0.003, 0.001]}>
              {text}
            </Text>
          </group>
        )
      })}
    </>
  )
}
