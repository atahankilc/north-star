// A package on its home plane (D-141): a dashed frame in the package colour round where its members sit, its name in the
// band. Drawn from the members' places, so it follows them; it can't be moved or edited itself (the package's own panel
// renames it).
import { Text } from '@react-three/drei'
import { usePalette } from '../../state/theme'
import { fontUrls } from '../../three/fonts'
import { BoardLine } from './BoardLine'
import { useReadable } from './detail'

export type Frame = { id: string; name: string; rect: [number, number, number, number] }

const FONT = 0.32
const BAND = 0.6

export function PackageFrame({ frame }: { frame: Frame }) {
  const colors = usePalette()
  const readable = useReadable(FONT)
  const [x0, y0, x1, y1] = frame.rect
  const top = y1 + BAND
  const outline: [number, number, number][] = [
    [x0, top, 0],
    [x1, top, 0],
    [x1, y0, 0],
    [x0, y0, 0],
    [x0, top, 0],
  ]
  return (
    <group position={[0, 0, -0.06]}>
      <mesh position={[(x0 + x1) / 2, (top + y0) / 2, -0.002]}>
        <planeGeometry args={[x1 - x0, top - y0]} />
        <meshBasicMaterial color={colors.blue} transparent opacity={0.035} depthWrite={false} toneMapped={false} />
      </mesh>
      <BoardLine points={outline} color={colors.blue} lineWidth={1.2} dashed dashSize={0.18} gapSize={0.1} toneMapped={false} />
      <Text
        visible={readable}
        font={fontUrls.mono}
        fontSize={FONT}
        letterSpacing={0.04}
        color={colors.blue}
        anchorX="left"
        anchorY="middle"
        position={[x0 + 0.25, top - BAND / 2, 0.001]}
      >
        {`PACKAGE · ${frame.name || 'Untitled'}`}
      </Text>
    </group>
  )
}
