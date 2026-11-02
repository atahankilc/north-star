import { example } from '../../../gallery/example'
import { Assignee } from './Assignee'

const row = { display: 'flex', gap: 'var(--space-3)', alignItems: 'center', fontSize: 'var(--text-xs)' }

export default example({
  name: 'Assignee',
  place: 'canvas/cards',
  file: 'src/views/workspace/cards/Assignee.tsx',
  note: 'who a task is given to (D-358): their initials in a square, on a task’s sheet and a deck’s lane by person',
  states: {
    names: () => (
      <div style={row}>
        <Assignee name="Atahan Kılıç" />
        <Assignee name="alice" />
        <Assignee name="Jo Wu Lee" />
        <Assignee />
      </div>
    ),
    'a lane’s own (me)': () => (
      <div style={row}>
        <Assignee initials="ME" name="you" />
      </div>
    ),
  },
})
