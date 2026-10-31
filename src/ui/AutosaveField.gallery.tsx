import { useState } from 'react'
import { example } from '../gallery/example'
import { AutosaveField } from './AutosaveField'

// Keeps what's typed, as the app's caller would (the gallery writes nothing).
function Field(p: Omit<Parameters<typeof AutosaveField>[0], 'value' | 'onSave'> & { value?: string }) {
  const [v, setV] = useState(p.value ?? '')
  return (
    <div style={{ width: 360 }}>
      <AutosaveField {...p} value={v} onSave={setV} />
    </div>
  )
}

export default example({
  name: 'AutosaveField',
  place: 'forms/fields',
  file: 'src/ui/AutosaveField.tsx',
  note: 'saves as you type and on blur; the gallery keeps the value in the example only',
  states: {
    'one line': () => <Field label="name" value="Pazar" />,
    empty: () => <Field label="name" placeholder="name this workspace" />,
    wrap: () => <Field label="title" wrap value="Office workers want a home-cooked lunch they can order the day before" />,
    multiline: () => <Field label="notes" multiline value={'Talked to 6 cooks.\nTwo already sell on Instagram.\nAll want pickup, not delivery.'} />,
    focused: { render: () => <Field label="name" value="Pazar" autoFocus /> },
  },
})
