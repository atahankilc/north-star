// The board's right-click menu (D-117). A right press records what's under the pointer (a card, text, a link or the
// empty board); released without moving, it opens the menu there. A right drag still pans (D-018), so the menu waits
// for the release.
import type { ThreeEvent } from '@react-three/fiber'
import { create } from 'zustand'
import { boardPoint } from './NodeCard'

export type MenuTarget = { kind: 'card' | 'label' | 'link'; id: string } | { kind: 'board' }

type Spot = { target: MenuTarget; x: number; y: number; at: [number, number] }

type BoardMenuState = {
  // The right press in progress, if any.
  press: Spot | null
  // The menu that's open, if any: what it's for, the pointer in the page, and the board point under it.
  open: Spot | null
  close: () => void
}

export const useBoardMenu = create<BoardMenuState>((set) => ({
  press: null,
  open: null,
  close: () => set({ open: null }),
}))

// Called from an object's pointerdown: true if it was a right press (and the event was taken).
export function rightPress(e: ThreeEvent<PointerEvent>, target: MenuTarget): boolean {
  if (e.button !== 2) return false
  // The nearest thing under the pointer has it; nothing behind gets it too.
  e.stopPropagation()
  const at = boardPoint(e)
  if (at) useBoardMenu.setState({ press: { target, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, at } })
  return true
}

// How far the pointer may move between press and release for it to count as a click, not a pan.
const CLICK_PX = 5

// The release: opens the menu if the pointer stayed put.
export function rightRelease(e: PointerEvent) {
  const { press } = useBoardMenu.getState()
  if (e.button !== 2 || !press) return
  const still = Math.hypot(e.clientX - press.x, e.clientY - press.y) <= CLICK_PX
  useBoardMenu.setState({ press: null, open: still ? press : null })
}
