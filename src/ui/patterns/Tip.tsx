// A word with a short line on hover or focus (D-355): the onboarding's app words (`card`, `plane`…) coloured, their
// meaning in a small box under them (above when there's no room), fixed in a portal so the window round it can't clip
// it. Never pressed: a click goes through to what's under it; keyboard focus shows it too (`role="tooltip"`).
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { floatFrom, type Floating } from '../foundation/floating'
import { tokenPx } from '../../styles/cssToken'
import styles from './Tip.module.css'

type Props = {
  // What shows on hover.
  tip: ReactNode
  children: ReactNode
  className?: string
}

export function Tip({ tip, children, className }: Props) {
  const el = useRef<HTMLSpanElement>(null)
  const box = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<Floating | null>(null)
  const id = useId()
  // First drawn unseen, measured, then placed under the word (above it near the screen's foot).
  useLayoutEffect(() => {
    if (!open || !el.current) return setAt(null)
    setAt(floatFrom(el.current, { height: box.current?.offsetHeight ?? 0, width: tokenPx('--menu-w') }))
  }, [open])
  return (
    <>
      <span
        ref={el}
        className={[styles.word, className].filter(Boolean).join(' ')}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <span ref={box} id={id} role="tooltip" className={styles.tip} style={at?.style} data-placed={at ? true : undefined}>
            {tip}
          </span>,
          at?.host ?? document.body,
        )}
    </>
  )
}
