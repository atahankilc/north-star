// Idea cards build up cell by cell on the board (D-034, D-035), like the DOM <Appear>: every
// material in the card discards fragments whose screen cell hasn't appeared yet (random order).
// Cells follow the screen grid, so they line up with the ASCII backdrop behind the board.
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Mesh, type Group, type Material } from 'three'
import { useRevealed } from '../../state/curtain'
import { isReducedMotion } from '../../state/motion'
import { CELL_PX, CELL_REVEAL_FRAGMENT, CELL_REVEAL_UNIFORMS, DURATION_MS, OVERSHOOT } from '../../ui/cellReveal'

export type CellUniforms = {
  uCellProgress: { value: number }
  uCellMode: { value: number }
  uCellSize: { value: number }
}

export function makeCellUniforms(): CellUniforms {
  return {
    uCellProgress: { value: 0 },
    uCellMode: { value: isReducedMotion() ? 0 : 1 },
    uCellSize: { value: CELL_PX },
  }
}

const INSTALLED = '__cellReveal'

// Adds the reveal to a material (idempotent). Also used for troika text's base material, whose
// derived text material calls this onBeforeCompile first.
export function installCellReveal(material: Material, uniforms: CellUniforms) {
  if (material.userData[INSTALLED]) return
  material.userData[INSTALLED] = true
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${CELL_REVEAL_UNIFORMS}\nvoid main() {`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${CELL_REVEAL_FRAGMENT}`)
  }
  // Separate shader program from the plain material.
  material.customProgramCacheKey = () => 'cellReveal'
  material.needsUpdate = true
}

type Props = {
  content: RefObject<Group | null>
  uniforms: CellUniforms
}

export function CardReveal({ content, uniforms }: Props) {
  const [done, setDone] = useState(isReducedMotion)
  // Starts together with the page-load rebuild and every other element: nothing waits.
  const revealed = useRevealed()
  const startAt = useRef<number | null>(null)
  const gl = useThree((st) => st.gl)
  const install = useMemo(
    () => (root: Group) =>
      root.traverse((o) => {
        if (!(o instanceof Mesh) || 'fillOpacity' in o) return // text is handled via its base material
        for (const m of (Array.isArray(o.material) ? o.material : [o.material]) as Material[]) installCellReveal(m, uniforms)
      }),
    [uniforms],
  )

  useLayoutEffect(() => {
    if (content.current) install(content.current)
  }, [install, content])

  useFrame(() => {
    if (done || !content.current) return
    // Materials that mount later (e.g. the hover rim) join in.
    install(content.current)

    uniforms.uCellSize.value = CELL_PX * gl.getPixelRatio()

    const now = performance.now()
    if (revealed) startAt.current ??= now
    const p = startAt.current === null ? 0 : (Math.max(0, now - startAt.current) / DURATION_MS) * OVERSHOOT
    uniforms.uCellProgress.value = p
    if (p >= OVERSHOOT) {
      uniforms.uCellMode.value = 0
      setDone(true)
    }
  })

  return null
}
