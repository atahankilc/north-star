import * as Y from 'yjs'
import { example } from '../../../gallery/example'
import { PAZAR } from '../../../gallery/canvas'
import { DOC_TEXTS } from '../../../demo/fixtures/o12'
import { memoryHub } from '../../../data/liveMemory'
import { encodePosition } from '../../../data/liveText'
import { accents } from '../../../styles/tokens'
import { themeAccent } from '../../../state/theme'
import { DocEditor, seedOf, type LiveCaret, type LiveSetup } from './DocEditor'

const [, interviews] = PAZAR.documents
const none = () => {}
const RICH = `## What we heard

Six owners, **two** of them *twice*. One said \`same-day\` matters most.

- Price first
- Then speed
  - same day, if possible

- [x] Book the interviews
- [ ] Write them up

> "We'd switch tomorrow."

| Owner | City | Switch? |
| --- | --- | --- |
| Ayşe | Berlin | yes |
| Jonas | Hamburg | maybe |

See [the notes](https://example.com).
`

const TOGETHER = `Six owners, two of them twice. One said same-day matters most.

Price first, then speed.`

// Written together (D-374): an in-memory channel already holding the text, and two others' carets in it (a fake
// presence): Bob's caret in the first line, Carol's selection over "price first" (in the second paragraph).
function together(): LiveSetup {
  const s = seedOf(TOGETHER)
  const hub = memoryHub({ s, v: 0 })
  const doc = new Y.Doc()
  Y.applyUpdate(doc, s)
  const frag = doc.getXmlFragment('default')
  const textIn = (n: number) => (frag.get(n) as Y.XmlElement).get(0) as Y.XmlText
  const at = (n: number, i: number) => encodePosition(Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(textIn(n), i)))
  const carets: LiveCaret[] = [
    { uid: 'bob', name: 'Bob', color: themeAccent(accents[1]), a: at(0, 11), h: at(0, 11) },
    { uid: 'carol', name: 'Carol', color: themeAccent(accents[2]), a: at(1, 0), h: at(1, 11) },
  ]
  return {
    transport: () => hub.transport(),
    user: { name: 'Alice', color: themeAccent(accents[0]) },
    carets: { list: () => carets, listen: () => none, here: none, gone: none },
  }
}

export default example({
  name: 'Document editor',
  place: 'panels/documents',
  file: 'src/views/workspace/documents/DocEditor.tsx',
  note: "a .md written on the page as it reads (D-373): a word processor's tools, Markdown saved underneath; written together, others' carets in their colour (D-374)",
  states: {
    'a document': () => <DocEditor text={DOC_TEXTS[interviews.title]} onSave={none} label="Document" />,
    'every kind of block': () => <DocEditor text={RICH} onSave={none} label="Document" />,
    empty: () => <DocEditor text="" onSave={none} label="Document" />,
    'written together, two others here': () => <DocEditor text={TOGETHER} onSave={none} label="Document" live={together()} />,
  },
})
