import { example } from '../../gallery/example'
import { onCanvas, P } from '../../gallery/canvas'

export default example({
  name: 'Links',
  place: 'canvas/cards',
  file: 'src/views/workspace/PlaneLinks.tsx',
  note: 'links between cards: straight, kind colours, a chip (D-207); `for` and `relates` shown for the picked card',
  states: {
    'in focus': onCanvas({ only: [P.lunch], focus: P.lunch }),
    'link picked': onCanvas({ only: [P.lunch], focus: P.lunch, link: 'e-7', note: 'its bar: kind, label, reverse, remove' }),
    'card picked: its for links': onCanvas({ only: [P.lunch], focus: P.lunch, card: 'r-greasy' }),
  },
})
