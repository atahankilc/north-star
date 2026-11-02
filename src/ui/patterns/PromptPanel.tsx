// The prompt (D-222): a `>` line over a list. Typing narrows it (matches lit, a letter puts its item first), the keys
// move what's picked while focus stays in the line, Enter picks it (the first row until you move), a tick row keeps it
// open, anything else runs and closes it. Nothing under it: no count, no keys (D-344; onboarding teaches them). Its look
// is a console's (D-347): no box, a hugging shade, faint L's on its corners, cyan while the keyboard is in it.
// The menus are built on it: Menu (a trigger's), ContextMenu (at the pointer), InPlaceMenu (laid in the page).
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { PromptField } from '../primitives/PromptField'
import { PromptList } from './PromptList'
import { narrow, type How, type PromptEntry, type PromptItem } from '../foundation/promptModel'
import { usePromptNav } from '../foundation/usePromptNav'
import styles from './PromptPanel.module.css'

type Props = {
  items: PromptEntry[]
  ariaLabel: string
  // Said when there's nothing to pick.
  empty?: ReactNode
  // What the `>` line says before anything is typed.
  prompt?: string
  // Closes it; `refocus`: give focus back to what opened it.
  onClose: (refocus?: boolean) => void
  // The list's id (a trigger's aria-controls).
  id?: string
  // Items made from what's typed, after what it finds (the card picker's `new idea "…"`).
  more?: (typed: string) => PromptEntry[]
  // `listbox` for a Select's options.
  role?: 'listbox' | 'menu'
  // The row picked at first (a Select's value), else the first.
  start?: string
  hitTone?: 'narrow' | 'found'
  // On the `>` line's right (a scope, a switch).
  tools?: ReactNode
  // No `>` line (a short Select's list): the panel holds the keys, a letter jumps to a row.
  line?: boolean
  className?: string
}

export function PromptPanel({ items, ariaLabel, empty, prompt = 'type to find…', onClose, id, more, role, start, hitTone, tools, line: wanted = true, className }: Props) {
  const [query, setQuery] = useState('')
  const own = useId()
  const listId = id ?? own
  const field = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const shown = useMemo(() => narrow(items, query, more), [items, query, more])
  // The `>` line stays while what's typed can make something.
  const line = wanted && (items.length > 0 || !!more)

  const pick = (item: PromptItem, how: How) => {
    const kept = item.onSelect(how) === 'keep'
    if (item.checked === undefined && !kept) onClose()
  }
  const nav = usePromptNav(shown, { onPick: pick, onClose, start, letters: !line })
  const idOf = (key: string) => `${listId}-${key}`

  useEffect(() => {
    const raf = requestAnimationFrame(() => (field.current ?? root.current)?.focus())
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={root}
      className={[styles.panel, className].filter(Boolean).join(' ')}
      tabIndex={line ? undefined : -1}
      aria-activedescendant={!line && nav.picked ? idOf(nav.picked) : undefined}
      // Keys stay in it: the canvas's own shortcuts (Delete, 0, ⌘Z) don't fire.
      onKeyDown={(e) => {
        e.stopPropagation()
        if (!line) nav.onKeyDown(e)
      }}
    >
      {line && (
        <PromptField
          ref={field}
          framed
          className={styles.line}
          value={query}
          onChange={(v) => (setQuery(v), nav.setPicked(null))}
          onSubmit={() => {}}
          onKeyDown={nav.onKeyDown}
          label={`${ariaLabel}: type to find`}
          placeholder={prompt}
          controls={listId}
          active={nav.picked ? idOf(nav.picked) : undefined}
        >
          {tools && <span className={styles.tools}>{tools}</span>}
        </PromptField>
      )}
      <PromptList
        id={listId}
        entries={shown}
        picked={nav.picked}
        q={query.trim()}
        hitTone={hitTone}
        role={role}
        label={ariaLabel}
        empty={empty}
        onPick={pick}
        onPoint={nav.setPicked}
        idOf={idOf}
      />
    </div>
  )
}
