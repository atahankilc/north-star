import { example } from '../../../gallery/example'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { CardFace } from './CardFace'
import { PriorityChip } from './PriorityChip'

const row = (tint: boolean) => (
  <CardFace tone={tint ? CARD_TONE.feature : undefined} tint={tint}>
    <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)' }}>
      <PriorityChip priority="P1" />
      <PriorityChip priority="P2" />
      <PriorityChip priority="P3" />
      <PriorityChip priority="P1" tone="var(--accent-yellow)">
        P2 → P1
      </PriorityChip>
    </div>
  </CardFace>
)

export default example({
  name: 'PriorityChip',
  place: 'canvas/cards',
  also: ['text/chips'],
  file: 'src/views/workspace/cards/PriorityChip.tsx',
  note: 'a priority as a pill (D-358): one P1 for tasks, cards and the suggested order; on a card’s tint it leans to the ink',
  states: {
    'on a task (plain)': () => row(false),
    'on a card (tinted)': () => row(true),
  },
})
