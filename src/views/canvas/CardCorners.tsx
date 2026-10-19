// The card's hover and selection marks (D-150): four L-shaped corners instead of an edge round it. They sit a little
// out on hover, close in on the corners while pressed, and stay just outside once selected; while the card is dragged
// they mark the corners of where it lands, full size, while the card itself goes small under the pointer.
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, MathUtils, MeshBasicMaterial, type Mesh } from 'three'
import { isReducedMotion } from '../../state/motion'
import { glideDt } from './cardLayout'

// How thick each arm is. An `out` of minus this puts the corners just inside the card, their outside on its edge.
export const CORNER_THICK = 0.03
const THICK = CORNER_THICK
const SPEED = 18

type Props = {
  w: number
  h: number
  // Shown at all: hovered, pressed, selected, dragged or a link target.
  on: boolean
  // The gap between the card's edge and the corners' inside edge (0: they wrap the card's corners from outside;
  // -CORNER_THICK: they sit on the card's corners, inside it), and how long each arm is.
  out: number
  len: number
  color: string
}

export function CardCorners({ w, h, on, out, len, color }: Props) {
  const arms = useRef<Mesh[]>([])
  const material = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), [])
  const now = useRef({ out, len, opacity: 0, color: new Color(color) })
  const target = useMemo(() => new Color(), [])

  useFrame(({ invalidate }, delta) => {
    const s = now.current
    const reduced = isReducedMotion()
    const dt = glideDt(delta)
    const to = (v: number, t: number) => (reduced ? t : MathUtils.damp(v, t, SPEED, dt))
    target.set(color)
    s.out = to(s.out, out)
    s.len = to(s.len, len)
    s.opacity = to(s.opacity, on ? 1 : 0)
    if (reduced) s.color.copy(target)
    else s.color.lerp(target, 1 - Math.exp(-SPEED * dt))
    const near = Math.abs(s.color.r - target.r) + Math.abs(s.color.g - target.g) + Math.abs(s.color.b - target.b) < 1e-3
    if (near) s.color.copy(target)
    material.color.copy(s.color)
    material.opacity = s.opacity
    let i = 0
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        // The arm's middle line, half its thickness past the gap.
        const cx = sx * (w / 2 + s.out + THICK / 2)
        const cy = sy * (h / 2 + s.out + THICK / 2)
        const across = arms.current[i++]
        const down = arms.current[i++]
        if (!across || !down) continue
        across.scale.set(s.len, THICK, 1)
        across.position.set(cx - (sx * (s.len - THICK)) / 2, cy, 0)
        down.scale.set(THICK, s.len, 1)
        down.position.set(cx, cy - (sy * (s.len - THICK)) / 2, 0)
      }
    // Fully faded out, the corners aren't drawn at all.
    for (const a of arms.current) if (a) a.visible = s.opacity > 0.002
    const settled = near && Math.abs(s.out - out) < 1e-4 && Math.abs(s.len - len) < 1e-4 && Math.abs(s.opacity - (on ? 1 : 0)) < 1e-3
    if (!settled) invalidate()
  })

  return Array.from({ length: 8 }, (_, i) => (
    <mesh key={i} ref={(m) => void (m && (arms.current[i] = m))} material={material}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  ))
}
