// A card's name wherever it's written (D-358): its title, or `untitled <type>` while it has none. On the card's own
// face an empty card asks its question instead (`cardPlaceholder`, faint), so it reads as something to fill in.
import type { AnyType, Card } from './cards'

export const cardName = (c: Pick<Card, 'title' | 'type'>) => c.title || `untitled ${c.type}`

export const CARD_PLACEHOLDER: Record<AnyType, string> = {
  package: 'What does this piece deliver?',
  customer: 'Who are they?',
  problem: 'What hurts?',
  competitor: 'Who else does it?',
  idea: "What's the thought?",
  feature: 'What does it do?',
}
export const cardPlaceholder = (type: AnyType) => CARD_PLACEHOLDER[type]
