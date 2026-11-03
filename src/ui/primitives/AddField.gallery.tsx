import { useState } from 'react'
import { example } from '../../gallery/example'
import { Button } from './Button'
import { Chip } from './Chip'
import { AddField } from './AddField'

function Tags() {
  const [tags, setTags] = useState(['lunch', 'b2b'])
  const [adding, setAdding] = useState<string | null>(null)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', width: 340 }}>
      {tags.map((t) => (
        <Chip key={t} onRemove={() => setTags(tags.filter((x) => x !== t))} removeLabel="Remove">
          #{t}
        </Chip>
      ))}
      {adding !== null ? (
        <AddField value={adding} onChange={setAdding} label="Tag" placeholder="tag" onAdd={(t) => (setTags([...tags, t.replace(/^#/, '')]), setAdding(''))} onClose={() => setAdding(null)} />
      ) : (
        <Button onClick={() => setAdding('')}>+ tag</Button>
      )}
    </div>
  )
}

export default example({
  name: 'AddField',
  place: 'forms/fields',
  file: 'src/ui/primitives/AddField.tsx',
  note: 'what a + tag turns into (D-359): Enter adds and stays for the next, leaving adds what’s typed and closes, Escape closes and drops it; the card panel’s tags, regions, criteria, a task’s labels and checklist',
  states: {
    tags: () => <Tags />,
  },
})
