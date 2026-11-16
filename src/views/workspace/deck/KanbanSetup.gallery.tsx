import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { KANBAN_TABS } from './Kanban'
import { openSetup } from '../canvas/setupStore'

export default example({
  name: 'Deck setup',
  place: 'panels/setups',
  also: ['forms/layout'],
  file: 'src/views/workspace/deck/KanbanSetup.tsx',
  note: 'a deck’s `[setup]` in focus: what it holds, its cards, columns, boxes',
  states: Object.fromEntries(KANBAN_TABS.map((tab) => [tab, onCanvas({ only: [P.deck], focus: P.deck, then: () => openSetup(P.deck, tab) })])),
})
