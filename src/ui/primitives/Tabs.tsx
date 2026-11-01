// One row of options, one of them current (D-326; D-344's toggle cells): every option is a Button cell, the cells
// joined by a hairline seam, the current one lit as a pressed Button. `tabs` (a setup's ROWS COLS CELLS, a side view's
// decks) are as wide as their row, caps, a tablist to the keyboard; `segments` (the finder's here | everywhere, a Choice's
// P1 P2 P3) are as wide as their words, a radio group. A count after a label, faint. Arrows and Home/End move, and pick,
// as the focus moves. `tones` lights an option in its own colour; `onReclick` is a click on the current one (a Choice
// that clears); `edit` marks the options as a picker the preview lock disables (D-098); `disabled` for who can't edit.
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Tabs.module.css'

export type TabOption<T extends string> = { value: T; label: ReactNode; count?: ReactNode; title?: string; tone?: string }

type Props<T extends string> = {
  options: TabOption<T>[]
  value: T | undefined
  onChange: (value: T) => void
  label: string
  look?: 'tabs' | 'segments'
  onReclick?: () => void
  edit?: boolean
  disabled?: boolean
  className?: string
}

export function Tabs<T extends string>({ options, value, onChange, label, look = 'tabs', onReclick, edit, disabled, className }: Props<T>) {
  const row = useRef<HTMLDivElement>(null)
  const tabs = look === 'tabs'
  // None current (a group beside another sharing one choice: a deck's tabs while MINE is open, a Choice with nothing
  // picked): the first is the one the keyboard reaches, and the arrows start from it.
  const current = options.findIndex((o) => o.value === value)
  const move = (e: KeyboardEvent) => {
    const at = current < 0 ? (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? 0 : -1) : current
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : null
    if (to === null) return
    e.preventDefault()
    const next = options[(to + options.length) % options.length]
    onChange(next.value)
    requestAnimationFrame(() => row.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus())
  }
  return (
    <div ref={row} className={[styles.row, className].filter(Boolean).join(' ')} data-look={look} role={tabs ? 'tablist' : 'radiogroup'} aria-label={label} onKeyDown={move}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            className={styles.option}
            role={tabs ? 'tab' : 'radio'}
            aria-selected={tabs ? on : undefined}
            aria-checked={tabs ? undefined : on}
            tabIndex={on || (current < 0 && i === 0) ? 0 : -1}
            data-value={o.value}
            data-edit={edit || undefined}
            disabled={disabled}
            title={o.title}
            style={o.tone ? ({ '--button-on': o.tone } as React.CSSProperties) : undefined}
            onClick={() => (on ? onReclick?.() : onChange(o.value))}
          >
            <span className={styles.text}>{o.label}</span>
            {o.count !== undefined && <span className={styles.count}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
