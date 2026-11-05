import { example } from '../../../gallery/example'
import { PAZAR } from '../../../gallery/canvas'
import { DOC_TEXTS } from '../../../demo/fixtures/o12'
import { accents } from '../../../styles/tokens'
import type { Peer } from '../../../data/presence'
import { DocReaderView } from './DocReader'

const [, interviews] = PAZAR.documents
const none = () => {}
const body = { text: DOC_TEXTS[interviews.title] }
// Two others writing in it (D-374): their squares at the end of its head line, one of them away.
const writer = (uid: string, name: string, color: string, away?: true): Peer => ({ uid, name, color, view: 'canvas', ts: 0, doc: { id: interviews.id }, away })
const writers = [writer('bob', 'Bob', accents[1]), writer('carol', 'Carol', accents[2], true)]

export default example({
  name: 'Document reader',
  place: 'panels/documents',
  file: 'src/views/workspace/documents/DocReader.tsx',
  note: "a document read in a window: the agent's open, the finder's match in a document no list shows; beside the agent's column, docked (D-382): its draft read before it's made, then the document made",
  states: {
    'an editor': () => <DocReaderView d={interviews} body={body} me="demo" onClose={none} onDownload={none} onPlace={none} />,
    'a viewer': () => <DocReaderView d={interviews} body={body} me="demo" onClose={none} onDownload={none} />,
    'two others writing in it': () => <DocReaderView d={interviews} body={body} me="demo" onClose={none} onDownload={none} onPlace={none} onEdit={none} onSave={none} writers={writers} />,
    "beside the agent: its draft, before it's made": () => <DocReaderView d={{ ...interviews, origin: 'assistant' }} body={body} me="demo" onClose={none} onDownload={none} draft docked />,
    'beside the agent: the document made': () => <DocReaderView d={{ ...interviews, origin: 'assistant' }} body={body} me="demo" onClose={none} onDownload={none} onPlace={none} onEdit={none} onSave={none} docked />,
    loading: () => <DocReaderView d={interviews} body={null} loading me="demo" onClose={none} onDownload={none} onPlace={none} />,
  },
})
