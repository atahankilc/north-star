// The label (D-093, D-326's kit): small mono caps, tracked, dim by default. `as` the element it is (a form's <label>
// with `htmlFor`, a heading), `tone` faint / dim / default.
import type { ReactNode } from 'react'
import styles from './Label.module.css'

type Props = {
  as?: 'span' | 'label' | 'h3' | 'div'
  htmlFor?: string
  tone?: 'faint' | 'dim' | 'default'
  className?: string
  children: ReactNode
}

export function Label({ as: Tag = 'span', htmlFor, tone, className, children }: Props) {
  return (
    <Tag className={[styles.label, className].filter(Boolean).join(' ')} data-tone={tone === 'dim' ? undefined : tone} htmlFor={Tag === 'label' ? htmlFor : undefined}>
      {children}
    </Tag>
  )
}

export const labelClass = styles.label
