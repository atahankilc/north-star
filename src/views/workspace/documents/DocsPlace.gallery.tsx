import { example } from '../../../gallery/example'
import { screen } from '../../../gallery/screens'
import { docTexts, P } from '../../../gallery/canvas'
import { usePlace } from '../places/placeStore'
import { useDocsAt } from './DocsPlace'

const open = (page: boolean) => () => (docTexts(), usePlace.setState({ open: 'docs', page }))

export default example({
  name: 'Docs place',
  place: 'panels/documents',
  file: 'src/views/workspace/documents/DocsPlace.tsx',
  note: 'Docs as a place (D-412), in folders (D-415): every document you may see; a row opens it in the list’s place; as the page the list and the reading; write and upload in the HUD’s middle',
  states: {
    'beside the canvas': screen({ only: [P.lunch, P.docs], then: open(false) }),
    'in a folder': screen({ only: [P.lunch, P.docs], then: () => (open(false)(), useDocsAt.setState({ folder: 'f-pilot' })) }),
    'one open in its place': screen({ only: [P.lunch, P.docs], then: () => (open(false)(), useDocsAt.setState({ folder: 'f-research', open: 'doc-interviews' })) }),
    'as the page': screen({ only: [P.lunch, P.docs], then: () => (open(true)(), useDocsAt.setState({ folder: 'f-research' })) }),
    'as the page, one read': screen({ only: [P.lunch, P.docs], then: () => (open(true)(), useDocsAt.setState({ folder: 'f-research', open: 'doc-interviews' })) }),
  },
})
