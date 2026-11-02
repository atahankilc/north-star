// The line between two parts of the screen that's dragged to share it (D-359): a plane and what's beside it (D-211), two
// stacked panes, the tasks side view and its days (D-300), the documents list and what's open from it (D-232). A 9 px
// strip to grab, a 1 px rule drawn, cyan while pointed at or dragged. Where it sits (`style`: left, top) and what a drag
// means are the caller's: `onDrag` hears every step of the pointer. `axis`: `x` a standing line moved sideways, `y` a
// lying one moved up and down. Its parent must be positioned.
import type { CSSProperties, MouseEvent } from 'react'
import { dragPointer } from '../foundation/dragPointer'
import styles from './SplitLine.module.css'

type Props = {
  axis?: 'x' | 'y'
  onDrag: (e: PointerEvent) => void
  onEnd?: (e: PointerEvent) => void
  // Read out: what it splits (`Plane and what's beside it`).
  label: string
  onDoubleClick?: (e: MouseEvent<HTMLDivElement>) => void
  className?: string
  style?: CSSProperties
  'data-learn'?: string
  'data-off-space'?: boolean
}

export function SplitLine({ axis = 'x', onDrag, onEnd, label, className, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={[styles.line, className].filter(Boolean).join(' ')}
      data-axis={axis}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
      onPointerDown={(e) => dragPointer(e, onDrag, onEnd)}
    />
  )
}
