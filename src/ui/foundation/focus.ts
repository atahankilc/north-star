// Focus for what opens over or beside the page (D-359; was in Window.tsx): moved inside as it opens and given back where
// it was when it closes; Tab kept round inside a modal one.
import { useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'

// Focus inside while open, and back where it was on close: `first` (or the root) takes it as it opens, unless something
// inside already took it (a field's autoFocus runs before this). Where it was is read as it first draws, before that.
export function useDialogFocus(root: RefObject<HTMLElement | null>, first: RefObject<HTMLElement | null> | null, move = true) {
  const was = useRef<Element | null | undefined>(undefined)
  if (was.current === undefined) was.current = typeof document === 'undefined' ? null : document.activeElement
  useLayoutEffect(() => {
    const inside = !!root.current && root.current.contains(document.activeElement)
    if (move && (first?.current || !inside)) (first?.current ?? root.current)?.focus({ preventScroll: true })
    const back = was.current as HTMLElement | null
    return () => {
      if (back && back !== document.body && document.contains(back)) back.focus({ preventScroll: true })
    }
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// Tab and shift-Tab go round inside `root`.
export function trapTab(e: ReactKeyboardEvent | KeyboardEvent, root: HTMLElement | null) {
  if (e.key !== 'Tab' || !root) return
  const all = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
  if (!all.length) return
  const i = all.indexOf(document.activeElement as HTMLElement)
  if (e.shiftKey && i <= 0) {
    e.preventDefault()
    all[all.length - 1].focus()
  } else if (!e.shiftKey && i === all.length - 1) {
    e.preventDefault()
    all[0].focus()
  }
}
