// A one-of dropdown in our own look, in place of the browser's <select> (D-093): `inspired-by ▾`, the one dropdown
// trigger (D-344), opens the prompt (PromptPanel, D-222) in a Popover right under it: the value now cyan with `✓`, the
// first lit row the value now. A long list (past SELECT_FIND_PAST options) has the `>` line that narrows it as you
// type; a short one jumps to an option by its first letter. Arrows, Home/End and Enter pick; Escape closes only the list
// and gives focus back; a press outside closes it. The trigger carries `data-edit` so the preview lock (previewLock.ts)
// disables it like a native select.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { SELECT_FIND_PAST } from '../foundation/feel'
import type { PromptEntry } from '../foundation/promptModel'
import { Popover } from './Popover'
import { PromptPanel } from './PromptPanel'
import styles from './Select.module.css'

export type SelectOption<T extends string> = { value: T; label: ReactNode }

type Props<T extends string> = {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  // The trigger's look in its context (a table cell, an underlined field).
  className?: string
  disabled?: boolean
}

export function Select<T extends string>({ value, options, onChange, ariaLabel, className, disabled }: Props<T>) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const current = options.find((o) => o.value === value)
  const change = useRef(onChange)
  change.current = onChange

  const items = useMemo<PromptEntry[]>(
    () => options.map((o) => ({ key: o.value, label: o.label, current: o.value === value, onSelect: () => o.value !== value && change.current(o.value) })),
    [options, value],
  )

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  // Disabled from outside (the preview lock) while open: close.
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={[styles.trigger, className].filter(Boolean).join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        data-edit
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) (e.preventDefault(), setOpen(true))
        }}
      >
        <span className={styles.value}>{current?.label ?? value}</span>
        <span className={styles.caret} aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <Popover anchor={trigger} onClose={close}>
          <PromptPanel
            id={id}
            role="listbox"
            items={items}
            ariaLabel={ariaLabel}
            start={value}
            line={options.length > SELECT_FIND_PAST}
            onClose={close}
          />
        </Popover>
      )}
    </>
  )
}
