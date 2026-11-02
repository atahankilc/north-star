// Closing what floats (a menu, the right-click menu, a Select's list) when you're done with it: a press outside it,
// heard on the way down (the canvas and planes stop their presses from bubbling); with `wheel`, the wheel outside it
// (the right-click menu, whose place would drift as the canvas zooms); with `escape`, Escape anywhere, the top of the one Escape
// stack (useEscapeLayer, D-359). `inside` are other elements that
// count as part of it (a dropdown's trigger). `onAway` hears which it was (Escape gives focus back; a press doesn't).
import { useEffect, useRef, type RefObject } from 'react'
import { useEscapeLayer } from './useEscapeLayer'

type Options = { wheel?: boolean; escape?: boolean; inside?: RefObject<HTMLElement | null>[]; on?: boolean }

export type Away = 'press' | 'wheel' | 'escape'

export function useDismiss(root: RefObject<HTMLElement | null>, onAway: (why: Away) => void, { wheel, escape, inside = [], on = true }: Options = {}) {
  const away = useRef(onAway)
  away.current = onAway
  const others = useRef(inside)
  others.current = inside
  useEffect(() => {
    if (!on) return
    const outside = (e: Event) => {
      const t = e.target as Node
      if (root.current?.contains(t) || others.current.some((r) => r.current?.contains(t))) return
      away.current(e.type === 'wheel' ? 'wheel' : 'press')
    }
    window.addEventListener('pointerdown', outside, true)
    if (wheel) window.addEventListener('wheel', outside, true)
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('wheel', outside, true)
    }
  }, [root, wheel, on])
  // Escape: on the one stack (D-359), so what floats over a panel closes before the panel.
  useEscapeLayer(() => away.current('escape'), { on: on && !!escape, fields: true, root })
}
