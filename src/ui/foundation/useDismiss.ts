// Closing what floats (a menu, the right-click menu, a Select's list) when you're done with it: a press outside it,
// heard on the way down (the canvas and planes stop their presses from bubbling); with `wheel`, the wheel outside it
// (the right-click menu, whose place would drift as the canvas zooms); with `escape`, Escape anywhere, heard before the
// canvas (which would leave focus) unless it's the onboarding's (`[data-coach]`). `inside` are other elements that
// count as part of it (a dropdown's trigger).
import { useEffect, useRef, type RefObject } from 'react'

type Options = { wheel?: boolean; escape?: boolean; inside?: RefObject<HTMLElement | null>[]; on?: boolean }

export function useDismiss(root: RefObject<HTMLElement | null>, onAway: () => void, { wheel, escape, inside = [], on = true }: Options = {}) {
  const away = useRef(onAway)
  away.current = onAway
  const others = useRef(inside)
  others.current = inside
  useEffect(() => {
    if (!on) return
    const outside = (e: Event) => {
      const t = e.target as Node
      if (root.current?.contains(t) || others.current.some((r) => r.current?.contains(t))) return
      away.current()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as Element | null)?.closest?.('[data-coach]')) return
      e.stopPropagation()
      away.current()
    }
    window.addEventListener('pointerdown', outside, true)
    if (wheel) window.addEventListener('wheel', outside, true)
    if (escape) window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('wheel', outside, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [root, wheel, escape, on])
}
