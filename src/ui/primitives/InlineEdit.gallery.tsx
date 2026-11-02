import { useState } from 'react'
import { example } from '../../gallery/example'
import { InlineEdit, InlineField } from './InlineEdit'

function Edit({ editing, value = 'Pazar' }: { editing?: boolean; value?: string }) {
  const [v, setV] = useState(value)
  return <InlineEdit value={v} onSave={setV} label="workspace name" editing={editing} onEditingChange={() => {}} />
}

export default example({
  name: 'InlineEdit',
  place: 'forms/fields',
  file: 'src/ui/primitives/InlineEdit.tsx',
  note: 'double-click (or the caller) to edit; Enter keeps, Escape drops; InlineField: the field alone, for a name its caller draws (D-358)',
  states: {
    shown: () => <Edit />,
    editing: () => <Edit editing />,
    'at the limit': () => <Edit editing value={'x'.repeat(80)} />,
    'InlineField (a head’s name typed in place)': () => (
      <div style={{ width: 240, fontFamily: 'var(--font-display)' }}>
        <InlineField value="Speed" label="Column name" placeholder="name" onDone={() => {}} />
      </div>
    ),
    'InlineField, empty': () => (
      <div style={{ width: 240, fontFamily: 'var(--font-display)' }}>
        <InlineField value="" label="Row name" placeholder="name" onDone={() => {}} />
      </div>
    ),
  },
})
