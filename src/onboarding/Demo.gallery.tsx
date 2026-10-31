import { example } from '../gallery/example'
import { Fresh } from '../gallery/onboarding'
import { Demo } from './Demo'

export default example({
  name: 'Demo',
  place: 'onboarding/lessons',
  also: ['motion/loops'],
  file: 'src/onboarding/Demo.tsx',
  note: 'a lesson’s demo: the real components on made-up data in a sealed frame (demo.html), looping; still under reduced motion',
  states: {
    'plane drag': () => <Fresh><Demo scene="plane-drag" width={480} label="drag a plane" own /></Fresh>,
    'canvas fit': () => <Fresh><Demo scene="canvas-fit" width={480} label="fit" own /></Fresh>,
    compact: () => <Fresh><Demo scene="deck-drag" width={320} label="move a task" compact own /></Fresh>,
  },
})
