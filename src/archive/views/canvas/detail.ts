// How much of the board can be read right now, from how big a board unit is on screen (CSS pixels), not from the zoom:
// on a big screen far out, cards are still large enough to read. Text that would come out smaller than a few pixels is
// left out, and cards change how they're drawn instead of turning into speckle (D-111).
// Also keeps the camera's depth range tight around the board, so the thin layers of a card or a link chip never
// swap places (they did when zoomed out: near 0.1 / far 1000 left about 0.01 units of depth precision at 150).
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { PerspectiveCamera } from 'three'
import { create } from 'zustand'

// full: everything; compact: the title alone, bigger, at most three lines of whole words; far: the card stays, its
// title's lines drawn as bars (D-153).
export type CardDetail = 'full' | 'compact' | 'far'

// Smallest text worth drawing, in CSS pixels.
export const MIN_TEXT_PX = 6
// Short mono words (a card's type label, tags, meta; a link's kind) still help at this size, read at a glance.
export const SMALL_TEXT_PX = 4
// The card's small text (type label, tags, meta) is about 0.075 units; the compact title COMPACT_TITLE.
export const CARD_SMALL_TEXT = 0.075
export const COMPACT_TITLE = 0.3
const FULL_AT = SMALL_TEXT_PX / CARD_SMALL_TEXT
const COMPACT_AT = 5 / COMPACT_TITLE
// Crossing back needs a little more room, so a camera resting on a threshold doesn't flip cards back and forth.
const HYSTERESIS = 1.1

type Detail = { ppu: number; card: CardDetail; set: (ppu: number) => void }

function cardDetail(ppu: number, was: CardDetail): CardDetail {
  const up = (at: number, level: CardDetail) => (rank(was) < rank(level) ? at * HYSTERESIS : at)
  if (ppu >= up(FULL_AT, 'full')) return 'full'
  if (ppu >= up(COMPACT_AT, 'compact')) return 'compact'
  return 'far'
}
const rank = (d: CardDetail) => (d === 'full' ? 2 : d === 'compact' ? 1 : 0)

export const useDetail = create<Detail>((set, get) => ({
  ppu: 100,
  card: 'full',
  set: (ppu) => set({ ppu, card: cardDetail(ppu, get().card) }),
}))

// Text of this size (board units) is big enough to draw. Re-renders only when the answer changes.
export const useReadable = (size: number, minPx = MIN_TEXT_PX) => useDetail((s) => s.ppu * size >= minPx)

// Inside the board's Canvas: measures the scale every frame and fits near/far to the camera's height over the board.
export function BoardDetail() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const height = useThree((s) => s.size.height)

  useFrame(() => {
    const ppu = height / (2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360))
    if (Math.abs(ppu - useDetail.getState().ppu) > 0.002 * ppu) useDetail.getState().set(ppu)
  })

  // Right before each render, after every glide and the controls have moved the camera. Everything on the board lies
  // within a few tenths of a unit of z = 0, and the camera looks straight down at it from at least 3 units away.
  useEffect(() => {
    const before = scene.onBeforeRender
    scene.onBeforeRender = (_gl, _scene, cam) => {
      if (cam !== camera) return
      const d = Math.max(1, camera.position.z)
      const near = d * 0.5
      const far = d * 2
      if (camera.near !== near || camera.far !== far) {
        camera.near = near
        camera.far = far
        camera.updateProjectionMatrix()
      }
    }
    return () => {
      scene.onBeforeRender = before
    }
  }, [scene, camera])
  return null
}
