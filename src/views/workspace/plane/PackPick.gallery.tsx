import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { useCanvasView } from '../../../state/canvasView'

export default example({
  name: 'Package picking',
  place: 'canvas/tools',
  file: 'src/views/workspace/plane/PackPick.tsx',
  note: '`+ → package`: click or box cards, Enter makes it (D-239)',
  states: {
    'nothing picked': onCanvas({ only: [P.product], focus: P.product, then: () => useCanvasView.setState({ packing: P.product }) }),
    'three picked': onCanvas({ only: [P.product], focus: P.product, cards: ['f-pickup', 'f-qr', 'f-counter'], then: () => useCanvasView.setState({ packing: P.product }) }),
  },
})
