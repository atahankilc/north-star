// A piece off the canvas (D-263, D-266, D-326's kit): the canvas's pieces drawn as a card wherever a page lists things
// as pieces (the workspaces page, the onboarding's ways in). Graphite (`--piece`), a 2 px band on top in `band`, its name
// cut into the top edge in mono caps (`name`, a Label), Marks on hover and when `picked` (D-265). `onOpen` makes the
// whole of it the target (an invisible layer under its contents, so its own buttons still take their clicks); `onMenu`
// gets a right-click's point. `as="button"`: the card is itself one button (no buttons inside it then).
import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { Label } from '../primitives/Label'
import { Marks, type Tier } from '../primitives/Marks'
import styles from './PieceCard.module.css'

type Props = {
  band: string
  name?: ReactNode
  tier?: Tier
  picked?: boolean
  onOpen?: () => void
  onMenu?: (at: [number, number]) => void
  as?: 'article' | 'button'
  className?: string
  style?: CSSProperties
  children: ReactNode
} & Record<`data-${string}`, string | true | undefined>

export function PieceCard({ band, name, tier = 'm', picked, onOpen, onMenu, as = 'article', className, style, children, ...data }: Props) {
  const [hover, setHover] = useState(false)
  const common = {
    ...data,
    className: [styles.piece, className].filter(Boolean).join(' '),
    style: { '--band': band, ...style } as CSSProperties,
    'data-open': onOpen ? true : undefined,
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => setHover(false),
    onContextMenu: onMenu ? (e: MouseEvent) => (e.preventDefault(), onMenu([e.clientX, e.clientY])) : undefined,
  }
  const inside = (
    <>
      {name !== undefined && name !== null && <Label className={styles.name}>{name}</Label>}
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
      {/* An invisible layer over the whole piece, under what's on it: the piece's own target. */}
      {onOpen && <button type="button" className={styles.open} onClick={onOpen} aria-label="open" tabIndex={-1} />}
      {inside}
    </article>
  )
}
