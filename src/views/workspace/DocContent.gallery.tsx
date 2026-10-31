import { example } from '../../gallery/example'
import { PAZAR } from '../../gallery/canvas'
import { DOC_TEXTS } from '../../demo/fixtures/o12'
import { DocContent } from './DocContent'

const [pilot, interviews] = PAZAR.documents
const box = { width: 640, maxHeight: '75vh', overflow: 'auto' }
const text = (d: typeof pilot) => DOC_TEXTS[d.title]

export default example({
  name: 'Document text',
  place: 'panels/documents',
  also: ['text/markdown'],
  file: 'src/views/workspace/DocContent.tsx',
  note: 'a document as it reads: its eyebrow, title and body (D-232)',
  states: {
    markdown: () => <div style={box}><DocContent d={interviews} body={{ text: text(interviews) }} me="demo" /></div>,
    'by you, private': () => <div style={box}><DocContent d={{ ...pilot, uid: 'demo', shared: false }} body={{ text: text(pilot) }} me="demo" links /></div>,
    loading: () => <div style={box}><DocContent d={interviews} body={null} loading me="demo" /></div>,
  },
})
