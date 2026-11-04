import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { press } from '../../../gallery/docks'

const OPEN = 'button[title="which tasks it shows"]'

export default example({
  name: 'Deck filter',
  place: 'hud/docks',
  also: ['forms/filters'],
  file: 'src/views/workspace/deck/KanbanFilterDock.tsx',
  note: 'a deck’s `[filter]`: GIVEN TO, DUE, FOR, LABEL as columns (D-256, D-364); a timeline uses it too',
  states: {
    open: onCanvas({ only: [P.deck], focus: P.deck, then: () => press(OPEN) }),
    // `me` ticked: only your tasks stay, GIVEN TO's count magenta.
    'mine only': onCanvas({
      only: [P.deck],
      focus: P.deck,
      then: async () => {
        await press(OPEN)
        await press('[data-learn="filter-strip"] [data-key="me"]')
      },
    }),
    'on a timeline': onCanvas({ only: [P.deck, P.days], focus: P.days, then: () => press(OPEN) }),
  },
})
