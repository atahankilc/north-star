import { example } from '../../../gallery/example'
import { screen } from '../../../gallery/screens'
import { docTexts, P } from '../../../gallery/canvas'
import { usePlace } from '../places/placeStore'

const open = (page: boolean) => () => (docTexts(), usePlace.setState({ open: 'docs', page }))

export default example({
  name: 'Docs place',
  place: 'panels/documents',
  file: 'src/views/workspace/documents/DocsPlace.tsx',
  note: 'Docs as a place (D-412): every document you may see; a row opens it in the list’s place; as the page the list and the reading; write and upload in the HUD’s middle',
  states: {
    'beside the canvas': screen({ only: [P.lunch, P.docs], then: open(false) }),
    'one open in its place': screen({ only: [P.lunch, P.docs], then: async (c) => (open(false)(), await c.wait(400), c.click('[data-learn="place-docs"] [data-tone], [data-learn="place-docs"] button[class*="row"]')) }),
    'as the page': screen({ only: [P.lunch, P.docs], then: open(true) }),
  },
})
