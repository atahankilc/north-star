// A column docked to an edge of the screen (D-359): the shell every side panel is built on (the right panel, D-219; the
// agent's column; the tasks side view). What each had to do for itself before, once:
// - fixed to the edge (`side`), the screen's full height, `offset` from that edge (what's already there: a pane beside,
//   the agent's column), `width` (the right panel's 400 by default);
// - on the ground under the main screen (D-387, foundation/sheet.ts): the screen lifts, goes round and draws back from
//   it; the column itself is bare, the ground's colour, no line, no marks; only what the sheet has drawn back off is
//   shown, so the sheet's edge uncovers it as it opens and covers it again as it closes;
// - no entrance of its own (D-395): it's there at once, under the sheet, and the sheet drawing back is what shows it;
//   closing, it stays until the sheet is back over it (wrap it in <AnimatePresence>);
// - the canvas never hears a press, a wheel, a double-click or a right-click through it (stopCanvas);
// - Escape closes it (`onClose`), on the one Escape stack (useEscapeLayer): a menu or a thread opened over it first;
// - `role="dialog"` with its name: the canvas's keys and wheel step aside for what's over it (CanvasView's
//   SCROLLS_ITSELF, PlaneCards' keys).
// What's inside (a head, sections, a foot) is the caller's: SidePanel is the right panel's.
import { useEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { stopCanvas } from '../foundation/canvasGuard'
import { useEscapeLayer } from '../foundation/useEscapeLayer'
import { usePresence } from 'motion/react'
import { DUR } from '../foundation/motionTokens'
import { isReducedMotion } from '../../state/motion'
import { useSheetColumn } from '../foundation/sheet'
import styles from './EdgeColumn.module.css'

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  side?: 'right' | 'left'
  // From that edge (a CSS length: `calc(…)`, `12px`), and its width (the right panel's `--panel-w` without it).
  offset?: string
  width?: string | number
  // Read out.
  label: string
  // Escape and whatever closes it; `escape` false: the caller hears Escape itself.
  onClose?: () => void
  escape?: boolean
  // Into the body (default), or where it's drawn.
  portal?: boolean
  elRef?: RefObject<HTMLElement | null>
  children: ReactNode
  'data-learn'?: string
}

export function EdgeColumn({ side = 'right', offset = '0px', width, label, onClose, escape = true, portal = true, elRef, className, style, children, ...rest }: Props) {
  const own = useRef<HTMLElement>(null)
  const root = elRef ?? own
  useEscapeLayer(() => onClose?.(), { on: escape && !!onClose, root })
  const [present, safeToRemove] = usePresence()
  useSheetColumn(root, side, present)
  // Leaving: the sheet travels back over it first (Sheet.module.css's time), then it goes.
  useEffect(() => {
    if (present) return
    const t = setTimeout(() => safeToRemove?.(), isReducedMotion() ? 0 : DUR.slow)
    return () => clearTimeout(t)
  }, [present, safeToRemove])
  const column = (
    <aside
      ref={root}
      {...stopCanvas}
      {...rest}
      role="dialog"
      aria-label={label}
      data-side={side}
      data-sheet
      data-ground
      data-leaving={present ? undefined : ''}
      className={[styles.column, className].filter(Boolean).join(' ')}
      style={{ [side]: offset, '--column-off': offset, ...(width !== undefined ? { '--column-w': typeof width === 'number' ? `${width}px` : width } : {}), ...style } as CSSProperties}
    >
      {children}
    </aside>
  )
  return portal ? createPortal(column, document.body) : column
}
