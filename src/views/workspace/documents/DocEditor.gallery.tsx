import { example } from '../../../gallery/example'
import { PAZAR } from '../../../gallery/canvas'
import { DOC_TEXTS } from '../../../demo/fixtures/o12'
import { DocEditor } from './DocEditor'

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

export default example({
  name: 'Document editor',
  place: 'panels/documents',
  file: 'src/views/workspace/documents/DocEditor.tsx',
  note: 'a .md written on the page as it reads (D-373): a word processor\'s tools, Markdown saved underneath',
  states: {
    'a document': () => <DocEditor text={DOC_TEXTS[interviews.title]} onSave={none} label="Document" />,
    'every kind of block': () => <DocEditor text={RICH} onSave={none} label="Document" />,
    empty: () => <DocEditor text="" onSave={none} label="Document" />,
  },
})
