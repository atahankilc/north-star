import { example } from '../../gallery/example'
import { Spinner } from './Spinner'

export default example({
  name: 'Spinner',
  place: 'feedback/loading',
  also: ['motion/loops'],
  file: 'src/ui/primitives/Spinner.tsx',
  note: 'the one spinner (D-326): ▖ ▘ ▝ ▗ a step every DUR.snap, still under reduced motion; the caller’s class colours it',
  states: {
    alone: () => <Spinner />,
    'in a line': () => (
      <p style={{ display: 'flex', gap: 'var(--space-2)', color: 'var(--fg-muted)' }}>
        <Spinner /> thinking…
      </p>
    ),
    'in a prompt': () => (
      <p style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Spinner /> <span style={{ color: 'var(--fg-dim)' }}>finding cards about pickup…</span>
      </p>
    ),
  },
})
