// The prompt in place (D-222, D-299): the dropdowns' list (MenuPanel) laid in the page where it was asked for, not
// floating: a card panel's card picker, the agent's saved chats. A hairline frame on the page's black, as a dropdown's
// panel; `height` says how much of it shows before it scrolls (`panel`: a panel's share of the screen; `full`: all of it,
// its column scrolls). `ref` is the frame (a caller closing on a click outside reads it).
import type { Ref } from 'react'
import { MenuPanel, type MenuEntry } from './Menu'
import styles from './InPlaceMenu.module.css'

type Props = {
  items: MenuEntry[]
  ariaLabel: string
  prompt?: string
  noun?: string
  empty?: string
  foot?: string
  more?: (typed: string) => MenuEntry[]
  onClose: (refocus?: boolean) => void
  height?: 'panel' | 'full'
  className?: string
  ref?: Ref<HTMLDivElement>
}

export function InPlaceMenu({ height = 'panel', className, ref, ...panel }: Props) {
  return (
    <div ref={ref} className={[styles.frame, className].filter(Boolean).join(' ')} data-height={height}>
      <MenuPanel {...panel} />
    </div>
  )
}
