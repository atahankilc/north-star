// The small inline token (D-326, the kit; docs/foundation-audit-2026-10-31.md §2: `.chip` was drawn five ways).
// - `tag` (the default): a `#tag` on a card's or task's panel, framed on the chip shade (CardPanel's).
// - `pill`: a value said in colour, no frame: a priority (`P1` magenta), a status (Kanban's `.priority`).
// - `kind`: a caps label framed in its colour: what something is (a link's kind, a piece's kind).
// `tone` colours it (a card type's from cardTone.ts, an accent); `onRemove` adds a `×` shown on hover or focus;
// `onClick` makes the label a button. A `×` and a click can go together (two buttons side by side, never nested).
import type { CSSProperties, ReactNode } from 'react'
import styles from './Chip.module.css'

export type ChipVariant = 'tag' | 'pill' | 'kind'

type Props = {
  children: ReactNode
  variant?: ChipVariant
  tone?: string
  title?: string
  onClick?: () => void
  onRemove?: () => void
  // What the `×` says to a screen reader and on hover.
  removeLabel?: string
}

export function Chip({ children, variant = 'tag', tone, title, onClick, onRemove, removeLabel = 'remove' }: Props) {
  const style = tone ? ({ '--chip-tone': tone } as CSSProperties) : undefined
  return (
    <span className={styles.chip} data-variant={variant} data-toned={tone ? '' : undefined} style={style} title={onClick ? undefined : title}>
      {onClick ? (
        <button type="button" className={styles.label} title={title} onClick={onClick}>
          {children}
        </button>
      ) : (
        <span className={styles.text}>{children}</span>
      )}
      {onRemove && (
        <button type="button" className={styles.remove} aria-label={removeLabel} title={removeLabel} onClick={onRemove}>
          ×
        </button>
      )}
    </span>
  )
}
