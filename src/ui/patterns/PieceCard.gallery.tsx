import { example } from '../../gallery/example'
import { Button } from '../primitives/Button'
import { PieceCard } from './PieceCard'

const box = { width: 'var(--size-sm)', padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-1)' }
const words = (
  <>
    <span style={{ color: 'var(--fg-strong)' }}>Bring one in</span>
    <span style={{ color: 'var(--fg-dim)', fontSize: 'var(--text-sm)' }}>A .zip exported from North Star.</span>
  </>
)

export default example({
  name: 'PieceCard',
  place: 'screens/workspaces',
  file: 'src/ui/patterns/PieceCard.tsx',
  note: 'a card on a page that lists things (D-387, D-390): round with a line, its name a label on top in its tone; Marks on its round corner when it opens something',
  states: {
    plain: () => (
      <PieceCard tone="var(--accent-blue)" name="import" style={box}>
        {words}
      </PieceCard>
    ),
    'opens': {
      hover: '[data-open]',
      render: () => (
        <PieceCard tone="var(--accent-cyan)" name="continue" onOpen={() => {}} style={box}>
          {words}
        </PieceCard>
      ),
    },
    'with its own button': () => (
      <PieceCard tone="var(--accent-yellow)" name="for you" onOpen={() => {}} style={box}>
        {words}
        <Button>choose file</Button>
      </PieceCard>
    ),
    'as one button': () => (
      <PieceCard as="button" tone="var(--accent-magenta)" name="new" onOpen={() => {}} style={box}>
        {words}
      </PieceCard>
    ),
  },
})
