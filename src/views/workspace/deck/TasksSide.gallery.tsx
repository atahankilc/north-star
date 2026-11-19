import { example } from '../../../gallery/example'
import { P } from '../../../gallery/canvas'
import { screen } from '../../../gallery/screens'
import { openTasks, toggleTasksFrom, usePlace } from '../places/placeStore'

// Tasks' parts in Tasks (D-419): what the old side view's states became.
const tasks = (tab: string, days = false, page = false) => () => {
  openTasks(tab, days)
  usePlace.setState({ page })
}

export default example({
  name: 'Tasks parts',
  place: 'panels/tasks',
  also: ['hud/navigation'],
  file: 'src/views/workspace/deck/TasksSide.tsx',
  note: "a deck's board and its days, mine, all · days, drawn in Tasks (D-412, D-419; the tasks side view, D-300, before)",
  states: {
    'a deck': screen({ only: [P.lunch, P.product, P.deck], then: tasks(P.deck) }),
    'a deck and its days (the page)': screen({ only: [P.lunch, P.product, P.deck], then: tasks(P.deck, true, true) }),
    mine: screen({ only: [P.lunch, P.product, P.deck], then: tasks('mine') }),
    'all · days': screen({ only: [P.lunch, P.product, P.deck], then: tasks('all') }),
    'a plane in focus, its deck linked': screen({ only: [P.lunch, P.deck], focus: P.lunch, then: () => toggleTasksFrom(P.lunch, P.deck) }),
  },
})
