import { example } from '../../gallery/example'
import { onCanvas, P } from '../../gallery/canvas'
import { useKanbanUi } from '../../views/workspace/Kanban'

const open = (task: string) => () => useKanbanUi.setState({ selected: { piece: P.deck, task } })

export default example({
  name: 'Task panel',
  place: 'panels/tasks',
  file: 'src/views/workspace/TaskPanel.tsx',
  note: 'a task’s right panel: given to, due, card, checklist, notes (D-251)',
  states: {
    'with checklist': onCanvas({ only: [P.deck], focus: P.deck, then: open('tk-cooks') }),
    'given to you': onCanvas({ only: [P.deck], focus: P.deck, then: open('tk-cutoff') }),
    'no one, no card': onCanvas({ only: [P.deck], focus: P.deck, then: open('tk-plan') }),
    'on the canvas': onCanvas({ only: [P.deck], then: open('tk-permit'), note: 'opened from a deck on the canvas, not in focus' }),
  },
})
