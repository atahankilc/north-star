// Buttons that belong together, joined into one strip (D-344): their cells touch with a hairline seam between them
// instead of a gap each, so a row of five takes the room of the words, not of five buttons. A dock's or a console's
// actions, a panel's or a wizard's foot, a zoom's `− 100% +`, a deck column's tools, a Choice's options.
// `label` is read out for the group (a radio group's or a toolbar's name).
import type { HTMLAttributes, ReactNode } from 'react'
import styles from './ButtonGroup.module.css'

type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  children: ReactNode
  label?: string
}

export function ButtonGroup({ children, label, className, role = 'group', ...rest }: Props) {
  return (
    <span {...rest} role={role} aria-label={label} className={[styles.group, className].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}
