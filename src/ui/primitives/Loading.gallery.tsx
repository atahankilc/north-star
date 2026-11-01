import { example } from '../../gallery/example'
import { Loading } from './Loading'

export default example({
  name: 'Loading',
  place: 'feedback/loading',
  also: ['motion/loops'],
  file: 'src/ui/primitives/Loading.tsx',
  note: 'turning while full motion, still while reduced',
  states: {
    default: () => <Loading label="Loading people" />,
    long: () => <Loading label="Loading the documents you can see in this workspace" />,
  },
})
