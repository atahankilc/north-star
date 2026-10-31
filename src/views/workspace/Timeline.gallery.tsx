import { example } from '../../gallery/example'
import { onCanvas, P } from '../../gallery/canvas'

export default example({
  name: 'Timeline',
  section: 'canvas',
  file: 'src/views/workspace/Timeline.tsx',
  note: 'the days of a deck: start to due, a ◆ for a due day alone, late hatched to today (D-304); today is 20 Oct 2026 here',
  states: {
    // A timeline is always the days of something (D-314): with no deck on the canvas it has no tasks to show.
    'on the canvas': onCanvas({ only: [P.deck, P.days] }),
    'in focus': onCanvas({ only: [P.deck, P.days], focus: P.days }),
    unframed: onCanvas({ only: [P.deck, P.days], open: [P.days] }),
    'no deck': onCanvas({ only: [P.days], note: 'nothing to show: a timeline draws a deck’s tasks' }),
  },
})
