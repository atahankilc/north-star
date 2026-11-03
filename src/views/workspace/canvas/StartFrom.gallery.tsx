import { useState } from 'react'
import { example } from '../../../gallery/example'
import { StartFrom } from './StartFrom'

const TEMPLATES = [
  { key: 'compare', name: 'features × competitors', hint: 'how well each competitor covers each feature' },
  { key: 'fit', name: 'problems × customers', hint: 'how much each customer feels each problem' },
]

function Demo({ start }: { start: string | null }) {
  const [v, setV] = useState(start)
  return (
    <div style={{ width: 520 }}>
      <StartFrom templates={TEMPLATES} value={v} onPick={setV} own="answer the next three" />
    </div>
  )
}

export default example({
  name: 'StartFrom',
  place: 'overlays/wizards',
  file: 'src/views/workspace/canvas/StartFrom.tsx',
  note: 'a piece wizard’s first step (D-361): its templates, then my own; the matrix’s, the table’s and the deck’s',
  states: {
    'a template': () => <Demo start="compare" />,
    'my own': () => <Demo start={null} />,
  },
})
