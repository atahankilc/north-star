// A card on a deck (D-252, D-268, D-358): a sheet as a task's, on the card face tinted in its type (D-294). Its type in
// that colour and its priority on top, its title (Inter, up to three lines), then how sure we are (`◆ high`, `! broken`
// magenta) and the values it has other than the columns' own.
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Card } from '../../../data/cards'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { cardName } from '../../../model/cardName'
import { CardFace } from './CardFace'
import { PriorityChip } from './PriorityChip'
import styles from './Sheet.module.css'

export type Sure = 'high' | 'medium' | 'low' | 'broken'

type Props = {
  card: Card
  // The columns' field, and its rows' (D-269): left off the sheet, the board says them.
  field: string
  rowField?: string
  sure?: Sure
  finished: boolean
  selected: boolean
  live: boolean
  lifted?: boolean
  className?: string
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void
  onClick?: () => void
}

export function CardSheet({ card, field, rowField, sure, finished, selected, live, lifted, className, onPointerDown, onClick }: Props) {
  const shown = (f: string) => f !== field && f !== rowField
  const rest = [
    shown('status') && card.type === 'feature' ? card.status : undefined,
    shown('status') && card.type !== 'feature' ? card.validation : undefined,
    shown('impact') && card.impact ? `impact ${card.impact}` : undefined,
    shown('effort') && card.effort ? `effort ${card.effort}` : undefined,
  ].filter(Boolean)
  return (
    <CardFace
      className={[styles.sheet, className].filter(Boolean).join(' ')}
      tone={CARD_TONE[card.type]}
      tint
      selected={selected}
      finished={finished}
      lifted={lifted}
      marks={live && !lifted}
      peersOf={card.id}
      button={live && !lifted}
      label={`${card.type}: ${cardName(card)}`}
      data-sheet
      data-card
      data-ccard={card.id}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={live && onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <span className={styles.head}>
        <span className={styles.type}>{card.type}</span>
        <span className={styles.push} />
        {shown('priority') && card.priority && <PriorityChip priority={card.priority} />}
      </span>
      <span className={styles.title}>{cardName(card)}</span>
      {(sure || rest.length > 0) && (
        <span className={styles.meta}>
          {sure && (
            <span className={styles.sure} data-level={sure} title={sure === 'broken' ? 'something it rests on is invalidated' : `confidence ${sure}, from the status of what it rests on`}>
              {sure === 'broken' ? '! broken' : `◆ ${sure}`}
            </span>
          )}
          <span className={styles.push} />
          {rest.join(' · ')}
        </span>
      )}
    </CardFace>
  )
}
