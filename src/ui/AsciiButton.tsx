import type { ButtonHTMLAttributes } from 'react'
import styles from './AsciiButton.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  accent?: 'magenta' | 'cyan' | 'yellow' | 'blue' | 'green'
}

// `[ LABEL ]`-style button (docs/DESIGN.md §6). The accent fills in on hover.
export function AsciiButton({ accent = 'magenta', className, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={[styles.button, className].filter(Boolean).join(' ')}
      style={{ ['--accent' as string]: `var(--accent-${accent})` }}
    >
      <span aria-hidden className={styles.bracket}>[</span>
      <span className={styles.label}>{children}</span>
      <span aria-hidden className={styles.bracket}>]</span>
    </button>
  )
}
