import { useState } from 'react'
import { example } from '../../../gallery/example'
import { NotesSection } from './NotesSection'

function Demo({ start, editor = true }: { start?: string; editor?: boolean }) {
  const [notes, setNotes] = useState(start)
  return (
    <div style={{ width: 360 }}>
      <NotesSection n={5} value={notes} placeholder="What it takes, what done looks like." max={20000} editor={editor} onSave={setNotes} />
    </div>
  )
}

export default example({
  name: 'NotesSection',
  place: 'panels/cards',
  also: ['panels/tasks'],
  file: 'src/views/workspace/panels/NotesSection.tsx',
  note: 'a panel’s notes (D-361): a card’s and a task’s; kept as typed, Enter a new line',
  states: {
    empty: () => <Demo />,
    written: () => <Demo start={'Talked to three cooks.\nTwo would pay for it.'} />,
    'read only': () => <Demo start="Only editors change it." editor={false} />,
  },
})
