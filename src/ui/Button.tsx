// The one button (D-326, the kit; docs/foundation-audit-2026-10-31.md §2): the `[verb]` of the design language (D-093:
// actions lowercase), in two sizes.
// - `sm` (the default): the small row and inline action, dim with faint brackets; `tone` primary is cyan, danger turns
//   magenta on hover, main is the strong one of a row (a dock's `[unfocus]`); `pressed` lights a switch that's on;
//   `keyHint` is its key, faint, after it.
// - `md`: the page's button, the accent wiping in from the left on hover (`accent`).
// - `icon`: no brackets, for a glyph alone.
// AsciiButton, PanelAction and DockAction draw this; so should every new button (check:kit, D-326).
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonTone = 'primary' | 'danger' | 'main'
export type Accent = 'magenta' | 'cyan' | 'yellow' | 'blue' | 'green'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode
  size?: 'sm' | 'md'
  tone?: ButtonTone
  accent?: Accent
  pressed?: boolean
  keyHint?: string
  icon?: boolean
}

export function Button({ children, size = 'sm', tone, accent = 'magenta', pressed, keyHint, icon, className, style, type = 'button', ...rest }: Props) {
  const md = size === 'md'
  const button = (
    <button
      {...rest}
      type={type}
      className={[md ? styles.md : styles.sm, className].filter(Boolean).join(' ')}
      data-tone={tone}
      data-icon={icon || undefined}
      aria-pressed={pressed}
      style={md ? ({ '--accent': `var(--accent-${accent})`, ...style } as CSSProperties) : style}
    >
      {md ? (
        <>
          <span aria-hidden className={styles.bracket}>
            [
          </span>
          <span className={styles.label}>{children}</span>
          <span aria-hidden className={styles.bracket}>
            ]
          </span>
        </>
      ) : (
        children
      )}
    </button>
  )
  if (!keyHint) return button
  return (
    <span className={styles.withKey}>
      {button}
      <span className={styles.key}>{keyHint}</span>
    </span>
  )
}
