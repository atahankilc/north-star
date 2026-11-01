import { example } from '../../../gallery/example'
import { P } from '../../../gallery/canvas'
import { screen } from '../../../gallery/screens'
import { useTasksSide } from './sideState'
import { useCanvasView } from '../../../state/canvasView'

const side = (tab: string, days = false) => () => {
  useCanvasView.setState({ split: 0.42 })
  useTasksSide.setState({ open: true, tab, days, linked: null, taskFull: false })
}

export default example({
  name: 'Tasks side view',
  place: 'panels/tasks',
  also: ['hud/navigation'],
  file: 'src/views/workspace/deck/TasksSide.tsx',
  note: 'decks and days in one side view: plane → deck → days (D-300, D-314)',
  states: {
    'a deck': screen({ only: [P.lunch, P.product, P.deck], then: side(P.deck) }),
    'a deck and its days': screen({ only: [P.lunch, P.product, P.deck], then: side(P.deck, true) }),
    mine: screen({ only: [P.lunch, P.product, P.deck], then: side('mine') }),
    'all · days': screen({ only: [P.lunch, P.product, P.deck], then: side('all') }),
    'beside a plane in focus': screen({ only: [P.lunch, P.deck], focus: P.lunch, then: side(P.deck) }),
  },
})
