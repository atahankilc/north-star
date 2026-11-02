// The prompt's list (D-222): heads and rows (PromptRow), what's picked given from outside (usePromptNav), kept in view
// as the keys move it (only the list scrolls, never the page). A press on it never takes focus from the `>` line. The
// menus' panel (PromptPanel) is the `>` line over this; the finder and the guide hold it in their own shells.
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { PromptHead, PromptRow } from '../primitives/PromptRow'
import { isHeading, pickable, type How, type PromptEntry, type PromptItem } from '../foundation/promptModel'
import styles from './PromptList.module.css'

type Props = {
  entries: PromptEntry[]
  picked: string | null
  // What's typed: lit in the labels.
  q: string
  hitTone?: 'narrow' | 'found'
  // `listbox` for a Select's options, else a menu.
  role?: 'listbox' | 'menu'
  label: string
  id?: string
  // Said when there's nothing to show (nothing typed: `empty`; typed: `no match`).
  empty?: ReactNode
  onPick: (item: PromptItem, how: How) => void
  onPoint: (key: string) => void
  // Each row's id, for the `>` line's aria-activedescendant.
  idOf: (key: string) => string
  // A double-click on a row.
  onConfirm?: (item: PromptItem) => void
  className?: string
}

export function PromptList({ entries, picked, q, hitTone, role = 'menu', label, id, empty, onPick, onPoint, idOf, onConfirm, className }: Props) {
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    // What scrolls: the list, or what holds it (the finder sizes its own box round it).
    let list: HTMLElement | null = box.current
    while (list && list.scrollHeight <= list.clientHeight && list.parentElement) list = list.parentElement.closest<HTMLElement>('[data-scrolls]') ?? null
    const row = picked ? box.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(picked)}"]`) : null
    if (!list || !row) return
    const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
    if (top < list.scrollTop) list.scrollTop = top
    else if (top + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + row.offsetHeight - list.clientHeight
  }, [picked])
  const rowRole = role === 'listbox' ? 'option' : 'menuitem'
  return (
    <div
      ref={box}
      id={id}
      className={[styles.list, className].filter(Boolean).join(' ')}
      role={role}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
    >
      {pickable(entries).length === 0 && <p className={styles.empty}>{q ? 'no match' : (empty ?? 'Nothing here yet')}</p>}
      {entries.map((e) =>
        isHeading(e) ? (
          <PromptHead key={e.key} head={e} />
        ) : (
          <PromptRow key={e.key} id={idOf(e.key)} item={e} picked={e.key === picked} q={q} hitTone={hitTone} role={rowRole} onPick={onPick} onPoint={onPoint} onConfirm={onConfirm} />
        ),
      )}
    </div>
  )
}
