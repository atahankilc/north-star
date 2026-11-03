import { useState } from 'react'
import { example } from '../../../gallery/example'
import { CellInput } from './CellInput'
import styles from '../table/Table.module.css'

function Demo({ numeric, initial }: { numeric: boolean; initial: string }) {
  const [said, setSaid] = useState('type, then Enter, Escape or click away')
  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)', width: 240 }}>
      <div className={styles.cell} data-selected style={{ position: 'relative', width: 160, height: 36 }}>
        <CellInput className={styles.cellField} label="Cell" numeric={numeric} initial={initial} max={200} onTyped={(v) => setSaid(v === null ? 'refused: left as it was' : v === undefined ? 'cleared' : `kept: ${JSON.stringify(v)}`)} />
      </div>
      <small>{said}</small>
    </div>
  )
}

export default example({
  name: 'CellInput',
  place: 'canvas/pieces',
  file: 'src/views/workspace/canvas/CellInput.tsx',
  note: 'a value typed in place in a matrix’s or a table’s cell (D-361): Enter or leaving keeps it, Escape drops it; a number reads , as .',
  states: {
    number: () => <Demo numeric initial="12,5" />,
    text: () => <Demo numeric={false} initial="needs a permit" />,
  },
})
