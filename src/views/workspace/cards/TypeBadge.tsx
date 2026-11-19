// A card's type as a badge (D-409): a pill of its colour with the type's word in the page's ink, on a plane card, a
// package's band and a deck's sheets; `word={false}`, the pill alone (a timeline's bar, the no-day tray: no room for
// the word), its type said on hover. Its size follows the text it sits in.
import type { AnyType } from '../../../model/cards'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import styles from './TypeBadge.module.css'

export function TypeBadge({ type, word = true, className }: { type: AnyType; word?: boolean; className?: string }) {
  return (
    <span
      className={[styles.badge, className].filter(Boolean).join(' ')}
      style={{ ['--badge' as string]: CARD_TONE[type] }}
      data-word={word || undefined}
      title={word ? undefined : type}
      aria-label={word ? undefined : type}
    >
      {word ? type : null}
    </span>
  )
}
