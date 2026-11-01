// Framed options (D-326, the kit's patterns): a few choices side by side, each in its own frame, the picked ones lit
// cyan (a matrix's `customers 0 | problems 0 | …`, a table's fields, a deck's `tasks | cards`). Where Choice is a line
// of brackets and Tabs a row of labels, these are boxes: for picking among a few things that each say something.
// - `pick="one"`: one of them (a radio group; arrows move and pick; `clearable` lets the picked one be clicked off).
// - `pick="many"`: any of them (toggle buttons, each pressed or not).
// - `pick="act"`: each one does something when clicked (`+ status`, `+ a scale`); nothing stays lit.
// An option may carry a swatch (a card type's colour, src/ui/cardTone.ts), a count after its label, a title on hover;
// with `cards`, each is a small card: a sample of what it makes, its label, a line under it, three to a row.
import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Options.module.css'

export type BoxOption<T extends string> = {
  value: T
  label: ReactNode
  title?: string
  swatch?: string
  count?: ReactNode
  // With `cards`: what it looks like, over the label, and a line under it.
  sample?: ReactNode
  line?: ReactNode
  disabled?: boolean
}

type Common<T extends string> = {
  options: BoxOption<T>[]
  // What the group is, read out.
  label: string
  cards?: boolean
  className?: string
}
type One<T extends string> = Common<T> & { pick: 'one'; value: T | undefined; onChange: (value: T | undefined) => void; clearable?: boolean }
type Many<T extends string> = Common<T> & { pick: 'many'; values: readonly T[]; onChange: (values: T[]) => void }
type Act<T extends string> = Common<T> & { pick: 'act'; onPick: (value: T) => void }

export function Options<T extends string>(props: One<T> | Many<T> | Act<T>) {
  const { options, label, cards, className } = props
  const row = useRef<HTMLDivElement>(null)
  const one = props.pick === 'one'
  const on = (v: T) => (props.pick === 'one' ? props.value === v : props.pick === 'many' ? props.values.includes(v) : false)
  const click = (v: T) => {
    if (props.pick === 'one') props.onChange(props.value === v && props.clearable ? undefined : v)
    else if (props.pick === 'many') props.onChange(props.values.includes(v) ? props.values.filter((x) => x !== v) : [...props.values, v])
    else props.onPick(v)
  }
  // Arrows (and Home/End) move along the options that can be used; in a one-of group they pick as they go.
  const move = (e: KeyboardEvent) => {
    const all = [...(row.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const at = all.indexOf(document.activeElement as HTMLButtonElement)
    const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp'
    const to = fwd ? at + 1 : back ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : null
    if (to === null || !all.length) return
    e.preventDefault()
    const next = all[(to + all.length) % all.length]
    next.focus()
    if (one) click(next.dataset.value as T)
  }
  // In a one-of group only the picked one (or the first, with none picked) is in the tab order, as a radio group's.
  const current = one ? options.findIndex((o) => o.value === props.value && !o.disabled) : -1
  const first = options.findIndex((o) => !o.disabled)
  return (
    <div
      ref={row}
      className={[styles.row, className].filter(Boolean).join(' ')}
      data-cards={cards || undefined}
      role={one ? 'radiogroup' : 'group'}
      aria-label={label}
      onKeyDown={move}
    >
      {options.map((o, i) => {
        const lit = on(o.value)
        return (
          <button
            key={o.value}
            type="button"
            className={styles.option}
            data-value={o.value}
            data-card={cards || undefined}
            role={one ? 'radio' : undefined}
            aria-checked={one ? lit : undefined}
            aria-pressed={props.pick === 'many' ? lit : undefined}
            tabIndex={one ? (i === (current >= 0 ? current : first) ? 0 : -1) : undefined}
            disabled={o.disabled}
            title={o.title}
            style={o.swatch ? ({ '--swatch': o.swatch } as CSSProperties) : undefined}
            onClick={() => click(o.value)}
          >
            {cards && o.sample !== undefined && (
              <span className={styles.sample} aria-hidden>
                {o.sample}
              </span>
            )}
            <span className={styles.head}>
              {o.swatch && <span className={styles.swatch} aria-hidden />}
              {o.label}
              {o.count !== undefined && <span className={styles.count}>{o.count}</span>}
            </span>
            {cards && o.line !== undefined && <span className={styles.line}>{o.line}</span>}
          </button>
        )
      })}
    </div>
  )
}
