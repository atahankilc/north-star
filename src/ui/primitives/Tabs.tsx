// One row of options, one of them current (D-326; D-344's toggle cells): every option is a Button cell, the cells
// joined by a hairline seam, the current one lit as a pressed Button. `tabs` (a setup's ROWS COLS CELLS, a side view's
// decks) are as wide as their row, caps, a tablist to the keyboard; `segments` (the finder's here | everywhere, a Choice's
// P1 P2 P3) are as wide as their words, a radio group. A count after a label, faint. Arrows and Home/End move, and pick,
// as the focus moves. `tones` lights an option in its own colour; `onReclick` is a click on the current one (a Choice
// that clears); `edit` marks the options as a picker the preview lock disables (D-098); `disabled` for who can't edit.
// A wizard's Steps are Tabs too: `lead` before a label (its magenta `01`), `progress` marks the options before the
// current one as passed (a little brighter), `even` gives every tab the same width, and `keyboard={false}` keeps them
// out of Tab and leaves the arrows to a window that steps by its own keys.
// Tabs that don't fit stay one row and scroll sideways (never a second row): the picked one is kept in view, the wheel
// scrolls them while there's more that way, and the edge where more is hidden fades (`data-more`). Steps (`even`) never
// scroll; they cut their names with `…`.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Tabs.module.css'

export type TabOption<T extends string> = { value: T; label: ReactNode; lead?: ReactNode; count?: ReactNode; title?: string; tone?: string }

type Props<T extends string> = {
  options: TabOption<T>[]
  value: T | undefined
  onChange: (value: T) => void
  label: string
  look?: 'tabs' | 'segments'
  onReclick?: () => void
  edit?: boolean
  disabled?: boolean
  progress?: boolean
  even?: boolean
  keyboard?: boolean
  className?: string
}

export function Tabs<T extends string>({ options, value, onChange, label, look = 'tabs', onReclick, edit, disabled, progress, even, keyboard = true, className }: Props<T>) {
  const row = useRef<HTMLDivElement>(null)
  const tabs = look === 'tabs'
  // None current (a group beside another sharing one choice: a deck's tabs while MINE is open, a Choice with nothing
  // picked): the first is the one the keyboard reaches, and the arrows start from it.
  const current = options.findIndex((o) => o.value === value)
  const more = useMore(row, tabs && !even, value)
  const move = (e: KeyboardEvent) => {
    if (!keyboard) return
    const at = current < 0 ? (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? 0 : -1) : current
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : null
    if (to === null) return
    e.preventDefault()
    const next = options[(to + options.length) % options.length]
    onChange(next.value)
    requestAnimationFrame(() => row.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus())
  }
  return (
    <div ref={row} className={[styles.row, className].filter(Boolean).join(' ')} data-look={look} data-even={even || undefined} data-more={more} role={tabs ? 'tablist' : 'radiogroup'} aria-label={label} onKeyDown={move}>
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
            tabIndex={keyboard && (on || (current < 0 && i === 0)) ? 0 : -1}
            data-value={o.value}
            data-edit={edit || undefined}
            data-done={(progress && current >= 0 && i < current) || undefined}
            disabled={disabled}
            title={o.title}
            style={o.tone ? ({ '--button-on': o.tone } as React.CSSProperties) : undefined}
            onClick={() => (on ? onReclick?.() : onChange(o.value))}
          >
            {o.lead !== undefined && <span className={styles.lead}>{o.lead}</span>}
            <span className={styles.text}>{o.label}</span>
            {o.count !== undefined && <span className={styles.count}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Which ends of a scrolling row hide more (`start`, `end`, both, or none), kept as it scrolls and resizes; the picked
// option scrolled into view when the pick changes; a vertical wheel scrolls the row while it can go that way, else the
// page scrolls as usual.
function useMore(row: React.RefObject<HTMLDivElement | null>, on: boolean, picked: string | undefined) {
  const [more, setMore] = useState<string | undefined>()
  useEffect(() => {
    const el = row.current
    if (!on || !el) return
    const read = () => {
      const max = el.scrollWidth - el.clientWidth
      // tokens-ok: one px of rounding, not a size
      const ends = [el.scrollLeft > 1 && 'start', el.scrollLeft < max - 1 && 'end'].filter(Boolean).join(' ')
      setMore(ends || undefined)
    }
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0 || (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    read()
    const sizes = new ResizeObserver(read)
    sizes.observe(el)
    for (const child of el.children) sizes.observe(child)
    el.addEventListener('scroll', read, { passive: true })
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      sizes.disconnect()
      el.removeEventListener('scroll', read)
      el.removeEventListener('wheel', wheel)
    }
  }, [row, on])
  useEffect(() => {
    const el = row.current
    if (!on || !el || picked === undefined) return
    const opt = el.querySelector<HTMLElement>(`[data-value="${CSS.escape(picked)}"]`)
    if (!opt) return
    const left = opt.offsetLeft - el.offsetLeft
    const right = left + opt.offsetWidth
    if (left < el.scrollLeft) el.scrollLeft = left
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth
  }, [row, on, picked])
  return more
}
