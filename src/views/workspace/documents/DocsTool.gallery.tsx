import { useEffect } from 'react'
import { example } from '../../../gallery/example'
import { PAZAR } from '../../../gallery/canvas'
import { usePlace } from '../places/placeStore'
import { DocsTool } from './DocsTool'

// Docs open while shown.
function Open() {
  useEffect(() => usePlace.setState({ open: 'docs' }), [])
  return <DocsTool />
}

export default example({
  name: 'DocsTool',
  place: 'hud/corner',
  file: 'src/views/workspace/documents/DocsTool.tsx',
  note: 'Docs’ button at the HUD’s foot, under Talk and Tasks (D-412): lit while Docs is open beside the canvas or as the page',
  states: {
    closed: { fixture: PAZAR, render: () => <DocsTool /> },
    open: { fixture: PAZAR, render: () => <Open /> },
  },
})
