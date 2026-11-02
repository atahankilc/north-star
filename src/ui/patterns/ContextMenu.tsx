// The right-click menu (D-193, D-237): the prompt (PromptPanel, D-222) where the pointer is, its `>` line saying what
// it's on, kept inside its space (placeAt). A press outside, the wheel outside or Escape closes it.
import { useLayoutEffect, useRef } from 'react'
import { Appear } from '../primitives/Appear'
import { placeAt } from '../foundation/floating'
import { useDismiss } from '../foundation/useDismiss'
import type { PromptEntry } from '../foundation/promptModel'
import { PromptPanel } from './PromptPanel'
import styles from './ContextMenu.module.css'

// `prompt`, `empty`: for a list that isn't about what's under the pointer (D-281: the cards to bring).
// `more`: items made from what's typed (the canvases' `new canvas "…"`, D-302).
type Props = { at: [number, number]; items: PromptEntry[]; what: string; onClose: () => void; prompt?: string; empty?: string; wide?: boolean; more?: (typed: string) => PromptEntry[]; 'data-learn'?: string }

// `data-learn` names it for the onboarding's lessons (D-315): the right-click menu, the move-to prompt.
export function ContextMenu({ at, items, what, onClose, prompt, empty, wide, more, 'data-learn': learnAs }: Props) {
  const root = useRef<HTMLElement>(null)
  useDismiss(root, onClose, { wheel: true, escape: true })
  useLayoutEffect(() => void (root.current && placeAt(root.current, at)), [at])
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
      <PromptPanel items={items} ariaLabel={prompt ? what : `On this ${what}`} prompt={prompt ?? `do with this ${what}…`} empty={empty} onClose={onClose} more={more} />
    </Appear>
  )
}
