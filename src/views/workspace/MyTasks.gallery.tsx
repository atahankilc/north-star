import { example } from '../../gallery/example'
import { PAZAR } from '../../gallery/canvas'
import { DEMO_DAY } from '../../demo/clock'
import { TasksButton } from './MyTasks'

type Ws = typeof PAZAR
// Two of the deck's tasks given to you a moment ago by Ayla: the `☐ 2` by your square (D-261).
const given = (ws: Ws): Ws => ({
  ...ws,
  tasks: ws.tasks.map((t) => (t.id === 'tk-plan' || t.id === 'tk-shelf' ? { ...t, assignee: 'demo', assigneeName: 'You', givenAt: DEMO_DAY - 60_000, givenBy: 'u-ayla' } : t)),
})

export default example({
  name: 'Tasks button',
  place: 'hud/corner',
  file: 'src/views/workspace/MyTasks.tsx',
  note: 'the side nav’s tasks button: shown with a deck or timeline on the canvas; it counts tasks given to you since you last looked',
  states: {
    'given to you': { fixture: given(PAZAR), render: () => <TasksButton /> },
    'nothing new': { fixture: PAZAR, render: () => <TasksButton /> },
    'no deck': { fixture: { ...PAZAR, pieces: PAZAR.pieces.filter((p) => p.kind !== 'kanban' && p.kind !== 'timeline') }, render: () => <TasksButton />, note: 'hidden: no deck or timeline on the canvas' },
  },
})
