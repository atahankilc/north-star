import { example } from '../../gallery/example'
import { onCanvas, P } from '../../gallery/canvas'

export default example({
  name: 'Table',
  place: 'canvas/pieces',
  file: 'src/views/workspace/Table.tsx',
  note: 'features with their fields and a number column (D-209)',
  states: {
    'on the canvas': onCanvas({ only: [P.table] }),
    'in focus': onCanvas({ only: [P.table], focus: P.table }),
    unframed: onCanvas({ only: [P.table], open: [P.table] }),
    'edit mode': onCanvas({ only: [P.table], edit: [P.table], selected: P.table }),
  },
})
