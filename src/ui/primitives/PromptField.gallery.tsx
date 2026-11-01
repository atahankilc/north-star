import { useState } from 'react'
import { example } from '../../gallery/example'
import { PromptField } from './PromptField'

function Live({ start = '', ...p }: { start?: string } & Omit<Parameters<typeof PromptField>[0], 'value' | 'onChange' | 'onSubmit'>) {
  const [v, setV] = useState(start)
  const [said, setSaid] = useState('')
  return (
    <div style={{ width: 420, display: 'grid', gap: 'var(--space-2)' }}>
      <div style={{ border: '1px solid var(--line-hover)', background: 'var(--bg)' }}>
        <PromptField {...p} value={v} onChange={setV} onSubmit={(x) => (setSaid(`submit: ${x}`), setV(''))} onEscape={() => setSaid('escape')} />
      </div>
      <span style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>{said || ' '}</span>
    </div>
  )
}

export default example({
  name: 'PromptField',
  place: 'forms/fields',
  file: 'src/ui/primitives/PromptField.tsx',
  note: 'the `>` line (D-222): a menu’s, the finder’s, a comment’s, the agent’s; Enter submits',
  states: {
    'in a menu': () => <Live label="find" framed placeholder="type to find…" />,
    typed: { render: () => <Live label="find" framed start="permit" autoFocus /> },
    running: { render: () => <Live label="ask" framed running start="group the ideas on Bets by status" />, note: 'the Spinner instead of >' },
    multiline: { render: () => <Live label="comment" multiline placeholder="write a comment…  ⇧↵ a new line" start={'Shall we ask Factory first?\nThey said yes to a shelf.'} />, note: 'Enter sends, Shift+Enter a new line' },
    'own sign': () => <Live label="add a task" sign="+" placeholder="a task, ↵ adds it" />,
    disabled: () => <Live label="ask" framed disabled placeholder="viewers can’t ask" />,
  },
})
