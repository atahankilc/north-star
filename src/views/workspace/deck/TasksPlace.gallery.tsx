import { example } from '../../../gallery/example'
import { screen } from '../../../gallery/screens'
import { P } from '../../../gallery/canvas'
import { usePlace } from '../places/placeStore'

const open = (page: boolean) => () => usePlace.setState({ open: 'tasks', page })

export default example({
  name: 'Tasks place',
  place: 'panels/tasks',
  file: 'src/views/workspace/deck/TasksPlace.tsx',
  note: 'Tasks as a place (D-412): the canvas’s decks, mine, all · days; a deck’s real board, as the page with its days beside it',
  states: {
    'beside the canvas: mine': screen({ only: [P.lunch, P.deck], then: open(false) }),
    'as the page: a deck and its days': screen({ only: [P.lunch, P.deck, P.days], then: open(true) }),
  },
})
