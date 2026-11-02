// Focus for what opens over or beside the page (D-359; was in Window.tsx): moved inside as it opens and given back where
// it was when it closes; Tab kept round inside a modal one.
import { useLayoutEffect, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'

// Focus inside while open, and back where it was on close: `first` (or the root) takes it as it opens.
export function useDialogFocus(root: RefObject<HTMLElement | null>, first: RefObject<HTMLElement | null> | null, move = true) {
  useLayoutEffect(() => {
    const was = document.activeElement as HTMLElement | null
    if (move) (first?.current ?? root.current)?.focus({ preventScroll: true })
    return () => {
      if (was && was !== document.body && document.contains(was)) was.focus({ preventScroll: true })
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
