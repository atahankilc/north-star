// A one-of dropdown in our own look, in place of the browser's <select> (D-093): `inspired-by ▾` opens a compact framed list
// right under it, the same list as the tag picker's suggestions (TagInput), current value bright. The list is fixed to the viewport in a portal, so a scrolling panel or table
// can't clip it, and it follows the trigger when something scrolls; inside a modal <dialog> it stays in the dialog (the top
// layer would hide it otherwise). Arrows, Home/End and Enter pick; Escape closes only the list and returns focus; a click
// outside closes. The trigger carries `data-edit` so the preview lock
// (previewLock.ts) disables it like a native select.
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { floatFrom, type Floating } from './floating'
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

// One option's height and the list's padding, to tell whether the list fits below its trigger (Select.module.css).
const ROW = 25
const PAD = 10
const MAX = 320

export function Select<T extends string>({ value, options, onChange, ariaLabel, className, disabled }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<Floating['style'] | null>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()
  const current = options.find((o) => o.value === value)

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  const place = () => {
    if (!trigger.current) return
    const f = floatFrom(trigger.current, { height: Math.min(options.length * ROW + PAD, MAX) })
    setHost(f.host)
    setAt(f.style)
  }

  // Focus the current option on open; close on a click outside, a scroll or a resize (the trigger moved).
  useLayoutEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const items = [...(list.current?.querySelectorAll<HTMLElement>('[role=option]') ?? [])]
      ;(items.find((i) => i.getAttribute('aria-selected') === 'true') ?? items[0])?.focus()
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!trigger.current?.contains(t) && !list.current?.contains(t)) close(false)
    }
    // The page or a panel scrolled, or the window resized: the list follows its trigger.
    const onMove = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) place()
    }
    // Escape closes only the list, wherever focus is: not the side panel or the settings dialog around it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      close()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('keydown', onKey, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Disabled from outside (the preview lock) while open: close.
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const all = [...(list.current?.querySelectorAll<HTMLElement>('[role=option]') ?? [])]
    const i = all.indexOf(document.activeElement as HTMLElement)
    const go = (n: number) => all[(n + all.length) % all.length]?.focus()
    // Keys stay here: the board's shortcuts and the dialog's Escape don't fire.
    e.stopPropagation()
    if (e.key === 'ArrowDown') (e.preventDefault(), go(i + 1))
    else if (e.key === 'ArrowUp') (e.preventDefault(), go(i - 1))
    else if (e.key === 'Home') (e.preventDefault(), go(0))
    else if (e.key === 'End') (e.preventDefault(), go(all.length - 1))
    else if (e.key === 'Tab') close(false)
  }

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
        onClick={() => {
          if (!open) place()
          setOpen((o) => !o)
        }}
        onKeyDown={(e) => {
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
            e.preventDefault()
            place()
            setOpen(true)
          }
        }}
      >
        <span className={styles.value}>{current?.label ?? value}</span>
        <span className={styles.caret} aria-hidden>
          ▾
        </span>
      </button>
      {host &&
        open &&
        at &&
        createPortal(
          <div ref={list} id={id} className={styles.list} style={at} role="listbox" aria-label={ariaLabel} onKeyDown={onKeyDown}>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                className={styles.option}
                role="option"
                aria-selected={o.value === value}
                tabIndex={-1}
                onMouseEnter={(e) => e.currentTarget.focus()}
                onClick={() => {
                  if (o.value !== value) onChange(o.value)
                  close()
                }}
              >
                {o.label}
              </button>
            ))}
          </div>,
          host,
        )}
    </>
  )
}
