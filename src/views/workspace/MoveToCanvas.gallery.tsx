import { example } from '../../gallery/example'
import { onCanvas, P, PAZAR } from '../../gallery/canvas'
import { useCanvasView } from '../../state/canvasView'

const LAUNCH = 'c-launch'
const AT = PAZAR.workspace.createdAt + 24 * 3600 * 1000
const twoCanvases = (ws: typeof PAZAR) => ({ ...ws, canvases: [...ws.canvases, { id: LAUNCH, name: 'Launch week', order: 1, createdAt: AT }, { id: 'c-research', name: 'Research', order: 2, createdAt: AT + 1 }] })
const ask = (share?: boolean) => () => {
  const { size } = useCanvasView.getState()
  useCanvasView.setState({ toCanvas: { pieces: [P.matrix], labels: [], screen: [size.w / 2 - 160, size.h / 3], share } })
}

export default example({
  name: 'Move to canvas',
  place: 'overlays/pickers',
  file: 'src/views/workspace/MoveToCanvas.tsx',
  note: 'edit mode’s `[move to…]` and `[also on…]` (D-302): the canvases to pick from',
  states: {
    'move to': onCanvas({ only: [P.lunch, P.matrix], change: twoCanvases, edit: [P.matrix], selected: P.matrix, then: ask() }),
    'also on': onCanvas({ only: [P.lunch, P.matrix], change: twoCanvases, edit: [P.matrix], selected: P.matrix, then: ask(true) }),
  },
})
