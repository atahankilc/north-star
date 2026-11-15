// The HUD's tool (D-326, the kit; D-384): an icon alone, nothing behind it, dim, strong on a round shade when pointed
// at, and lit cyan with a soft glow while what it opens is open (`pressed`). The side nav's fit, compass and `?`, the decks-and-days button and the threads button drew it five
// times by hand, the settings gear a sixth. `dot` is a magenta mark on its corner (something new, unread); `badge` a count
// there (CountBadge), magenta for what's new, `badgeTone` cyan for people waiting (the gear).
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { CountBadge } from './CountBadge'
import styles from './ToolButton.module.css'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  // What it does, read out (the icon has no words).
  label: string
  pressed?: boolean
  dot?: boolean
  badge?: number
  badgeTone?: 'magenta' | 'cyan'
  children: ReactNode
  'data-learn'?: string
  'data-viewer-ok'?: boolean
}

export function ToolButton({ label, pressed, dot, badge, badgeTone, children, className, type = 'button', ...rest }: Props) {
  return (
    <button
      {...rest}
      type={type}
      className={[styles.tool, className].filter(Boolean).join(' ')}
      aria-label={label}
      aria-pressed={pressed}
      // A glyph alone: no lamp, the icon itself is what lights (D-384).
      data-icon
    >
      {children}
      {badge ? <CountBadge count={badge} tone={badgeTone} /> : dot && <span className={styles.dot} aria-hidden />}
    </button>
  )
}
