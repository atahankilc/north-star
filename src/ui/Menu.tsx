// A dropdown menu (D-053): `[ show ▾ ]` opens a framed list. Checkbox items toggle and keep it open; action items run and
// close it. Arrow keys move, Home/End jump, Escape closes and returns focus, a click outside closes.
import { AnimatePresence } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Appear } from './Appear'
import styles from './Menu.module.css'

export type MenuEntry =
  | {
      key: string
      label: ReactNode
      onSelect: () => void
      // A checkbox item: shows [x] / [ ] and keeps the menu open.
      checked?: boolean
      // Colour of the check or the glyph.
      tone?: string
      // Shown faint on the right (a shortcut, a count).
      hint?: string
      // Shown before the label (an action's mark).
      glyph?: string
    }
  | { key: string; heading: string }

type Props = {
  // What the trigger says, e.g. "show" or "+".
  label: ReactNode
  // Faint text after the label, e.g. "5/5" or "any".
  summary?: ReactNode
  items: MenuEntry[]
  // Open above the trigger (for the bottom toolbar).
  up?: boolean
  // Right-align the panel with the trigger.
  alignEnd?: boolean
  // A filled, prominent trigger (the create button).
  primary?: boolean
  // A filter that's narrowing what you see: the trigger stays lit.
  active?: boolean
  ariaLabel: string
  empty?: string
}

export function Menu({ label, summary, items, up, alignEnd, primary, active, ariaLabel, empty }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  // Focus the first item on open; close on a click outside.
  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[role^=menuitem]')?.focus())
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const all = [...(list.current?.querySelectorAll<HTMLElement>('[role^=menuitem]') ?? [])]
    const at = all.indexOf(document.activeElement as HTMLElement)
    const go = (i: number) => all[(i + all.length) % all.length]?.focus()
    // Keys stay in the menu: the board's own shortcuts (Delete, 1–9, ⌘Z) don't fire.
    e.stopPropagation()
    if (e.key === 'ArrowDown') (e.preventDefault(), go(at + 1))
    else if (e.key === 'ArrowUp') (e.preventDefault(), go(at - 1))
    else if (e.key === 'Home') (e.preventDefault(), go(0))
    else if (e.key === 'End') (e.preventDefault(), go(all.length - 1))
    else if (e.key === 'Escape') (e.preventDefault(), close())
    else if (e.key === 'Tab') close(false)
  }

  return (
    <div ref={root} className={styles.root} onKeyDown={open ? onKeyDown : undefined}>
      <button
        ref={trigger}
        className={primary ? styles.primary : styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        data-active={active || undefined}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) (e.preventDefault(), setOpen(true))
        }}
      >
        <span className={styles.label}>{label}</span>
        {summary !== undefined && <span className={styles.summary}>{summary}</span>}
        {!primary && (
          <span className={styles.caret} aria-hidden>
            ▾
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <Appear key="menu" className={styles.panel} data-up={up} data-end={alignEnd}>
            <div ref={list} id={id} role="menu" aria-label={ariaLabel}>
              {items.length === 0 && <p className={styles.empty}>{empty ?? 'Nothing here yet'}</p>}
              {items.map((item) =>
                'heading' in item ? (
                  <div key={item.key} className={styles.heading} role="presentation">
                    {item.heading}
                  </div>
                ) : (
                  <button
                    key={item.key}
                    className={styles.item}
                    role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                    aria-checked={item.checked}
                    tabIndex={-1}
                    style={item.tone ? { ['--tone' as string]: item.tone } : undefined}
                    onClick={() => {
                      item.onSelect()
                      if (item.checked === undefined) close()
                    }}
                  >
                    {item.checked !== undefined && (
                      <span className={styles.check} data-on={item.checked} aria-hidden>
                        {item.checked ? '[x]' : '[ ]'}
                      </span>
                    )}
                    {item.glyph && (
                      <span className={styles.glyph} aria-hidden>
                        {item.glyph}
                      </span>
                    )}
                    <span className={styles.itemLabel}>{item.label}</span>
                    {item.hint && <span className={styles.hint}>{item.hint}</span>}
                  </button>
                ),
              )}
            </div>
          </Appear>
        )}
      </AnimatePresence>
    </div>
  )
}
