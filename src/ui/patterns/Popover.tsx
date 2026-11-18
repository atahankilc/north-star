// What a trigger opens in a layer of its own (D-093): fixed to the viewport in a portal, so a scrolling panel or table
// can't clip it; under its anchor unless it only fits above, kept inside its side panel or the app (floatFrom); in a
// modal <dialog> it stays in the dialog. Placed once it has drawn (its own height decides above or below), it follows
// its anchor when something scrolls or the window resizes. A press outside it and its anchor closes it; Escape closes
// only it (not the dialog or the panel round it) and gives focus back. A Select's list is one.
import { useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../foundation/floating'
import { useDismiss } from '../foundation/useDismiss'
import styles from './Popover.module.css'

type Props = {
  anchor: RefObject<HTMLElement | null>
  // `refocus`: give focus back to the anchor.
  onClose: (refocus: boolean) => void
  children: ReactNode
  // As wide as the anchor at least, else this (a token's px).
  minWidth?: number
  className?: string
}

export function Popover({ anchor, onClose, children, minWidth, className }: Props) {
  const root = useRef<HTMLDivElement>(null)
  useDismiss(root, (why) => onClose(why === 'escape'), { escape: true, inside: [anchor] })
  const at = useFloating(anchor, root, true, { minWidth })

  // First drawn unseen at the anchor's layer, measured, then placed.
  const host = at?.host ?? anchor.current?.closest('dialog') ?? document.body
  return createPortal(
    <div ref={root} className={[styles.popover, className].filter(Boolean).join(' ')} style={at?.style} data-placed={at ? true : undefined}>
      {children}
    </div>,
    host,
  )
}
