import { example } from '../../gallery/example'
import { onCanvas, P, PAZAR } from '../../gallery/canvas'

const shelf = (ws: typeof PAZAR) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === P.docs ? { ...p, documents: { ...p.documents!, view: 'shelf' as const } } : p)) })

export default example({
  name: 'Documents',
  section: 'canvas',
  file: 'src/views/workspace/Documents.tsx',
  note: 'the documents you can see, as a table or a shelf (D-232)',
  states: {
    'on the canvas': onCanvas({ only: [P.docs] }),
    'in focus': onCanvas({ only: [P.docs], focus: P.docs }),
    shelf: onCanvas({ only: [P.docs], change: shelf }),
    'shelf in focus': onCanvas({ only: [P.docs], change: shelf, focus: P.docs }),
    unframed: onCanvas({ only: [P.docs], open: [P.docs] }),
  },
})
