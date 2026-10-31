// Each card type's colour (D-007, D-045; D-326): one map, pointing at tokens.css' `--type-*` (which point at the
// accents, so the light theme's shades follow). Every place that colours a card by its type reads it here: the card's
// edge and label, its panel, the `+` menu, the filters, a task's sheet, the timeline.
import type { AnyType } from '../model/cards'

export const CARD_TONE: Record<AnyType, string> = {
  customer: 'var(--type-customer)',
  problem: 'var(--type-problem)',
  competitor: 'var(--type-competitor)',
  idea: 'var(--type-idea)',
  feature: 'var(--type-feature)',
  package: 'var(--type-package)',
}
