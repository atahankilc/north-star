import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'

export default example({
  name: 'Matrix',
  place: 'canvas/pieces',
  file: 'src/views/workspace/matrix/Matrix.tsx',
  note: 'features × competitors on a scale, `—` and `~ ?` (D-204, D-136)',
  states: {
    'on the canvas': onCanvas({ only: [P.matrix] }),
    'in focus': onCanvas({ only: [P.matrix], focus: P.matrix }),
    unframed: onCanvas({ only: [P.matrix], open: [P.matrix], note: 'laid on the canvas at its own size (D-228)' }),
    'edit mode': onCanvas({ only: [P.matrix], edit: [P.matrix], selected: P.matrix }),
    'beside its plane': onCanvas({ only: [P.product, P.matrix] }),
  },
})
