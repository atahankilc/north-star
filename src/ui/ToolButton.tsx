// The HUD's tool (D-326, the kit): an icon alone, a control square, dim, strong on hover, cyan while what it opens is
// open (`pressed`). The side nav's fit, compass and `?`, the decks-and-days button and the threads button drew it five
// times by hand. `dot` is a magenta mark on its corner (something new, unread); `badge` a count there (CountBadge).
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { CountBadge } from './CountBadge'
import styles from './ToolButton.module.css'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  // What it does, read out (the icon has no words).
  label: string
  pressed?: boolean
  dot?: boolean
  badge?: number
  children: ReactNode
  'data-learn'?: string
  'data-viewer-ok'?: boolean
}

export function ToolButton({ label, pressed, dot, badge, children, className, type = 'button', ...rest }: Props) {
  return (
    <button
      {...rest}
      type={type}
      className={[styles.tool, className].filter(Boolean).join(' ')}
      aria-label={label}
      aria-pressed={pressed}
      data-on={pressed || undefined}
    >
      {children}
      {badge ? <CountBadge count={badge} /> : dot && <span className={styles.dot} aria-hidden />}
    </button>
  )
}
