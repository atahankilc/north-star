// The one checkbox (D-326): `[x] label` / `[ ] label` in the bracket language (D-093), the mark cyan when on, faint
// when off. A real checkbox to the keyboard and screen readers (role, Space toggles). `hint` is a small line under the
// label (a setup's options); `tone` colours the mark (a checklist's done).
import type { ReactNode } from 'react'
import styles from './Checkbox.module.css'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  hint?: ReactNode
  disabled?: boolean
  tone?: string
  // The label struck through when checked (a done checklist item).
  strike?: boolean
  // `xs` in a dense panel set in --text-xs (a setup's options); `sm` elsewhere.
  size?: 'sm' | 'xs'
  className?: string
}

export function Checkbox({ checked, onChange, label, hint, disabled, tone, strike, size, className }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      className={[styles.check, className].filter(Boolean).join(' ')}
      data-strike={strike || undefined}
      data-size={size === 'xs' ? 'xs' : undefined}
      style={tone ? ({ '--tone': tone } as React.CSSProperties) : undefined}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.box} aria-hidden>
        {checked ? '[x]' : '[ ]'}
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && <small className={styles.hint}>{hint}</small>}
      </span>
    </button>
  )
}
