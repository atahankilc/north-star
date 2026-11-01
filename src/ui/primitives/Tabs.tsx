// One row of options, one of them current (D-326): the setups' tabs and the segmented switches. `look` tabs: caps
// labels, the current one underlined in magenta (a setup's ROWS COLS CELLS); segments: plain labels, the current one
// filled cyan (the finder's here | everywhere). A count after a label, faint. To the keyboard a tablist (tabs) or a
// radio group (segments): arrows and Home/End move, and pick, as the focus moves.
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Tabs.module.css'

export type TabOption<T extends string> = { value: T; label: ReactNode; count?: ReactNode; title?: string }

type Props<T extends string> = {
  options: TabOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  look?: 'tabs' | 'segments'
  className?: string
}

export function Tabs<T extends string>({ options, value, onChange, label, look = 'tabs', className }: Props<T>) {
  const row = useRef<HTMLDivElement>(null)
  const tabs = look === 'tabs'
  // None current (a group beside another sharing one choice: a deck's tabs while MINE is open): the first is the one
  // the keyboard reaches, and the arrows start from it.
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
            title={o.title}
            onClick={() => onChange(o.value)}
          >
            {o.label}
            {o.count !== undefined && <span className={styles.count}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
