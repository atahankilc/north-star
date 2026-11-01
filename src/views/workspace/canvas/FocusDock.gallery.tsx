import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'

// The dock is the tab on the bottom edge's middle in a focus (D-184): each kind brings its own tools to it.
export default example({
  name: 'FocusDock',
  place: 'hud/docks',
  also: ['actions/dock actions'],
  file: 'src/views/workspace/canvas/FocusDock.tsx',
  note: 'the focus dock: a tab on the bottom edge, `[unfocus] esc` last; each piece adds its tools',
  states: {
    plane: onCanvas({ only: [P.lunch], focus: P.lunch, note: '[filter] [view ▾] [unfocus]' }),
    matrix: onCanvas({ only: [P.matrix], focus: P.matrix, note: '[setup] [unfocus]' }),
    table: onCanvas({ only: [P.table], focus: P.table }),
    deck: onCanvas({ only: [P.deck], focus: P.deck, note: 'lanes, filter, setup' }),
    timeline: onCanvas({ only: [P.deck, P.days], focus: P.days, note: 'scales, today, the deck it draws' }),
    documents: onCanvas({ only: [P.docs], focus: P.docs }),
    'plane with a piece stuck to it': onCanvas({
      only: [P.product, P.matrix],
      focus: P.product,
      change: (ws) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === P.matrix ? { ...p, stuckTo: P.product } : p)) }),
      note: '`[⇆ matrix · …]` opens it beside (D-211)',
    }),
  },
})
