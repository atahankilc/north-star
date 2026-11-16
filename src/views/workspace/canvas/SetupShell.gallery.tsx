import { useEffect } from 'react'
import { example } from '../../../gallery/example'
import { Field } from '../../../ui/primitives/Field'
import { SetupRow, SetupShell } from './SetupShell'
import { openSetup } from './setupStore'

const TABS = ['rows', 'cols', 'view'] as const
const NAMES = { rows: 'rows', cols: 'columns', view: 'view' }
const TEMPLATES = [
  { key: 'all', label: 'every card', hint: 'each card a row', onSelect: () => {} },
  { key: 'blank', label: 'blank', hint: 'only what you add', onSelect: () => {} },
]

// The shell stands over the bottom middle of its space: a box stands in for the space.
function Demo({ tab, startOver = true }: { tab?: (typeof TABS)[number]; startOver?: boolean }) {
  useEffect(() => openSetup('demo', tab), [tab])
  return (
    <div style={{ position: 'relative', width: 720, height: 220 }}>
      <SetupShell label="Set up the piece" tabs={TABS} names={NAMES} count={{ rows: 12, cols: 4 }} startOver={startOver ? { what: 'rows and columns', items: TEMPLATES } : undefined}>
        {(at) => (
          <>
            <SetupRow label={NAMES[at]} hint="what this row sets">
              the {NAMES[at]} tab's editor
            </SetupRow>
            <SetupRow label="name">
              <Field label="A name" value="costs" onChange={() => {}} />
            </SetupRow>
          </>
        )}
      </SetupShell>
    </div>
  )
}

export default example({
  name: 'SetupShell',
  place: 'panels/setups',
  file: 'src/views/workspace/canvas/SetupShell.tsx',
  note: 'a setup panel’s shell (D-392): tabs with counts, `start over from`, `done`, the open tab’s editor; the matrix’s, the table’s and the deck’s stand on it. Opens on its first tab',
  states: {
    'first tab': () => <Demo />,
    'another tab': () => <Demo tab="cols" />,
    'no templates': () => <Demo startOver={false} />,
  },
})
