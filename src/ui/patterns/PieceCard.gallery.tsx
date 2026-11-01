import { example } from '../../gallery/example'
import { Button } from '../primitives/Button'
import { Num } from '../primitives/Rule'
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
  place: 'canvas/pieces',
  file: 'src/ui/patterns/PieceCard.tsx',
  note: 'a piece off the canvas (D-263, D-266): graphite, its band, its name cut in; Marks when it opens something',
  states: {
    plain: () => (
      <PieceCard band="var(--accent-blue)" name="import" style={box}>
        {words}
      </PieceCard>
    ),
    'numbered, opens': {
      hover: '[data-open]',
      render: () => (
        <PieceCard band="var(--accent-cyan)" name={<><Num n={1} /> continue</>} onOpen={() => {}} style={box}>
          {words}
        </PieceCard>
      ),
    },
    'with its own button': () => (
      <PieceCard band="var(--accent-yellow)" name="for you" onOpen={() => {}} style={box}>
        {words}
        <Button>choose file</Button>
      </PieceCard>
    ),
    'as one button': () => (
      <PieceCard as="button" band="var(--accent-magenta)" name="new" onOpen={() => {}} style={box}>
        {words}
      </PieceCard>
    ),
  },
})
