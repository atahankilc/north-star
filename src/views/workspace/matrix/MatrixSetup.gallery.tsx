import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { SETUP_TABS } from './Matrix'
import { openSetup } from '../canvas/setupStore'

export default example({
  name: 'Matrix setup',
  place: 'panels/setups',
  also: ['forms/layout'],
  file: 'src/views/workspace/matrix/MatrixSetup.tsx',
  note: 'a matrix’s `[setup]` in focus: rows, columns, cells, options',
  states: Object.fromEntries(
    SETUP_TABS.map((tab) => [tab, onCanvas({ only: [P.matrix], focus: P.matrix, then: () => openSetup(P.matrix, tab) })]),
  ),
})
