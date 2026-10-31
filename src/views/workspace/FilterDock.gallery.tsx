import { example } from '../../gallery/example'
import { onCanvas, P } from '../../gallery/canvas'
import { press } from '../../gallery/docks'

const OPEN = 'button[title="what this plane shows"]'

export default example({
  name: 'Plane filter',
  place: 'hud/docks',
  also: ['forms/filters'],
  file: 'src/views/workspace/FilterDock.tsx',
  note: 'a plane’s `[filter]`: SHOW FOR TAG REGION LINKS, only while the focus is open (D-233, D-308)',
  states: {
    closed: onCanvas({ only: [P.lunch], focus: P.lunch }),
    open: onCanvas({ only: [P.lunch], focus: P.lunch, then: () => press(OPEN) }),
    'show open': onCanvas({
      only: [P.lunch],
      focus: P.lunch,
      then: async () => {
        await press(OPEN)
        await press('[data-learn="filter-strip"] button', 'show')
      },
    }),
    'links open': onCanvas({
      only: [P.product],
      focus: P.product,
      then: async () => {
        await press(OPEN)
        await press('[data-learn="filter-strip"] button', 'links')
      },
    }),
  },
})
