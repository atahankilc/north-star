import { example } from '../../gallery/example'
import { EdgeColumn } from './EdgeColumn'
import { PanelHead } from './PanelHead'

const none = () => {}
const body = { padding: 'var(--space-4) var(--space-6)', color: 'var(--fg-dim)' } as const

export default example({
  name: 'EdgeColumn',
  place: 'panels/frame',
  file: 'src/ui/patterns/EdgeColumn.tsx',
  note: 'a column docked to an edge (D-359): full height, a line on its inner edge with the docked marks, cell by cell, Escape on the one stack; SidePanel, the agent’s column and the tasks side view are built on it',
  states: {
    right: {
      size: 'full',
      render: () => (
        <EdgeColumn label="a right column" onClose={none}>
          <PanelHead kind="right" onClose={none} />
          <p style={body}>Docked to the right edge, 400 px. Point at it: its marks turn cyan.</p>
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
