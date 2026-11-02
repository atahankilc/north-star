// A column docked to an edge of the screen (D-359): the shell every side panel is built on (the right panel, D-219; the
// agent's column; the tasks side view). What each had to do for itself before, once:
// - fixed to the edge (`side`), the screen's full height, `offset` from that edge (what's already there: a pane beside,
//   the agent's column), `width` (the right panel's 400 by default);
// - the page's black, a line on its inner edge with the docked marks on that edge's corners (Corners.module.css);
// - built cell by cell as it opens and broken apart as it closes (Appear: wrap it in <AnimatePresence>);
// - the canvas never hears a press, a wheel, a double-click or a right-click through it (stopCanvas);
// - Escape closes it (`onClose`), on the one Escape stack (useEscapeLayer): a menu or a thread opened over it first;
// - `role="dialog"` with its name: the canvas's keys and wheel step aside for what's over it (CanvasView's
//   SCROLLS_ITSELF, PlaneCards' keys).
// What's inside (a head, sections, a foot) is the caller's: SidePanel is the right panel's.
import { useRef, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Appear } from '../primitives/Appear'
import { stopCanvas } from '../foundation/canvasGuard'
import { useEscapeLayer } from '../foundation/useEscapeLayer'
import corners from '../foundation/Corners.module.css'
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
  const column = (
    <Appear
      as="aside"
      elRef={root}
      {...stopCanvas}
      {...rest}
      role="dialog"
      aria-label={label}
      data-side={side}
      data-corners={side === 'right' ? 'left' : 'right'}
      className={[styles.column, corners.corners, className].filter(Boolean).join(' ')}
      style={{ [side]: offset, ...(width !== undefined ? { '--column-w': typeof width === 'number' ? `${width}px` : width } : {}), ...style } as CSSProperties}
    >
      {children}
    </Appear>
  )
  return portal ? createPortal(column, document.body) : column
}
