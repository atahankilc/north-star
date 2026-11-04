import { example } from '../../../gallery/example'
import { PAZAR } from '../../../gallery/canvas'
import { DOC_TEXTS } from '../../../demo/fixtures/o12'
import { DocReaderView } from './DocReader'

const [, interviews] = PAZAR.documents
const none = () => {}
const body = { text: DOC_TEXTS[interviews.title] }

export default example({
  name: 'Document reader',
  place: 'panels/documents',
  file: 'src/views/workspace/documents/DocReader.tsx',
  note: "a document read in a window: the agent's open, the finder's match in a document no list shows",
  states: {
    'an editor': () => <DocReaderView d={interviews} body={body} me="demo" onClose={none} onDownload={none} onPlace={none} />,
    'a viewer': () => <DocReaderView d={interviews} body={body} me="demo" onClose={none} onDownload={none} />,
    loading: () => <DocReaderView d={interviews} body={null} loading me="demo" onClose={none} onDownload={none} onPlace={none} />,
  },
})
