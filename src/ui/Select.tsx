// A one-of dropdown in our own look, in place of the browser's <select> (D-093): `inspired-by ▾` opens a compact list
// right under it in the menus' prompt look (D-222): `›` where Enter goes, a cyan `•` on the current value; a long list
// (more than LONG options) gets the `>` line that narrows it as you type, a short one jumps to an option by its first letter. The list is fixed to the viewport in a portal, so a scrolling panel or table
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

// One option's height, the list's padding and the `>` line's, to tell whether the list fits below its trigger (Select.module.css).
const ROW = 25
const PAD = 10
const LINE = 38
const MAX = 320
// Past this many options the list has a `>` line.
const LONG = 7

const text = (o: SelectOption<string>): string => (typeof o.label === 'string' || typeof o.label === 'number' ? String(o.label) : o.value)

export function Select<T extends string>({ value, options, onChange, ariaLabel, className, disabled }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<Floating['style'] | null>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const id = useId()
  const current = options.find((o) => o.value === value)
  const long = options.length > LONG
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => text(o).toLowerCase().includes(q)) : options

  const close = (refocus = true) => {
    setOpen(false)
    setQuery('')
    if (refocus) trigger.current?.focus()
  }

  const place = () => {
    if (!trigger.current) return
    const f = floatFrom(trigger.current, { height: Math.min(options.length * ROW + PAD + (long ? LINE : 0), MAX) })
    setHost(f.host)
    setAt(f.style)
  }

  // Focus the `>` line or the current option on open; close on a click outside, a scroll or a resize (the trigger moved).
  useLayoutEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      if (field.current) return field.current.focus()
      const items = [...(list.current?.querySelectorAll<HTMLElement>('[role=option]') ?? [])]
      ;(items.find((i) => i.getAttribute('aria-selected') === 'true') ?? items[0])?.focus()
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    // Heard on the way down: what's under it may stop the press from bubbling.
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
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
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
    const inField = document.activeElement === field.current
    // Keys stay here: the board's shortcuts and the dialog's Escape don't fire.
    e.stopPropagation()
    if (e.key === 'ArrowUp' && i === 0 && field.current) (e.preventDefault(), field.current.focus())
    else if (e.key === 'ArrowDown') (e.preventDefault(), go(inField ? 0 : i + 1))
    else if (e.key === 'ArrowUp') (e.preventDefault(), go(i - 1))
    else if (e.key === 'Enter' && inField) (e.preventDefault(), all[0]?.click())
    else if (e.key === 'Home' && !inField) (e.preventDefault(), go(0))
    else if (e.key === 'End' && !inField) (e.preventDefault(), go(all.length - 1))
    else if (e.key === 'Tab') close(false)
    else if (!inField && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      // A letter: into the `>` line, or on a short list to the next option starting with it.
      if (field.current) return field.current.focus()
      const k = e.key.toLowerCase()
      const from = shown.findIndex((o, n) => n > i && text(o).toLowerCase().startsWith(k))
      const at = from >= 0 ? from : shown.findIndex((o) => text(o).toLowerCase().startsWith(k))
      if (at >= 0) all[at]?.focus()
    }
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
            {long && (
              <label className={styles.line}>
                <span className={styles.sign} aria-hidden>
                  &gt;
                </span>
                <input
                  ref={field}
                  className={styles.field}
                  type="text"
                  value={query}
                  placeholder="type to find…"
                  aria-label={`${ariaLabel}: type to find`}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            )}
            {shown.length === 0 && <p className={styles.none}>no match</p>}
            {shown.map((o, n) => (
              <button
                key={o.value}
                type="button"
                className={styles.option}
                role="option"
                aria-selected={o.value === value}
                data-first={(q && n === 0) || undefined}
                tabIndex={-1}
                onMouseEnter={(e) => e.currentTarget.focus()}
                onClick={() => {
                  if (o.value !== value) onChange(o.value)
                  close()
                }}
              >
                <span className={styles.cursor} aria-hidden />
                <span className={styles.optLabel}>{o.label}</span>
              </button>
            ))}
          </div>,
          host,
        )}
    </>
  )
}
