import { example } from '../../gallery/example'
import { Swatches } from './Swatches'
import { CARD_TONE } from '../foundation/cardTone'

const TYPES = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package'] as const

export default example({
  name: 'Swatches',
  place: 'forms/pickers',
  file: 'src/ui/primitives/Swatches.tsx',
  note: 'a filter’s summary on its trigger (D-233): one square per kind, filled while shown, an outline while hidden',
  states: {
    'all shown': () => <Swatches list={TYPES.map((t) => ({ key: t, tone: CARD_TONE[t], on: true }))} />,
    'some hidden': () => <Swatches list={TYPES.map((t, i) => ({ key: t, tone: CARD_TONE[t], on: i % 2 === 0 }))} />,
  },
})
