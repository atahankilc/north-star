// The right-click menu (D-193): on a plane, a card or a piece of text, where the pointer is; a framed mono list like the
// app's other menus. Only `comment` for now. A click outside, Escape, or the wheel closes it.
import { useEffect, useRef } from 'react'
import styles from './ContextMenu.module.css'

export type MenuItem = { label: string; hint?: string; onSelect: () => void }

export function ContextMenu({ at, items, onClose }: { at: [number, number]; items: MenuItem[]; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    root.current?.querySelector('button')?.focus()
    const away = (e: Event) => !root.current?.contains(e.target as Node) && onClose()
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('pointerdown', away, true)
    window.addEventListener('wheel', onClose, true)
    window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointerdown', away, true)
      window.removeEventListener('wheel', onClose, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [onClose])
  return (
    <div
      ref={root}
      className={styles.menu}
      style={{ left: at[0], top: at[1] }}
      role="menu"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => (e.preventDefault(), e.stopPropagation())}
    >
      {items.map((it) => (
        <button
          key={it.label}
          role="menuitem"
          className={styles.item}
          onClick={() => {
            onClose()
            it.onSelect()
          }}
        >
          <span>{it.label}</span>
          {it.hint && <span className={styles.hint}>{it.hint}</span>}
        </button>
      ))}
    </div>
  )
}
