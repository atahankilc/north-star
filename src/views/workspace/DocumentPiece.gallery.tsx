import { example } from '../../gallery/example'
import { docTexts, onCanvas, PAZAR } from '../../gallery/canvas'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'

const AT = PAZAR.workspace.createdAt + 9 * 24 * 3600 * 1000
const DOC: WithId<Piece> = { id: 'doc-piece', kind: 'document', docId: 'doc-interviews', x: 0, y: 0, w: 600, h: 375, name: '08 Interviews', createdAt: AT, updatedAt: AT }
const add = (ws: typeof PAZAR) => ({ ...ws, pieces: [...ws.pieces, DOC] })

export default example({
  name: 'Document',
  place: 'canvas/pieces',
  file: 'src/views/workspace/DocumentPiece.tsx',
  note: 'one document in a window; its text drawn by the gallery (no Firestore to load it from)',
  states: {
    'on the canvas': onCanvas({ only: [DOC.id], change: add, then: () => docTexts() }),
    'in focus': onCanvas({ only: [DOC.id], change: add, focus: DOC.id, then: () => docTexts() }),
    unframed: onCanvas({ only: [DOC.id], change: add, open: [DOC.id], then: () => docTexts() }),
  },
})
