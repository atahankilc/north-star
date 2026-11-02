import type { ReactNode } from 'react'
import { example } from '../../../gallery/example'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { CheckMark } from '../../../ui/primitives/Checkbox'
import { Label } from '../../../ui/primitives/Label'
import { Marks } from '../../../ui/primitives/Marks'
import { ALL_TYPES } from '../../../model/cards'
import { cardPlaceholder } from '../../../model/cardName'
import { CardRow } from './CardRow'
import { DueMark } from './DueMark'
import { PriorityChip } from './PriorityChip'

const TITLE = { customer: 'Office workers near the market', problem: 'Lunch takes too long', competitor: 'Lieferando', idea: 'Pre-order at the stall', feature: 'Order by QR code', package: 'Pickup at work' } as const
const list = (n: ReactNode, width = 360) => <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', width, fontSize: 'var(--text-sm)' }}>{n}</div>
const dim = (t: string) => <span style={{ color: 'var(--fg-dim)', fontSize: 'var(--text-xs)' }}>{t}</span>
const day = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default example({
  name: 'CardRow',
  place: 'canvas/cards',
  also: ['panels/rows'],
  file: 'src/views/workspace/cards/CardRow.tsx',
  note: 'a card or task as one line (D-358): its colour on the left edge, a lead, the title cut with …, hints never cut',
  states: {
    'every type (the card a task is for)': () =>
      list(
        ALL_TYPES.map((t) => (
          <CardRow key={t} tone={CARD_TONE[t]} lead={<Label style={{ color: 'var(--tone)' }}>{t}</Label>} title={TITLE[t]} end={dim('↗')} />
        )),
      ),
    'empty (its question, faint)': () => list(<CardRow tone={CARD_TONE.idea} lead={<Label style={{ color: 'var(--tone)' }}>idea</Label>} title={cardPlaceholder('idea')} empty end={dim('↗')} />),
    'a card’s tasks (no colour, a tick)': () =>
      list(
        <>
          <CardRow lead={<CheckMark checked={false} tone="var(--accent-green)" />} title="Ask five stall owners what they lose a week" end={<><DueMark due={day(2)} finished={false} />{dim('todo')}</>} />
          <CardRow lead={<CheckMark checked={false} tone="var(--accent-green)" />} title="Survey 40 office workers" end={<><DueMark due={day(-1)} finished={false} />{dim('doing')}</>} />
          <CardRow done lead={<CheckMark checked tone="var(--accent-green)" />} title="Price the QR stickers" end={dim('done')} />
        </>,
      ),
    'the suggested order (selected, marks)': () =>
      list(
        ['Order by QR code', 'Pickup shelf', 'Allergen labels'].map((t, i) => (
          <CardRow
            key={t}
            tone={CARD_TONE.feature}
            selected={i === 1}
            style={{ padding: 'var(--space-2) var(--space-2) var(--space-2) var(--space-3)', background: i === 1 ? 'var(--bg-raised)' : undefined }}
            lead={<span style={{ color: 'var(--accent-magenta)' }}>{String(i + 1).padStart(2, '0')}</span>}
            title={t}
            end={
              <>
                {dim((2.4 - i * 0.6).toFixed(1))}
                <PriorityChip priority={i === 0 ? 'P1' : 'P2'} />
              </>
            }
            extra={<Marks tier="s" tone="var(--tone)" live selected={i === 1} />}
          />
        )),
      ),
    'at the world’s size (a competitor’s features, washed)': () =>
      list(
        <>
          <CardRow size="world" wash tone="var(--accent-cyan)" title="Order ahead" end={dim('free')} />
          <CardRow size="world" wash tone={CARD_TONE.competitor} title="Group order" end={dim('paid')} />
        </>,
        184,
      ),
  },
})
