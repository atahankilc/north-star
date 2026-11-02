// A card as a row of the prompt (D-222, D-350): one shape for every card picker (the card panel's, bringing a card in,
// a matrix's axis, a deck's cards): `▌` in its type's colour, its title (`untitled idea` while it has none), found by
// its type and tags too. The caller adds what it knows: the planes it's on (`where`), why it's suggested, what it does
// when picked.
import type { Card } from '../../../data/cards'
import type { PromptItem } from '../../../ui/foundation/promptModel'
import { CARD_TONE } from '../../../ui/foundation/cardTone'

export function cardEntry(c: Card, onSelect: PromptItem['onSelect'], more: Partial<PromptItem> = {}): PromptItem {
  return {
    key: c.id,
    label: c.title || `untitled ${c.type}`,
    glyph: '▌',
    tone: CARD_TONE[c.type],
    words: [c.type, ...(c.tags ?? [])].join(' '),
    onSelect,
    ...more,
  }
}

// The planes a card is on, by name, for its hint: two, then `+N`.
export function whereList(names: string[]): string {
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
}
