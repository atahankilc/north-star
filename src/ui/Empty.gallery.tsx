import { example } from '../gallery/example'
import { Empty } from './Empty'

export default example({
  name: 'Empty',
  place: 'feedback/empty',
  file: 'src/ui/Empty.tsx',
  note: 'nothing here yet: one faint line in the words of what it’s about (D-326)',
  states: {
    faint: () => <Empty>No tasks yet</Empty>,
    dim: () => <Empty tone="dim">Nothing rated yet: score a cell to see the order</Empty>,
    'in a list': () => (
      <div style={{ width: 320, border: '1px solid var(--line)', padding: 'var(--space-2) var(--space-3)' }}>
        <Empty>No cards on this plane yet</Empty>
      </div>
    ),
  },
})
