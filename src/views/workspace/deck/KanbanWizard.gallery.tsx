import { example } from '../../../gallery/example'
import { Canvas, onCanvas, P } from '../../../gallery/canvas'
import { press } from '../../../gallery/docks'
import { KanbanWizard } from './KanbanWizard'
import { useKanbanUi } from './Kanban'

const wizard = (then?: () => Promise<void>) => ({
  ...onCanvas({ only: [P.lunch, P.product], then: async () => (useKanbanUi.setState({ wizard: true }), await then?.()) }),
  render: () => (
    <Canvas>
      <KanbanWizard />
    </Canvas>
  ),
})

export default example({
  name: 'Deck wizard',
  place: 'overlays/wizards',
  file: 'src/views/workspace/deck/KanbanWizard.tsx',
  note: '`+ → deck…`: tasks, or cards by a field (D-251, D-268)',
  states: {
    kinds: wizard(),
    'features by status': wizard(() => press('[data-learn="wizard"] button', 'features by status')),
    columns: wizard(async () => {
      await press('[data-learn="wizard"] button', 'features by status')
      await press('[data-learn="wizard"] [role="tab"]', '3')
    }),
  },
})
