// The prompt in place (D-222, D-299): the prompt (PromptPanel) laid in the page where it was asked for, not floating:
// a card panel's card picker, the agent's saved chats. `height` says how much of it shows before it scrolls (`panel`: a
// panel's share of the screen; `full`: all of it, its column scrolls). `ref` is its box (a caller closing on a click
// outside reads it).
import type { Ref } from 'react'
import type { PromptEntry } from '../foundation/promptModel'
import { PromptPanel } from './PromptPanel'
import styles from './InPlaceMenu.module.css'

type Props = {
  items: PromptEntry[]
  ariaLabel: string
  prompt?: string
  empty?: string
  more?: (typed: string) => PromptEntry[]
  onClose: (refocus?: boolean) => void
  height?: 'panel' | 'full'
  className?: string
  ref?: Ref<HTMLDivElement>
}

export function InPlaceMenu({ height = 'panel', className, ref, ...panel }: Props) {
  return (
    <div ref={ref} className={[styles.frame, className].filter(Boolean).join(' ')} data-height={height}>
      <PromptPanel {...panel} />
    </div>
  )
}
