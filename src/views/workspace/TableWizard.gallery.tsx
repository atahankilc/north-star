import { example } from '../../gallery/example'
import { Canvas, onCanvas, P } from '../../gallery/canvas'
import { press } from '../../gallery/docks'
import { TableWizard } from './TableWizard'
import { useTableUi } from './Table'

const wizard = (then?: () => Promise<void>) => ({
  ...onCanvas({ only: [P.lunch, P.product], then: async () => (useTableUi.setState({ wizard: true }), await then?.()) }),
  render: () => (
    <Canvas>
      <TableWizard />
    </Canvas>
  ),
})

export default example({
  name: 'Table wizard',
  place: 'overlays/wizards',
  file: 'src/views/workspace/TableWizard.tsx',
  note: '`+ → table…`: every card, features, competitors, blank (D-209)',
  states: {
    'start from': wizard(),
    'features picked': wizard(() => press('[data-learn="wizard"] button', 'features')),
    rows: wizard(() => press('[data-learn="wizard"] [role="tab"]', '2')),
    columns: wizard(() => press('[data-learn="wizard"] [role="tab"]', '3')),
  },
})
