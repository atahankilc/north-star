import { example } from '../../../gallery/example'
import { P } from '../../../gallery/canvas'
import { screen, twoCanvases } from '../../../gallery/screens'

export default example({
  name: 'Workspace screen',
  place: 'screens/workspace',
  file: 'src/views/workspace/canvas/WorkspaceScreen.tsx',
  note: 'the whole screen: the HUD over the canvas shown, and the finder (D-397: the one the app, a lesson’s demo and this page mount; WorkspaceLayout loads the workspace and adds a document’s window, the toast and the coach); THEME switches light',
  states: {
    canvas: screen(),
    'plane in focus': screen({ focus: P.lunch }),
    'card picked': screen({ focus: P.lunch, card: 'i-preorder' }),
    'several canvases': { ...screen({ change: twoCanvases }), note: 'the breadcrumb names the canvas (D-302)' },
    'edit mode': screen({ edit: [P.matrix], selected: P.matrix }),
  },
})
