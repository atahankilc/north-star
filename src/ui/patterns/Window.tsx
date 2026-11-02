// The one window (D-326's patterns; docs/foundation-audit-2026-10-31.md §4): a dialog over the page. What every window
// had to do for itself before, once:
// - `role="dialog"` with its name (onboarding's lessons treat a dialog as something not to cover, Lesson.tsx);
// - focus moved inside as it opens and given back where it was when it closes; while modal, Tab goes round inside;
// - Escape closes (`onClose`): the top of the one Escape stack (useEscapeLayer, D-359), never onboarding's coach's;
// - a scrim behind a modal one, a press on it closing it (or kept by the caller: `scrimPress`);
// - the frame: the wizard window's look (D-316: a line, the page's black), or `look="bare"` for a caller with its own;
// - the one close, `[×] esc` (D-219), when asked for (`close`);
// - an entrance: the small one (`enter`, Enter.module.css), the cell-by-cell build (`cells`, Appear) or none;
// - into the body (`portal`), or where it's drawn;
// - `role="alertdialog"` for a hazard's question, and what's drawn on the scrim under it (`behind`).
// The scrim's layer and colour can be set from outside through `--window-z` and `--window-scrim` (custom properties,
// so they never fight the stylesheet order).
import { useRef, type CSSProperties, type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Appear } from '../primitives/Appear'
import { Button } from '../primitives/Button'
import { keepFocus } from '../foundation/canvasGuard'
import { trapTab, useDialogFocus } from '../foundation/focus'
import { useEscapeLayer } from '../foundation/useEscapeLayer'
import enter from '../foundation/Enter.module.css'
import styles from './Window.module.css'

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
  // `alertdialog`: it asks before something that can't be taken lightly (the hazard confirm; onboarding reads it).
  role?: 'dialog' | 'alertdialog'
  // Drawn on the scrim, under the window (the hazard confirm's tape).
  behind?: ReactNode
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
  role = 'dialog',
  behind,
  className,
  onKeyDown,
  ...rest
}: Props) {
  const own = useRef<HTMLElement>(null)
  const root = elRef ?? own
  useDialogFocus(root, focus || null, focus !== false)

  // Escape (D-359's stack): the window on top hears it first, wherever the focus is (a field inside, the page behind).
  useEscapeLayer(() => onClose?.(), { on: escape && !!onClose, fields: true, root })

  const box = {
    ...rest,
    role,
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
          <Button icon aria-label="close" title="Close (Esc)" onClick={onClose}>
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
      {behind}
      {win}
    </div>
  ) : (
    win
  )
  return portal ? createPortal(shown, document.body) : shown
}
