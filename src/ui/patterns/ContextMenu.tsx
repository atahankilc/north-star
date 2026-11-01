// The right-click menu (D-193): on a plane, a card or a piece of text, where the pointer is; the dropdowns' prompt look
// (D-222), its `>` line saying what it's on. Only `comment` for now. A click outside, Escape, or the wheel outside it closes it.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { Appear } from '../primitives/Appear'
import { MenuPanel, type MenuEntry } from './Menu'
import styles from './ContextMenu.module.css'

// `prompt`, `foot`, `noun`, `empty`: for a list that isn't about what's under the pointer (D-281: the cards to bring).
// `more`: items made from what's typed (the canvases' `new canvas "…"`, D-302).
type Props = { at: [number, number]; items: MenuEntry[]; what: string; onClose: () => void; prompt?: string; foot?: string; noun?: string; empty?: string; wide?: boolean; more?: (typed: string) => MenuEntry[]; 'data-learn'?: string }

// `data-learn` names it for the onboarding's lessons (D-315): the right-click menu, the move-to prompt.
export function ContextMenu({ at, items, what, onClose, prompt, foot, noun, empty, wide, more, 'data-learn': learnAs }: Props) {
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    const away = (e: Event) => !root.current?.contains(e.target as Node) && onClose()
    // Escape closes only the menu, before the canvas hears it (it would leave focus).
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as Element | null)?.closest?.('[data-coach]')) return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('pointerdown', away, true)
    window.addEventListener('wheel', away, true)
    window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointerdown', away, true)
      window.removeEventListener('wheel', away, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [onClose])
  // Kept inside its space: moved left or up when it would run past the right or bottom edge.
  useLayoutEffect(() => {
    const el = root.current
    const box = el?.offsetParent?.getBoundingClientRect()
    if (!el || !box) return
    el.style.left = `${Math.max(8, Math.min(at[0], box.width - el.offsetWidth - 8))}px`
    el.style.top = `${Math.max(8, Math.min(at[1], box.height - el.offsetHeight - 8))}px`
  }, [at])
  return (
    <Appear
      elRef={root}
      className={styles.menu}
      data-wide={wide || undefined}
      data-learn={learnAs}
      style={{ left: at[0], top: at[1] }}
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      onContextMenu={(e: React.MouseEvent) => (e.preventDefault(), e.stopPropagation())}
    >
      <MenuPanel items={items} ariaLabel={prompt ? what : `On this ${what}`} prompt={prompt ?? `do with this ${what}…`} foot={foot} noun={noun} empty={empty} onClose={onClose} more={more} />
    </Appear>
  )
}
