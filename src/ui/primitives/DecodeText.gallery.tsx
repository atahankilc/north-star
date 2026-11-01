import { example } from '../../gallery/example'
import { DecodeText } from './DecodeText'

export default example({
  name: 'DecodeText',
  place: 'motion/text',
  also: ['text/animated'],
  file: 'src/ui/primitives/DecodeText.tsx',
  note: 'text decoding in (260 ms); press \\ to play it again',
  states: {
    default: () => <DecodeText text="DELETE THIS PLANE?" />,
    slow: { render: () => <DecodeText text="DELETE THIS PLANE?" duration={1600} />, note: '1600 ms, to watch it' },
    long: () => <DecodeText text="Cards, links and text on this plane go with it." duration={900} />,
  },
})
