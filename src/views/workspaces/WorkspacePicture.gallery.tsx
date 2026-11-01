import { example } from '../../gallery/example'
import { makeSummary, readSummary } from '../../model/summary'
import { WorkspacePicture } from './WorkspacePicture'

// A first canvas: two planes with cards, a deck, a table.
const pieces = [
  { id: 'a', kind: 'plane' as const, x: 0, y: 0, w: 1000, h: 650 },
  { id: 'b', kind: 'plane' as const, x: 1100, y: 0, w: 900, h: 650 },
  { id: 'c', kind: 'kanban' as const, x: 0, y: 750, w: 1000, h: 500 },
  { id: 'd', kind: 'table' as const, x: 1100, y: 750, w: 900, h: 500 },
]
const types = ['customer', 'problem', 'competitor', 'idea', 'feature'] as const
const cards = Array.from({ length: 24 }, (_, i) => ({ type: types[i % 5], pieceId: i % 3 ? 'a' : 'b', x: (i % 4) * 225, y: Math.floor(i / 4) * 125 }))
const SUMMARY = readSummary({ ...makeSummary(pieces, cards, []), by: 'u', at: 0 })

const box = { width: 'var(--size-lg)', height: 'var(--size-sm)' }

export default example({
  name: 'WorkspacePicture',
  place: 'screens/workspaces',
  file: 'src/views/workspaces/WorkspacePicture.tsx',
  note: 'a workspace’s first canvas from its summary doc (D-338): shapes only, drawn from the tokens',
  states: {
    'from a summary': () => (
      <div style={box}>
        <WorkspacePicture summary={SUMMARY} />
      </div>
    ),
    'none yet (faint)': () => (
      <div style={box}>
        <WorkspacePicture summary={null} />
      </div>
    ),
    'first visit (sample)': () => (
      <div style={box}>
        <WorkspacePicture summary={null} sample />
      </div>
    ),
  },
})
