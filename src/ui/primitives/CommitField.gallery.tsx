import { useState } from 'react'
import { example } from '../../gallery/example'
import { CommitField } from './CommitField'

const box = { width: 340, display: 'grid', gap: 'var(--space-2)', color: 'var(--fg-dim)' } as const

function Live({ start, ...p }: { start: string } & Omit<React.ComponentProps<typeof CommitField>, 'value' | 'onSave'>) {
  const [saved, setSaved] = useState(start)
  return (
    <div style={box}>
      <CommitField {...p} value={saved} onSave={setSaved} />
      <small>saved: {saved || '—'}</small>
    </div>
  )
}

export default example({
  name: 'CommitField',
  place: 'forms/fields',
  file: 'src/ui/primitives/CommitField.tsx',
  note: 'a value edited where it’s shown (D-359): kept on Enter or leaving it, Escape undoes; one line, ⇧↵ lines, or notes (↵ a new line, Escape keeps); `line` (D-392): an input for a name or a number typed over, everything selected, `onEnd` when it’s over',
  states: {
    'one line (a site)': () => <Live start="lunchbox.io" label="site" placeholder="their website" quiet size="sm" />,
    'title, ⇧↵ a new line, never empty': () => <Live start="Call the office park" label="Title" enter="shift" empty="undo" />,
    'a name typed over (line, selected, never empty)': () => <Live start="TODO" label="Column name" line select empty="undo" size="sm" maxLength={40} />,
    'a number typed over (line, digits only)': () => <Live start="3" label="Limit" line select inputMode="numeric" placeholder="–" size="sm" clean={(v) => v.replace(/\D/g, '').slice(0, 2)} />,
    'notes (↵ a new line, Escape keeps)': () => <Live start="" label="Notes" placeholder="What it takes, what done looks like." enter="newline" escape="keep" rows={2} />,
  },
})
