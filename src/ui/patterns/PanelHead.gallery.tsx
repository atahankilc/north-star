import { example } from '../../gallery/example'
import { Button } from '../primitives/Button'
import { PanelHead } from './PanelHead'

const none = () => {}
const box = { width: 400, background: 'var(--bg)', border: 'var(--line-w) solid var(--line-hover)', paddingBottom: 'var(--space-4)' } as const

export default example({
  name: 'PanelHead',
  place: 'panels/frame',
  file: 'src/ui/patterns/PanelHead.tsx',
  note: 'a docked panel’s top line (D-359): the kind in its tone, tools joined with the one × at the right; the right panel’s and the agent column’s',
  states: {
    'kind and close': () => (
      <div style={box}>
        <PanelHead kind="problem" tone="var(--accent-magenta)" onClose={none} />
      </div>
    ),
    'with tools': () => (
      <div style={box}>
        <PanelHead kind="task" tone="var(--accent-magenta)" onClose={none} tools={<Button onClick={none}>full</Button>} />
      </div>
    ),
    'something after the kind': () => (
      <div style={box}>
        <PanelHead kind="agent" tone="var(--accent-cyan)" onClose={none} tools={<><Button onClick={none}>chats</Button><Button onClick={none}>new</Button></>}>
          <span style={{ color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>gpt-5.5</span>
        </PanelHead>
      </div>
    ),
  },
})
