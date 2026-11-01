import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { useCanvasView } from '../../../state/canvasView'

const open = () => {
  const { size } = useCanvasView.getState()
  useCanvasView.setState({ bringing: { plane: P.product, at: null, screen: [size.w / 2 - 160, size.h / 3] } })
}

export default example({
  name: 'Existing card',
  place: 'overlays/pickers',
  file: 'src/views/workspace/plane/BringCards.tsx',
  note: '`existing card…`: cards on other planes, ↵ bring, ⇧↵ more, ⌥↵ move here (D-281)',
  states: {
    open: onCanvas({ only: [P.lunch, P.product], focus: P.product, then: open }),
  },
})
