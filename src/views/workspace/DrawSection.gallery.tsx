import { example } from '../../gallery/example'
import { onCanvas, P } from '../../gallery/canvas'
import { drag } from '../../gallery/docks'
import { useCanvasView } from '../../state/canvasView'
import { CANVAS } from '../../model/labels'

export default example({
  name: 'Drawing a section',
  place: 'canvas/tools',
  file: 'src/views/workspace/DrawSection.tsx',
  note: '`+ → section`: drawn with a crosshair (D-194)',
  states: {
    'on the canvas': onCanvas({ only: [P.lunch], then: () => useCanvasView.setState({ drawing: CANVAS }) }),
    'being drawn': onCanvas({
      only: [P.lunch],
      then: async () => {
        useCanvasView.setState({ drawing: CANVAS })
        await new Promise((r) => setTimeout(r, 100))
        await drag('[aria-label="Draw a section"]', [0.2, 0.25], [0.55, 0.7], true)
      },
      note: 'held mid-drag: the frame and its size',
    }),
    'in a plane': onCanvas({ only: [P.lunch], focus: P.lunch, then: () => useCanvasView.setState({ drawing: P.lunch }) }),
  },
})
