import { example } from '../../gallery/example'
import { EdgeColumn } from './EdgeColumn'
import { PanelHead } from './PanelHead'

const none = () => {}
const body = { padding: 'var(--space-4) var(--space-6)', color: 'var(--fg-dim)' } as const

export default example({
  name: 'EdgeColumn',
  place: 'panels/frame',
  file: 'src/ui/patterns/EdgeColumn.tsx',
  note: 'a column docked to an edge (D-359): full height, on the ground under the main screen, which lifts, goes round and draws back from it (D-387) and so uncovers it, no cells (D-395), Escape on the one stack; SidePanel, the agent’s column and the tasks side view are built on it',
  states: {
    right: {
      size: 'full',
      render: () => (
        <EdgeColumn label="a right column" onClose={none}>
          <PanelHead kind="right" onClose={none} />
          <p style={body}>Docked to the right edge, 400 px. The main screen is the round sheet beside it.</p>
        </EdgeColumn>
      ),
    },
    'left, narrower': {
      size: 'full',
      render: () => (
        <EdgeColumn side="left" width={320} label="a left column" onClose={none}>
          <PanelHead kind="left" onClose={none} />
          <p style={body}>Docked to the left edge, 320 px.</p>
        </EdgeColumn>
      ),
    },
  },
})
