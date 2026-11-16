// A line that's dragged (D-359; D-397: ResizeEdge and SplitLine were this twice). Two places it can be:
// - on an edge of its parent (`left`, `right`, `top`, `bottom`), to resize it: the agent's column, a side panel. Nothing
//   drawn at rest, a cyan line on the edge while pointed at or held.
// - between two parts of the screen, placed by the caller's `style` (`x` a standing line moved sideways, `y` a lying one
//   moved up and down): a plane and what's beside it (D-211), two stacked panes, the tasks side view and its days
//   (D-300), the documents list and what's open from it (D-232). A 1 px rule at rest, cyan while pointed at or held.
// A 9 px strip to grab either way; while held the whole page keeps the cursor and selects nothing. What the drag means
// (the size, its limits, keeping it in the browser) is the caller's: `onDrag` hears every step. Its parent must be
// positioned.
import { useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { dragPointer } from '../foundation/dragPointer'
import styles from './DragLine.module.css'

type Props = {
  at: 'left' | 'right' | 'top' | 'bottom' | 'x' | 'y'
  // The press (read the size it starts from here), every step, the release.
  onStart?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onDrag: (e: PointerEvent) => void
  onEnd?: (e: PointerEvent) => void
  // Read out: what it resizes or splits (`The agent's width`, `Plane and what's beside it`).
  label?: string
  onDoubleClick?: (e: MouseEvent<HTMLDivElement>) => void
  className?: string
  style?: CSSProperties
  'data-learn'?: string
  'data-off-space'?: boolean
}

export function DragLine({ at, onStart, onDrag, onEnd, label, className, ...rest }: Props) {
  const [held, setHeld] = useState(false)
  const sideways = at === 'left' || at === 'right' || at === 'x'
  return (
    <div
      {...rest}
      className={[styles.line, className].filter(Boolean).join(' ')}
      data-at={at}
      data-held={held || undefined}
      role="separator"
      aria-orientation={sideways ? 'vertical' : 'horizontal'}
      aria-label={label}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        setHeld(true)
        onStart?.(e)
        document.documentElement.setAttribute('data-resizing', sideways ? 'x' : 'y')
        dragPointer(e, onDrag, (ev) => {
          setHeld(false)
          document.documentElement.removeAttribute('data-resizing')
          onEnd?.(ev)
        })
      }}
    />
  )
}
