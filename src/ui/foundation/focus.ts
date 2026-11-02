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

// Where a key went, for the page's own shortcuts (D-361: one check, it had been written six ways).
// Typing: a text field or editable text has it (a checkbox, radio, range or button input isn't typing).
const FIELD = 'textarea, select, input:not([type=button], [type=checkbox], [type=radio], [type=range], [type=submit])'
export const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || !!t.closest(FIELD))

// Taken: typing, or a menu, a list, a modal window or a lesson holds the keys. `docked` adds what's docked beside the
// page (`role="dialog"`: a side panel, the agent's column, the threads): a key there isn't for the canvas under it.
// Leave it off for what can itself live in one (a deck in the tasks side view).
const HOLDS_KEYS = '[role=menu], [role=listbox], [aria-modal=true], [role=alertdialog], [data-coach]'
export const keysTaken = (t: EventTarget | null, o: { docked?: boolean } = {}) =>
  isTyping(t) || (t instanceof Element && !!t.closest(o.docked ? `${HOLDS_KEYS}, [role=dialog]` : HOLDS_KEYS))

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
