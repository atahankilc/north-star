// The one window (D-326's patterns; docs/foundation-audit-2026-10-31.md §4): a dialog over the page. What every window
// had to do for itself before, once:
// - `role="dialog"` with its name (onboarding's lessons treat a dialog as something not to cover, Lesson.tsx);
// - focus moved inside as it opens and given back where it was when it closes; while modal, Tab goes round inside;
// - Escape closes (`onClose`), heard first wherever the focus is, never by onboarding's coach (`[data-coach]`);
// - a scrim behind a modal one, a press on it closing it (or kept by the caller: `scrimPress`);
// - the frame: the wizard window's look (D-316: a line, the page's black), or `look="bare"` for a caller with its own;
// - the one close, `[×] esc` (D-219), when asked for (`close`);
// - an entrance: the small one (`enter`, Enter.module.css), the cell-by-cell build (`cells`, Appear) or none;
// - into the body (`portal`), or where it's drawn.
// The scrim's layer and colour can be set from outside through `--window-z` and `--window-scrim` (custom properties,
// so they never fight the stylesheet order).
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Appear } from '../primitives/Appear'
import { Button } from '../primitives/Button'
import enter from '../foundation/Enter.module.css'
import styles from './Window.module.css'

// Focus inside while open, and back where it was on close: `first` (or the window) takes it as it opens.
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

// A press on a scrim (not on what's on it) keeps the focus where it is, in the window (it never drops to <body>).
export const keepFocus = {
  onPointerDownCapture: (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) e.preventDefault()
  },
  onMouseDown: (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) e.preventDefault()
  },
}

// What the canvas would do with a press, a wheel or a double-click never happens through a window.
export const stopCanvas = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
  onWheel: (e: React.WheelEvent) => e.stopPropagation(),
  onContextMenu: (e: React.MouseEvent) => e.stopPropagation(),
}

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  children: ReactNode
  // Its name, read out: `label`, or the id of what names it.
  label?: string
  labelledBy?: string
  // Closing it: Escape (unless `escape` is false: the caller hears Escape itself), the scrim, `[×] esc`.
  onClose?: () => void
  escape?: boolean
  close?: boolean
  // Modal: the scrim behind, `aria-modal`, Tab kept inside (unless `trap` is false: the caller's Tab, the finder's).
  modal?: boolean
  trap?: boolean
  // A press on the scrim: closes (default, with `onClose`), or `'keep'` (nothing happens, the focus stays inside).
  scrimPress?: 'close' | 'keep'
  // More on the scrim (onboarding's `data-coach`).
  scrimProps?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, unknown>
  // The wizard window's frame, or `bare` for a caller with its own.
  look?: 'frame' | 'bare'
  // What takes the focus as it opens (the window itself without it); `false`: leave it where it is (an autoFocus inside).
  focus?: RefObject<HTMLElement | null> | false
  entrance?: 'enter' | 'cells' | 'none'
  portal?: boolean
  // The window element, for a caller that measures it or runs its own rebuild on it.
  elRef?: RefObject<HTMLElement | null>
  style?: CSSProperties
}

export function Window({
  children,
  label,
  labelledBy,
  onClose,
  escape = true,
  close = false,
  modal = true,
  trap = modal,
  scrimPress = 'close',
  scrimProps,
  look = 'frame',
  focus,
  entrance = 'enter',
  portal = true,
  elRef,
  className,
  onKeyDown,
  ...rest
}: Props) {
  const own = useRef<HTMLElement>(null)
  const root = elRef ?? own
  useDialogFocus(root, focus || null, focus !== false)

  // Escape, heard first wherever the focus is (a field inside, the page behind); never what onboarding's coach hears.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!escape || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as Element | null)?.closest?.('[data-coach]')) return
      e.stopPropagation()
      closeRef.current?.()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [escape, onClose])

  const box = {
    ...rest,
    role: 'dialog',
    'aria-modal': modal || undefined,
    'aria-label': label,
    'aria-labelledby': labelledBy,
    tabIndex: -1,
    className: [look === 'frame' ? styles.window : styles.bare, entrance === 'enter' ? enter.enter : undefined, className].filter(Boolean).join(' '),
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
      if (trap) trapTab(e, root.current)
      onKeyDown?.(e)
    },
  }
  const inner = (
    <>
      {close && onClose && (
        <span className={styles.close}>
          <Button keyHint="esc" aria-label="close" onClick={onClose}>
            ×
          </Button>
        </span>
      )}
      {children}
    </>
  )
  const win =
    entrance === 'cells' ? (
      <Appear as="section" elRef={root} {...box}>
        {inner}
      </Appear>
    ) : (
      <section ref={root as RefObject<HTMLElement>} {...box}>
        {inner}
      </section>
    )
  const shown = modal ? (
    <div
      {...keepFocus}
      {...scrimProps}
      className={[styles.scrim, scrimProps?.className].filter(Boolean).join(' ')}
      onPointerDown={(e) => {
        scrimProps?.onPointerDown?.(e)
        if (e.target === e.currentTarget && scrimPress === 'close') onClose?.()
      }}
    >
      {win}
    </div>
  ) : (
    win
  )
  return portal ? createPortal(shown, document.body) : shown
}
