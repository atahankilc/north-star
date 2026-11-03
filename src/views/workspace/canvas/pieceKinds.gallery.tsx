import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'

// Each kind as its record draws it (pieceKinds.tsx): in its window on the canvas, and live in focus (LensLive).
export default example({
  name: 'Piece kinds',
  place: 'canvas/pieces',
  file: 'src/views/workspace/canvas/pieceKinds.tsx',
  note: 'one record per kind (D-361): its view, focus, bounds, setup and dock tools; a plane is the canvas’s own',
  states: {
    'every kind on the canvas': onCanvas({ only: [P.matrix, P.table, P.deck, P.days, P.docs] }),
    'matrix in focus': onCanvas({ only: [P.matrix], focus: P.matrix }),
    'table in focus': onCanvas({ only: [P.table], focus: P.table }),
    'documents in focus': onCanvas({ only: [P.docs], focus: P.docs }),
    'deck in focus': onCanvas({ only: [P.deck], focus: P.deck }),
    'timeline in focus': onCanvas({ only: [P.days], focus: P.days }),
  },
})
