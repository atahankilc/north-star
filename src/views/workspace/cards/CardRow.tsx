// A card or task as one line (D-358): the small row wherever a list names cards or tasks (a card's tasks in its
// panel, the card a task is for, the suggested order, a competitor's features and a folded card's members inside it).
// A whole-row button: its card's colour as a 2 px edge on its left (`tone`), something before the title (`lead`: a
// tick, a number, the type), the title cut with `…` (faint when it's a placeholder), hints after it that are never cut
// (`end`), `extra` over it (marks). Its base is in `:where()`, so a caller's class sets its geometry (a plane's rows at
// the world's size, the order's grid); `size="world"` takes the world's small type.
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import styles from './CardRow.module.css'

type Props = {
  title: ReactNode
  tone?: string
  lead?: ReactNode
  end?: ReactNode
  extra?: ReactNode
  empty?: boolean
  done?: boolean
  selected?: boolean
  // A competitor's feature: a small card of its own, washed.
  wash?: boolean
  size?: 'screen' | 'world'
  hint?: string
  label?: string
  className?: string
  titleClass?: string
  style?: CSSProperties
  tabIndex?: number
  onClick?: (e: MouseEvent) => void
} & Record<`data-${string}`, string | boolean | undefined>

export function CardRow({ title, tone, lead, end, extra, empty, done, selected, wash, size = 'screen', hint, label, className, titleClass, style, tabIndex, onClick, ...data }: Props) {
  return (
    <button /* kit-ok: the one card row (D-358): a whole line that opens or picks its card or task */
      {...data}
      type="button"
      className={[styles.row, className].filter(Boolean).join(' ')}
      style={tone ? ({ ['--tone' as string]: tone, ...style } as CSSProperties) : style}
      data-tone={tone ? true : undefined}
      data-size={size}
      data-wash={wash || undefined}
      data-done={done || undefined}
      data-selected={selected || undefined}
      title={hint}
      aria-label={label}
      tabIndex={tabIndex}
      onClick={onClick}
    >
      {lead}
      <span className={[styles.title, titleClass].filter(Boolean).join(' ')} data-empty={empty || undefined}>
        {title}
      </span>
      {end}
      {extra}
    </button>
  )
}
