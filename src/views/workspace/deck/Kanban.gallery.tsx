import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'

export default example({
  name: 'Deck',
  place: 'canvas/pieces',
  file: 'src/views/workspace/deck/Kanban.tsx',
  note: 'a deck of tasks (kanban in code, D-301): columns, a limit, overdue in magenta',
  states: {
    'on the canvas': onCanvas({ only: [P.deck] }),
    'in focus': onCanvas({ only: [P.deck], focus: P.deck }),
    unframed: onCanvas({ only: [P.deck], open: [P.deck] }),
    'edit mode': onCanvas({ only: [P.deck], edit: [P.deck], selected: P.deck }),
  },
})
