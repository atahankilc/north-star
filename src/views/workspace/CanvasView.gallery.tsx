import { example } from '../../gallery/example'
import { onCanvas, P } from '../../gallery/canvas'

export default example({
  name: 'Canvas',
  place: 'canvas/the canvas',
  file: 'src/views/workspace/CanvasView.tsx',
  note: 'the real canvas over Pazar (src/demo/fixtures/pazar.ts), no HUD; drag pans, the wheel zooms',
  states: {
    'whole canvas': onCanvas(),
    'piece selected': onCanvas({ selected: P.matrix }),
    empty: onCanvas({ only: [] }),
  },
})
