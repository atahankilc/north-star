import { example } from '../../gallery/example'
import { Ink } from './Ink'

export default example({
  name: 'Ink',
  place: 'text/ink',
  file: 'src/ui/primitives/Ink.tsx',
  note: 'the shade text sits on, line by line, every line’s words over every shade; switch ON to piece to see it take the surface',
  states: {
    'one line': () => (
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 29, margin: 0 }}>
        <Ink>Who we beat</Ink>
      </h2>
    ),
    'several lines': () => (
      <p style={{ width: 320, fontFamily: 'var(--font-display)', fontSize: 'var(--text-md)', lineHeight: 1.5 }}>
        <Ink>Home cooks sell tomorrow’s lunch to the offices round the corner. Orders close at nine the night before.</Ink>
      </p>
    ),
  },
})
