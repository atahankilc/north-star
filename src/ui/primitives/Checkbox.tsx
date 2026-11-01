// The one checkbox (D-326; D-344's toggle cells): the whole label is a Button cell you switch on, `✓` before the word
// and lit as a pressed Button while it's on. A real checkbox to the keyboard and screen readers (role, Space toggles).
// `hint` is a small line under the cell (a setup's options); `tone` lights it in another colour (a checklist's done);
// `strike` crosses the label out while on. With no `label` it's a square glyph cell (a checklist's box beside text typed
// in place; give it an `aria-label`). `CheckMark` is the same box drawn inside something that is itself the button (a
// task's row). Menus, checklists, the agent's change list and the setups all draw this one.
import type { CSSProperties, ReactNode } from 'react'
import styles from './Checkbox.module.css'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  hint?: ReactNode
  disabled?: boolean
  tone?: string
  // The label struck through when checked (a done checklist item).
  strike?: boolean
  'aria-label'?: string
  title?: string
  className?: string
}

const on = (tone?: string) => (tone ? ({ '--button-on': tone } as CSSProperties) : undefined)

export function Checkbox({ checked, onChange, label, hint, disabled, tone, strike, className, ...aria }: Props) {
  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      className={[styles.check, hint ? undefined : className].filter(Boolean).join(' ')}
      data-icon={label === undefined || undefined}
      data-strike={strike || undefined}
      style={on(tone)}
      onClick={() => onChange(!checked)}
      {...aria}
    >
      {label === undefined ? (
        <span aria-hidden>{checked ? '✓' : ''}</span>
      ) : (
        <>
          {checked && (
            <span className={styles.mark} aria-hidden>
              ✓
            </span>
          )}
          <span className={styles.label}>{label}</span>
        </>
      )}
    </button>
  )
  if (!hint) return box
  return (
    <span className={[styles.withHint, className].filter(Boolean).join(' ')}>
      {box}
      <small className={styles.hint}>{hint}</small>
    </span>
  )
}

export function CheckMark({ checked, tone }: { checked: boolean; tone?: string }) {
  return (
    <span className={styles.check} data-icon data-look data-on={checked || undefined} style={on(tone)} aria-hidden>
      {checked ? '✓' : ''}
    </span>
  )
}
