// A block of light Markdown on the board (richText.ts): a paragraph (D-156) or a sticky note's text (D-158). Laid out
// in board units, drawn into a canvas texture on a plane whose top-left corner is the group's origin, and drawn again
// sharper (or smaller) when the zoom moves it into another size step.
import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { CanvasTexture, LinearMipmapLinearFilter, MeshBasicMaterial, SRGBColorSpace } from 'three'
import { useDetail } from './detail'
import { draw, fontsLoaded, layout, loadFonts, type Ink, type Layout, type Setting } from './richText'

// The texture's biggest side, in pixels; and the fewest pixels per unit it's drawn at.
const MAX_PX = 4096
const MIN_PPU = 24

type Props = {
  text: string
  setting: Setting
  ink: Ink
  // The laid-out size, once known (and whenever it changes).
  onLayout?: (l: Layout) => void
  visible?: boolean
}

export function TextBlock({ text, setting, ink, onLayout, visible = true }: Props) {
  const [ready, setReady] = useState(fontsLoaded)
  useEffect(() => {
    if (!ready) void loadFonts().then(() => setReady(true))
  }, [ready])
  const { face, size, leading, width, bold, italic } = setting
  const lay = useMemo(
    () => layout(text, { face, size, leading, width, bold, italic }),
    // `ready`: measured again once the real faces are in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, face, size, leading, width, bold, italic, ready],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => onLayout?.(lay), [lay])

  const pad = size * 0.3
  const box: [number, number] = [lay.width + pad * 2, lay.height + pad * 2]
  const dpr = useThree((s) => s.viewport.dpr)
  // Pixels per unit, in steps of two, so a zoom redraws it only now and then.
  const ppu = useDetail((s) => {
    const want = Math.max(MIN_PPU, s.ppu * dpr)
    const step = 2 ** Math.ceil(Math.log2(want))
    return Math.min(step, MAX_PX / Math.max(box[0], box[1]))
  })

  const canvas = useMemo(() => document.createElement('canvas'), [])
  const texture = useMemo(() => {
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    t.minFilter = LinearMipmapLinearFilter
    t.anisotropy = 4
    return t
  }, [canvas])
  const material = useMemo(() => new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }), [texture])
  useEffect(
    () => () => {
      texture.dispose()
      material.dispose()
    },
    [texture, material],
  )

  const invalidate = useThree((s) => s.invalidate)
  const { text: inkText, strong, dim, link, code } = ink
  useEffect(() => {
    const [w, h] = [canvas.width, canvas.height]
    draw(canvas, lay, setting, { text: inkText, strong, dim, link, code }, ppu, box, pad)
    // A texture's storage is its size: a new size needs a new one.
    if (w !== canvas.width || h !== canvas.height) texture.dispose()
    texture.needsUpdate = true
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lay, ppu, inkText, strong, dim, link, code, canvas, texture, invalidate])

  return (
    <mesh visible={visible} position={[box[0] / 2 - pad, -box[1] / 2 + pad, 0]} material={material}>
      <planeGeometry args={box} />
    </mesh>
  )
}
