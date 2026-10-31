import { example } from '../gallery/example'
import { Loading } from './Loading'

export default example({
  name: 'Loading',
  section: 'ui',
  file: 'src/ui/Loading.tsx',
  note: 'turning while full motion, still while reduced',
  states: {
    default: () => <Loading label="Loading people" />,
    long: () => <Loading label="Loading the documents you can see in this workspace" />,
  },
})
