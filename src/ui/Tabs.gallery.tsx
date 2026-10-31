import { useState } from 'react'
import { example } from '../gallery/example'
import { Tabs, type TabOption } from './Tabs'

function Live<T extends string>({ options, start, ...p }: { options: TabOption<T>[]; start: T; label: string; look?: 'tabs' | 'segments' }) {
  const [v, setV] = useState<T>(start)
  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <Tabs {...p} options={options} value={v} onChange={setV} />
      <span style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>showing: {v}</span>
    </div>
  )
}

const SETUP: TabOption<'rows' | 'cols' | 'cells' | 'options'>[] = [
  { value: 'rows', label: 'rows', count: 8 },
  { value: 'cols', label: 'columns', count: 5 },
  { value: 'cells', label: 'cells' },
  { value: 'options', label: 'options' },
]
const WHERE: TabOption<'here' | 'canvas' | 'everywhere'>[] = [
  { value: 'here', label: 'here' },
  { value: 'canvas', label: 'this canvas' },
  { value: 'everywhere', label: 'everywhere' },
]
const SIDE: TabOption<string>[] = [
  { value: 'mine', label: 'mine', count: 2 },
  { value: 'k1', label: '05 launch', count: 9 },
  { value: 'k2', label: '08 priorities', count: 8 },
  { value: 'k3', label: '09 hiring', count: 4 },
  { value: 'k4', label: '10 permits and paperwork', count: 12 },
  { value: 'days', label: 'all · days' },
]

export default example({
  name: 'Tabs',
  place: 'forms/pickers',
  also: ['hud/navigation'],
  file: 'src/ui/Tabs.tsx',
  note: 'one row, one current (D-326): tabs (a setup’s) or segments (a switch); arrows move and pick',
  states: {
    tabs: () => <Live label="setup" options={SETUP} start="rows" />,
    segments: () => <Live label="where" look="segments" options={WHERE} start="here" />,
    'many tabs': () => <Live label="decks" options={SIDE} start="k1" />,
    'segments with counts': () => <Live label="threads" look="segments" options={[{ value: 'open', label: 'open', count: 4 }, { value: 'resolved', label: 'resolved', count: 11 }, { value: 'mentions', label: '@ me', count: 1 }]} start="open" />,
  },
})
