// The small inline token (D-326, the kit; docs/foundation-audit-2026-10-31.md §2: `.chip` was drawn five ways).
// - `tag` (the default): a `#tag` on a card's or task's panel, framed on the chip shade (CardPanel's).
// - `pill`: a value said in colour, no frame: a priority (`P1` magenta), a status (Kanban's `.priority`).
// - `kind`: a caps label framed in its colour: what something is (a link's kind, a piece's kind).
// `tone` colours it (a card type's from cardTone.ts, an accent); `onRemove` adds a `×` shown on hover or focus;
// `onClick` makes the label a button. A `×` and a click can go together (two buttons side by side, never nested).
// `scale="world"` sizes it in the world's tokens, so it zooms with the plane it sits on (a card face's #tags, a link's
// kind); `voice="user"` keeps a person's own words as typed, never caps (D-266); `extra` is drawn inside the chip after
// its text, unclipped (its selection marks, its thread's chip). Other span attributes (a class for placement, data-*,
// pointer handlers) go on the chip itself.
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import styles from './Chip.module.css'

export type ChipVariant = 'tag' | 'pill' | 'kind'

type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'onClick' | 'title'> & {
  children: ReactNode
  variant?: ChipVariant
  tone?: string
  title?: string
  onClick?: () => void
  onRemove?: () => void
  // What the `×` says to a screen reader and on hover.
  removeLabel?: string
  scale?: 'screen' | 'world'
  voice?: 'system' | 'user'
  extra?: ReactNode
}

export function Chip({ children, variant = 'tag', tone, title, onClick, onRemove, removeLabel = 'remove', scale, voice, extra, className, style, ...rest }: Props) {
  const toned = tone ? ({ '--chip-tone': tone, ...style } as CSSProperties) : style
  return (
    <span
      {...rest}
      className={className ? `${styles.chip} ${className}` : styles.chip}
      data-variant={variant}
      data-toned={tone ? '' : undefined}
      data-scale={scale === 'world' ? 'world' : undefined}
      data-voice={voice === 'user' ? 'user' : undefined}
      style={toned}
      title={onClick ? undefined : title}
    >
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
      {extra}
    </span>
  )
}
