import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { press } from '../../../gallery/docks'

export default example({
  name: 'View menu',
  place: 'overlays/menus',
  file: 'src/views/workspace/canvas/ViewMenu.tsx',
  note: 'a plane’s `[view ▾]`: guides, snapping, comments (D-231)',
  states: {
    closed: onCanvas({ only: [P.lunch], focus: P.lunch }),
    open: onCanvas({ only: [P.lunch], focus: P.lunch, then: () => press('[data-learn="dock-view"]') }),
  },
})
