import { useState } from 'react'
import { example } from '../../gallery/example'
import { Choice } from './Choice'

function Pick({ clearable, start }: { clearable?: boolean; start?: 'P1' | 'P2' | 'P3' }) {
  const [v, setV] = useState<'P1' | 'P2' | 'P3' | undefined>(start)
  return clearable ? <Choice label="priority" options={['P1', 'P2', 'P3'] as const} value={v} clearable onChange={setV} /> : <Choice label="priority" options={['P1', 'P2', 'P3'] as const} value={v} onChange={setV} />
}

export default example({
  name: 'Choice',
  place: 'forms/pickers',
  file: 'src/ui/primitives/Choice.tsx',
  note: 'Tabs’ segments (D-344): every one-of-several in the app (priorities, statuses, the card panel’s rows, documents’ table | shelf)',
  states: {
    picked: () => <Pick start="P2" />,
    'none picked': () => <Pick />,
    clearable: { render: () => <Pick clearable start="P1" />, note: 'clicking the picked one clears it' },
    tones: () => (
      <Choice
        label="status"
        options={['hypothesis', 'testing', 'validated', 'invalidated'] as const}
        value="validated"
        tones={{ validated: 'var(--accent-green)', invalidated: 'var(--accent-magenta)', testing: 'var(--accent-yellow)' }}
        onChange={() => {}}
      />
    ),
    bare: () => <Choice label="theme" bare options={['dark', 'light', 'system'] as const} value="dark" onChange={() => {}} />,
  },
})
