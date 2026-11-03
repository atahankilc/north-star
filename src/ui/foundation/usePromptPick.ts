// A list picked from inside a field that keeps typing (D-350, D-361): the agent's `/` skills, a thread's `@` people. The
// field keeps the keys: ↑ ↓ move what's picked (round the ends), Enter (not with shift, never while an IME is still
// composing) or Tab picks it, Escape closes the list only. What's picked starts at the first row and goes back to it
// when `reset` changes (what's typed after the `/` or `@`). The pointer moves the same pick (`setAt`).
import { useEffect, useState, type KeyboardEvent } from 'react'

export function usePromptPick<T>(list: T[], open: boolean, { pick, close, reset }: { pick: (item: T) => void; close: () => void; reset: unknown }) {
  const [at, setAt] = useState(0)
  useEffect(() => setAt(0), [reset])
  // True when the key was the list's (the field should not act on it).
  const onKey = (e: KeyboardEvent): boolean => {
    if (!open || !list.length) return false
    const n = list.length
    if (e.key === 'ArrowDown') (e.preventDefault(), setAt((i) => (i + 1) % n))
    else if (e.key === 'ArrowUp') (e.preventDefault(), setAt((i) => (i - 1 + n) % n))
    else if ((e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) || e.key === 'Tab') (e.preventDefault(), pick(list[Math.min(at, n - 1)]))
    else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), close())
    else return false
    return true
  }
  return { at: Math.min(at, Math.max(0, list.length - 1)), setAt, onKey }
}
