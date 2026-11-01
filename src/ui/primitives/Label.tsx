// The label (D-093, D-326's kit): small mono caps, tracked, dim by default. `as` the element it is (a form's <label>
// with `htmlFor`, a heading), `tone` faint / dim / default.
import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Label.module.css'

// Other attributes (style, data-*, aria-*, title) go on the element: a label placed by its caller (a timeline's row
// head at its row's top).
type Props = Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'> & {
  as?: 'span' | 'label' | 'h3' | 'div'
  htmlFor?: string
  tone?: 'faint' | 'dim' | 'default'
  className?: string
  children: ReactNode
}

export function Label({ as: Tag = 'span', htmlFor, tone, className, children, ...rest }: Props) {
  return (
    <Tag {...rest} className={[styles.label, className].filter(Boolean).join(' ')} data-tone={tone === 'dim' ? undefined : tone} htmlFor={Tag === 'label' ? htmlFor : undefined}>
      {children}
    </Tag>
  )
}

export const labelClass = styles.label
