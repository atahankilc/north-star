import { example } from '../../gallery/example'
import { Num, Rule } from './Rule'

const box = { width: 400, display: 'grid', gap: 'var(--space-4)' } as const
const none = () => {}

export default example({
  name: 'Rule',
  place: 'text/rules',
  file: 'src/ui/primitives/Rule.tsx',
  note: '01 NAME ──── count + add (D-266, D-277): a panel’s sections (PanelSection draws it), a deck’s columns, the agent’s views',
  states: {
    'panel section': () => (
      <div style={box}>
        <Rule n={1} name="status" />
        <Rule n={2} name="evidence" count={3} add={{ label: 'evidence', onClick: none }} />
        <Rule n={3} name="tags" add={{ label: 'tag', onClick: none }} />
      </div>
    ),
    'count at the end': () => (
      <div style={box}>
        <Rule n={1} name="to do" count={4} countAt="end" />
        <Rule n={2} name="doing" count="3/3" countAt="end" />
      </div>
    ),
    'aside, no number': () => (
      <div style={box}>
        <Rule n="01" name="chats" aside="3 saved" />
        <Rule name="suggested order" aside="impact × confidence ÷ effort" />
      </div>
    ),
    'numbered, no line': () => (
      <div style={box}>
        <Rule n={1} name="What we heard" line={false} />
        <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Num n={1} /> launch <Num n={2} /> research
        </span>
      </div>
    ),
  },
})
