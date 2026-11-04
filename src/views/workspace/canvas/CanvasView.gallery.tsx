import { example } from '../../../gallery/example'
import { onCanvas, P, type OnCanvas } from '../../../gallery/canvas'

// Two cards on the first plane and nothing else on it: they grow to fill it (D-363).
const fewCards: NonNullable<OnCanvas['change']> = (ws) => ({
  ...ws,
  cards: [...ws.cards.filter((c) => c.pieceId !== P.lunch), ...ws.cards.filter((c) => c.pieceId === P.lunch).slice(0, 2)],
  labels: ws.labels.filter((l) => l.pieceId !== P.lunch),
})

export default example({
  name: 'Canvas',
  place: 'canvas/the canvas',
  file: 'src/views/workspace/canvas/CanvasView.tsx',
  note: 'the real canvas over Pazar (src/demo/fixtures/pazar.ts), no HUD; drag pans, the wheel zooms',
  states: {
    'whole canvas': onCanvas(),
    'piece selected': onCanvas({ selected: P.matrix }),
    empty: onCanvas({ only: [] }),
    'a plane with few cards': onCanvas({ only: [P.lunch, P.product], change: fewCards }),
    'few cards in focus': onCanvas({ focus: P.lunch, change: fewCards }),
  },
})
