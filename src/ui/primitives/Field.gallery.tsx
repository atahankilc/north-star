import { useState, type ReactNode } from 'react'
import { example } from '../../gallery/example'
import { Field } from './Field'

const box = (n: ReactNode) => <div style={{ width: 360 }}>{n}</div>

function Live({ start = '', ...p }: { start?: string } & Omit<Parameters<typeof Field>[0], 'value' | 'onChange'>) {
  const [v, setV] = useState(start)
  const [said, setSaid] = useState('')
  return (
    <div style={{ width: 360, display: 'grid', gap: 'var(--space-2)' }}>
      <Field {...(p as object)} value={v} onChange={setV} onEnter={(x: string) => setSaid(`enter: ${x}`)} onEscape={() => setSaid('escape')} label={p.label} />
      <span style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>{said || ' '}</span>
    </div>
  )
}

export default example({
  name: 'Field',
  place: 'forms/fields',
  file: 'src/ui/primitives/Field.tsx',
  note: 'the one text field (D-326; D-384): a round well with no line, a cyan ring round it with the keyboard; `bare` and `plain` for a value typed where it’s drawn (D-406); Enter and Escape say what they did here',
  states: {
    empty: () => <Live label="tag" placeholder="add a tag…" />,
    filled: () => <Live label="source" start="Interviews: Kreuzberg offices" />,
    focused: { render: () => <Live label="source" start="Interviews" autoFocus />, note: 'a cyan ring all the way round' },
    small: () => <Live label="cost" size="sm" start="640" inputMode="numeric" />,
    quiet: { render: () => box(<><Live label="pricing" quiet start="€1.99–4.99 delivery" /><p style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>its well shows on hover and focus</p></>) },
    multiline: { render: () => <Live label="notes" multiline start={'Talked to 6 cooks.\nTwo already sell on Instagram.\nAll want pickup, not delivery.'} />, note: 'as tall as its text; ⌘Enter is its Enter' },
    disabled: () => <Live label="name" disabled start="Pazar" />,
    'bare (a name typed where it’s drawn)': { render: () => <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)' }}><Live label="Row name" look="bare" start="Office workers" autoFocus /></div>, note: 'in the caller’s font, a cyan line under it: a matrix’s head, a table’s row (D-406)' },
    'plain (the caller’s look)': { render: () => <Live label="note" look="plain" start="a note where it reads" />, note: 'nothing of its own: AutosaveField’s note on a cell (D-406)' },
  },
})
