import { example } from '../../../gallery/example'
import { onCanvas, P, PAZAR } from '../../../gallery/canvas'
import { lensFixture, PLANE_F, TABLE_F } from '../../../demo/fixtures/kit'
import { useCanvasView } from '../../../state/canvasView'

const route = (plane: string, beside: string) => `/workspaces/${PAZAR.wid}?focus=${plane}&beside=${beside}`
// The deck stuck to 01 Lunch, as the side view's `⇆ deck` would have it.
const deckStuck = (ws: typeof PAZAR) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === P.deck ? { ...p, stuckTo: P.lunch } : p)) })
const split = (v: number) => () => void useCanvasView.setState({ split: v })

export default example({
  name: 'Beside',
  place: 'canvas/focus',
  file: 'src/views/workspace/canvas/Beside.tsx',
  note: 'a piece stuck to a plane, opened beside its focus: the screen split, each part its own view and dock (D-211)',
  states: {
    'table beside': { ...onCanvas({ change: () => lensFixture(true), only: [PLANE_F, TABLE_F], focus: PLANE_F, then: split(0.5) }), route: route(PLANE_F, TABLE_F) },
    'matrix beside': {
      ...onCanvas({ change: (ws) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === P.matrix ? { ...p, stuckTo: P.product } : p)) }), only: [P.product, P.matrix], focus: P.product, then: split(0.5) }),
      route: route(P.product, P.matrix),
    },
    'wide split': { ...onCanvas({ change: () => lensFixture(true), only: [PLANE_F, TABLE_F], focus: PLANE_F, then: split(0.7) }), route: route(PLANE_F, TABLE_F) },
    'deck stuck: in focus': { ...onCanvas({ change: deckStuck, only: [P.lunch, P.deck], focus: P.lunch }), note: 'its `[⇆ deck · 05 Launch]` in the dock' },
  },
})
