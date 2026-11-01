import { example } from '../../../gallery/example'
import { P } from '../../../gallery/canvas'
import { screen } from '../../../gallery/screens'

export default example({
  name: 'Side nav',
  place: 'hud/navigation',
  file: 'src/views/workspace/canvas/SideNav.tsx',
  note: 'the left side nav: `+`, fit, find, the side view (D-176, D-178)',
  states: {
    tools: screen(),
    '+ open': { ...screen({ then: (c) => c.click('button[data-learn="plus"]') }), note: 'the `+` menu: what it puts at the screen’s middle' },
    'in focus': { ...screen({ focus: P.lunch }), note: 'in a focus the `+` adds to the plane, fit fits the plane' },
    'in focus, + open': screen({ focus: P.lunch, then: (c) => c.click('button[data-learn="plus"]') }),
  },
})
