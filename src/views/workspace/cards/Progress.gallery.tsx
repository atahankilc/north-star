import { example } from '../../../gallery/example'
import { Progress } from './Progress'

const row = { display: 'flex', gap: 'var(--space-4)', alignItems: 'center', fontSize: 'var(--text-xs)', color: 'var(--fg-dim)' }

export default example({
  name: 'Progress',
  place: 'canvas/cards',
  file: 'src/views/workspace/cards/Progress.tsx',
  note: 'how far along (D-358): a checklist’s steps as cells, a card’s tasks as a box; green once all are done',
  states: {
    'a checklist (cells)': () => (
      <div style={row}>
        <Progress look="cells" done={0} all={3} title="0 of 3" />
        <Progress look="cells" done={2} all={3} title="2 of 3" />
        <Progress look="cells" done={3} all={3} title="3 of 3" />
        <Progress look="cells" done={4} all={12} title="past eight: the count alone" />
      </div>
    ),
    'a card’s tasks (box)': () => (
      <div style={{ ...row, fontFamily: 'var(--font-mono)' }}>
        <Progress look="box" done={1} all={3} title="1 of 3" />
        <Progress look="box" done={5} all={5} title="5 of 5" />
      </div>
    ),
  },
})
