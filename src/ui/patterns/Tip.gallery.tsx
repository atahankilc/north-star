import { example } from '../../gallery/example'
import { Tip } from './Tip'

export default example({
  name: 'Tip',
  place: 'overlays/menus',
  file: 'src/ui/patterns/Tip.tsx',
  note: 'a word with its meaning on hover or focus (D-355): the onboarding’s app words, cyan and dotted; the box under it, above near the foot',
  states: {
    'in a line': () => (
      <p style={{ maxWidth: 'var(--size-lg)' }}>
        Every <Tip tip="One thing you know or believe: a customer, a problem, a competitor, an idea or a feature.">card</Tip> sits on a{' '}
        <Tip tip="A piece that holds cards and their links: a board to lay out one part of your thinking.">plane</Tip>. Point at a coloured word.
      </p>
    ),
  },
})
