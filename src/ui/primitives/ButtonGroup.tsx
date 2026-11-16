// Buttons that belong together (D-344; D-384): nothing joins them but how close they sit, a small gap (`--seam`) and
// no strip or line, so a row of five reads as its words. A dock's or a console's actions, a panel's or a wizard's
// foot, a zoom's `− 100% +`, a deck column's tools, a Choice's options.
// `vertical` stacks them, the gap between rows (the HUD's side nav and its bottom-left corner). In a stack, a child
// filled to its edge (a person's circle) says so with `data-filled` and gets an icon's air round it, so the seen gaps
// are all one (D-402); nothing in the HUD sets a gap of its own. `label` is read out for
// the group (a radio group's or a toolbar's name).
import type { HTMLAttributes, ReactNode } from 'react'
import styles from './ButtonGroup.module.css'

type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  children: ReactNode
  label?: string
  vertical?: boolean
}

export function ButtonGroup({ children, label, vertical, className, role = 'group', ...rest }: Props) {
  return (
    <span {...rest} role={role} aria-label={label} data-vertical={vertical || undefined} className={[styles.group, className].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}
