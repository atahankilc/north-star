import { example } from '../../gallery/example'
import { Empty } from './Empty'

export default example({
  name: 'Empty',
  place: 'feedback/empty',
  file: 'src/ui/primitives/Empty.tsx',
  note: 'nothing here yet: one faint line in the words of what it’s about (D-326)',
  states: {
    'a line': () => <Empty>No tasks yet</Empty>,
    'in a list': () => (
      <div style={{ width: 320, border: '1px solid var(--line)', padding: 'var(--space-2) var(--space-3)' }}>
        <Empty>No cards on this plane yet</Empty>
      </div>
    ),
  },
})
