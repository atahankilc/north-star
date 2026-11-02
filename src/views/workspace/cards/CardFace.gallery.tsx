import type { ReactNode } from 'react'
import { example } from '../../../gallery/example'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { ALL_TYPES } from '../../../model/cards'
import { CardFace } from './CardFace'

// Faces at the world's size (as on a deck at 100 %), each with a line of text to show its ink.
const row = (n: ReactNode) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-start', maxWidth: 760 }}>{n}</div>
const inside = (text: string) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', width: 160, padding: 'var(--space-3) var(--space-3) var(--space-3) var(--space-4)', fontSize: 'var(--w-text-xs)' }}>
    <span style={{ color: 'var(--type-ink, var(--tone, var(--fg)))', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{text}</span>
    <span style={{ color: 'var(--fg)', fontSize: 'var(--w-text-lg)' }}>Office workers</span>
    <span style={{ color: 'var(--fg-dim)' }}>dim · testing +2 −1</span>
    <span style={{ color: 'var(--fg-faint)' }}>faint · 2 days ago</span>
  </div>
)

export default example({
  name: 'CardFace',
  place: 'canvas/cards',
  file: 'src/views/workspace/cards/CardFace.tsx',
  note: 'the one face every card and task stands on (D-358): paper, an edge in its card’s colour, a tint for a card, D-295’s ink on it',
  states: {
    'plain (a task with no card)': () => row(<CardFace>{inside('task')}</CardFace>),
    'edged (a task for a card)': () =>
      row(
        ALL_TYPES.map((t) => (
          <CardFace key={t} tone={CARD_TONE[t]}>
            {inside(t)}
          </CardFace>
        )),
      ),
    'tinted (a card)': () =>
      row(
        ALL_TYPES.map((t) => (
          <CardFace key={t} tone={CARD_TONE[t]} tint>
            {inside(t)}
          </CardFace>
        )),
      ),
    'card edge (a plane card’s)': () =>
      row(
        ALL_TYPES.map((t) => (
          <CardFace key={t} tone={CARD_TONE[t]} tint edge="card">
            {inside(t)}
          </CardFace>
        )),
      ),
    marks: () =>
      row(
        <>
          <CardFace tone={CARD_TONE.idea} tint marks>
            {inside('hover me')}
          </CardFace>
          <CardFace tone={CARD_TONE.idea} tint marks selected>
            {inside('selected')}
          </CardFace>
          <CardFace tone={CARD_TONE.idea} tint marks pressed>
            {inside('pressed')}
          </CardFace>
        </>,
      ),
  },
})
