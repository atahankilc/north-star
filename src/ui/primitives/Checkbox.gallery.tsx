import { useState } from 'react'
import { example } from '../../gallery/example'
import { Checkbox, CheckMark } from './Checkbox'

function Live(p: Omit<Parameters<typeof Checkbox>[0], 'checked' | 'onChange'> & { start?: boolean }) {
  const [on, setOn] = useState(!!p.start)
  return <Checkbox {...p} checked={on} onChange={setOn} />
}
const col = { display: 'grid', gap: 'var(--space-3)' } as const

export default example({
  name: 'Checkbox',
  place: 'forms/pickers',
  file: 'src/ui/primitives/Checkbox.tsx',
  note: 'a toggle cell (D-344): the label is the cell, ✓ before it while on; Space or a click toggles; no label: a square box cell',
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
    'in a row (strip)': () => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--line-w)' }}>
        <Live label="solves" start />
        <Live label="relates" />
        <Live label="competes" />
        <Live label="for" start />
      </div>
    ),
    'box alone (beside typed text)': () => (
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        <Live aria-label="tick" start tone="var(--accent-green)" />
        <Live aria-label="tick" />
        <CheckMark checked />
        <CheckMark checked={false} />
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
