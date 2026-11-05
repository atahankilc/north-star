import { example } from '../../../gallery/example'
import { onCanvas, P, type OnCanvas } from '../../../gallery/canvas'
import { CANVAS } from '../../../data/labels'
import { text } from '../../../demo/fixtures/kit'

// Two cards on the first plane and nothing else on it: they grow to fill it (D-363).
const fewCards: NonNullable<OnCanvas['change']> = (ws) => ({
  ...ws,
  cards: [...ws.cards.filter((c) => c.pieceId !== P.lunch), ...ws.cards.filter((c) => c.pieceId === P.lunch).slice(0, 2)],
  labels: ws.labels.filter((l) => l.pieceId !== P.lunch),
})

// A section tight round two pieces, one framed and one unframed: zoomed out their names part, the section's going out of
// it and theirs onto themselves (D-372).
const inSection: NonNullable<OnCanvas['change']> = (ws) => ({
  ...ws,
  labels: [...ws.labels, text({ id: 'sec-round', pieceId: CANVAS, kind: 'section', text: 'This week', x: -50, y: -50, w: 3600, h: 825 })],
})

// A name too long for its piece: past 70 % of the width it takes the whole top edge, as the console does the bottom (D-375).
const longName: NonNullable<OnCanvas['change']> = (ws) => ({
  ...ws,
  pieces: ws.pieces.map((p) => (p.id === P.lunch ? { ...p, name: '01 Everyone who orders lunch at the office every week' } : p)),
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
    'pieces in a section': onCanvas({ only: [P.lunch, P.matrix], open: [P.matrix], change: inSection }),
    'a long name on the whole edge': onCanvas({ only: [P.lunch, P.matrix], change: longName }),
  },
})
