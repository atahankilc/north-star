import { example } from '../../gallery/example'
import { onCanvas, P } from '../../gallery/canvas'

export default example({
  name: 'Plane',
  section: 'canvas',
  file: 'src/views/workspace/PlaneCards.tsx',
  note: 'a plane and its cards: a fitted picture on the canvas, live in focus (D-180, D-187)',
  states: {
    'on the canvas': onCanvas({ only: [P.lunch] }),
    'in focus': onCanvas({ only: [P.lunch], focus: P.lunch }),
    'card picked': onCanvas({ only: [P.lunch], focus: P.lunch, card: 'i-preorder', note: 'its panel open on the right' }),
    'several picked': onCanvas({ only: [P.lunch], focus: P.lunch, cards: ['r-greasy', 'r-break', 'r-same'], note: 'the panel’s `N selected`' }),
    'features and competitors': onCanvas({ only: [P.product], focus: P.product }),
    'competitor open': onCanvas({ only: [P.product], focus: P.product, card: 'k-wolt', note: 'its features shown inside it' }),
    'edit mode': onCanvas({ only: [P.lunch], edit: [P.lunch], selected: P.lunch }),
  },
})
