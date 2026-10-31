import { example } from '../../gallery/example'
import { Canvas, onCanvas, P } from '../../gallery/canvas'
import { press } from '../../gallery/docks'
import { MatrixWizard } from './MatrixWizard'
import { useMatrixUi } from './Matrix'

// `+ → matrix…` (SideNav mounts it): opened here as the menu would.
const wizard = (then?: () => Promise<void>) => ({
  ...onCanvas({ only: [P.lunch, P.product], then: async () => (useMatrixUi.setState({ wizard: true }), await then?.()) }),
  render: () => (
    <Canvas>
      <MatrixWizard />
    </Canvas>
  ),
})

export default example({
  name: 'Matrix wizard',
  place: 'overlays/wizards',
  file: 'src/views/workspace/MatrixWizard.tsx',
  note: 'start from, rows, columns, cells, with a preview (D-204)',
  states: {
    'start from': wizard(),
    'a start picked': wizard(() => press('[data-learn="wizard"] button', 'features × competitors')),
    rows: wizard(() => press('[data-learn="wizard"] [role="tab"]', '2')),
    cells: wizard(() => press('[data-learn="wizard"] [role="tab"]', '4')),
  },
})
