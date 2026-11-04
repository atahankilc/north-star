import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { press } from '../../../gallery/docks'

const OPEN = 'button[title="what this plane shows"]'

export default example({
  name: 'Plane filter',
  place: 'hud/docks',
  also: ['forms/filters'],
  file: 'src/views/workspace/canvas/FilterDock.tsx',
  note: 'a plane’s `[filter]`: SHOW FOR TAG REGION LINKS as columns of tick rows (D-364), only while the focus is open (D-233, D-308)',
  states: {
    closed: onCanvas({ only: [P.lunch], focus: P.lunch }),
    open: onCanvas({ only: [P.lunch], focus: P.lunch, then: () => press(OPEN) }),
    // Ideas unticked: the ideas go, SHOW's count turns magenta.
    'ideas hidden': onCanvas({
      only: [P.lunch],
      focus: P.lunch,
      then: async () => {
        await press(OPEN)
        await press('[data-learn="filter-strip"] [data-key="idea"]')
      },
    }),
    'with links': onCanvas({ only: [P.product], focus: P.product, then: () => press(OPEN) }),
  },
})
