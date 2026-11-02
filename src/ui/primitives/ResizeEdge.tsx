// An edge dragged to resize what it's on (D-359): the agent's column (its left edge, the width), the threads dock (its
// top edge, the height). A strip over the edge with the resize cursor, a cyan line on it while pointed at or dragged.
// What the drag means (the size, its limits, keeping it in the browser) is the caller's: `onDrag` hears every step.
// Its parent must be positioned (it sits on the parent's edge).
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { dragPointer } from '../foundation/dragPointer'
import styles from './ResizeEdge.module.css'

type Props = {
  edge: 'left' | 'right' | 'top' | 'bottom'
  // The press (read the size it starts from here), every step, the release.
  onStart?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onDrag: (e: PointerEvent) => void
  onEnd?: (e: PointerEvent) => void
  // Read out: what it resizes (`The agent's width`).
  label?: string
  className?: string
}

export function ResizeEdge({ edge, onStart, onDrag, onEnd, label, className }: Props) {
  const [held, setHeld] = useState(false)
  return (
    <div
      className={[styles.edge, className].filter(Boolean).join(' ')}
      data-edge={edge}
      data-held={held || undefined}
      role="separator"
      aria-orientation={edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal'}
      aria-label={label}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        setHeld(true)
        onStart?.(e)
        // While held, the whole page keeps the cursor and nothing gets selected.
        document.documentElement.setAttribute('data-resizing', edge === 'left' || edge === 'right' ? 'x' : 'y')
        dragPointer(e, onDrag, (ev) => {
          setHeld(false)
          document.documentElement.removeAttribute('data-resizing')
          onEnd?.(ev)
        })
      }}
    />
  )
}
