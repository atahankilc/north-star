import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { press } from '../../../gallery/docks'

export default example({
  name: 'View drawer',
  place: 'hud/docks',
  file: 'src/views/workspace/canvas/ViewMenu.tsx',
  note: 'a plane’s `view`: a tab of the dock whose drawer (guides, snapping, comments) opens as its upper floor (D-231, D-347)',
  states: {
    closed: onCanvas({ only: [P.lunch], focus: P.lunch }),
    open: onCanvas({ only: [P.lunch], focus: P.lunch, then: () => press('[data-learn="dock-view"]') }),
  },
})
