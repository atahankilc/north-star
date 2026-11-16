// A card on a page that lists things (the workspaces page, the onboarding's ways in; D-326's kit). Round with a line,
// no shadow and no band (D-387, D-390: it was the canvas's graphite piece until then, D-263). Its `name`, when it has
// one, is a mono caps Label on top inside it, in `tone` (what kind of card it is: `new` magenta, `join` cyan). Marks on
// hover and when `picked` (D-265), taking its round corner. `onOpen` makes the whole of it the target (an invisible
// layer under its contents, so its own buttons still take their clicks); `onMenu` gets a right-click's point.
// `as="button"`: the card is itself one button (no buttons inside it then).
import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { Label } from '../primitives/Label'
import { Marks, type Tier } from '../primitives/Marks'
import styles from './PieceCard.module.css'

type Props = {
  name?: ReactNode
  // The name's colour (a CSS colour); none: the label's own dim ink.
  tone?: string
  tier?: Tier
  picked?: boolean
  onOpen?: () => void
  onMenu?: (at: [number, number]) => void
  as?: 'article' | 'button'
  className?: string
  style?: CSSProperties
  children: ReactNode
} & Record<`data-${string}`, string | true | undefined>

export function PieceCard({ name, tone, tier = 'm', picked, onOpen, onMenu, as = 'article', className, style, children, ...data }: Props) {
  const [hover, setHover] = useState(false)
  const common = {
    ...data,
    className: [styles.piece, className].filter(Boolean).join(' '),
    style,
    'data-open': onOpen ? true : undefined,
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => setHover(false),
    onContextMenu: onMenu ? (e: MouseEvent) => (e.preventDefault(), onMenu([e.clientX, e.clientY])) : undefined,
  }
  const inside = (
    <>
      {name !== undefined && name !== null && (
        <Label className={styles.name} style={tone ? { color: tone } : undefined}>
          {name}
        </Label>
      )}
      {children}
      {onOpen && <Marks tier={tier} hover={hover} selected={picked} />}
    </>
  )
  if (as === 'button')
    return (
      <button type="button" {...common} onClick={onOpen}>
        {inside}
      </button>
    )
  return (
    <article {...common}>
      {/* An invisible layer over the whole card, under what's on it: the card's own target. */}
      {onOpen && <button type="button" className={styles.open} onClick={onOpen} aria-label="open" tabIndex={-1} />}
      {inside}
    </article>
  )
}
