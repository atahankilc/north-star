import { useState } from 'react'
import { example } from '../../gallery/example'
import { Checkbox } from './Checkbox'

function Live(p: Omit<Parameters<typeof Checkbox>[0], 'checked' | 'onChange'> & { start?: boolean }) {
  const [on, setOn] = useState(!!p.start)
  return <Checkbox {...p} checked={on} onChange={setOn} />
}
const col = { display: 'grid', gap: 'var(--space-3)' } as const

export default example({
  name: 'Checkbox',
  place: 'forms/pickers',
  file: 'src/ui/primitives/Checkbox.tsx',
  note: '[x] / [ ] (D-093); Space or a click toggles',
  states: {
    'on and off': () => (
      <div style={col}>
        <Live label="not relevant" start />
        <Live label="how sure" />
      </div>
    ),
    'with hint': () => (
      <div style={col}>
        <Live label="totals" hint="heads, ends or both" start />
        <Live label="reading" hint="a line under the matrix saying what it shows" />
      </div>
    ),
    checklist: () => (
      <div style={col}>
        <Live label="Call Factory" start strike tone="var(--accent-green)" />
        <Live label="Ask about the fridge" strike tone="var(--accent-green)" />
        <Live label="Send the menu" strike tone="var(--accent-green)" />
      </div>
    ),
    disabled: () => (
      <div style={col}>
        <Live label="locked for viewers" disabled start />
        <Live label="locked too" disabled />
      </div>
    ),
  },
})
