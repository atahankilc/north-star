import { example } from '../../../gallery/example'
import { P } from '../../../gallery/canvas'
import { screen, twoCanvases } from '../../../gallery/screens'

export default example({
  name: 'Workspace screen',
  place: 'screens/workspace',
  file: 'src/views/workspace/canvas/WorkspaceLayout.tsx',
  note: 'the whole screen as WorkspaceLayout puts it together (assembled as the demo’s CanvasScreen: it loads from Firestore itself); THEME switches light',
  states: {
    canvas: screen(),
    'plane in focus': screen({ focus: P.lunch }),
    'card picked': screen({ focus: P.lunch, card: 'i-preorder' }),
    'several canvases': { ...screen({ change: twoCanvases }), note: 'the breadcrumb names the canvas (D-302)' },
    'edit mode': screen({ edit: [P.matrix], selected: P.matrix }),
  },
})
