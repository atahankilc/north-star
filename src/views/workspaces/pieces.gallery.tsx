import { example } from '../../gallery/example'
import type { WithId } from '../../data/hooks'
import type { Workspace } from '../../data/model'
import { setDemoGlance } from '../../data/glance'
import { makeSummary, readSummary } from '../../model/summary'
import { ContinuePiece, OtherPiece } from './pieces'

const MIN = 60_000 // tokens-ok: a minute in ms, for made-up times
const w: WithId<Workspace> = { id: 'w-p', name: 'Pazar', description: 'A marketplace for neighbourhood bazaars.', ownerId: 'demo', memberIds: ['demo', 'u1', 'u2'], roles: { demo: 'owner', u1: 'editor', u2: 'editor' }, inviteCode: 'QRSTUVWX', createdAt: 0 }
const summary = readSummary({ ...makeSummary([{ id: 'a', kind: 'plane', x: 0, y: 0, w: 1000, h: 650 }, { id: 'b', kind: 'kanban', x: 1100, y: 0, w: 900, h: 650 }], Array.from({ length: 12 }, (_, i) => ({ type: (['idea', 'problem', 'customer'] as const)[i % 3], pieceId: 'a', x: (i % 4) * 225, y: Math.floor(i / 4) * 125 })), []), by: 'u', at: 0 })
const glance = (busy: boolean) =>
  setDemoGlance({
    'w-p': busy
      ? { visited: Date.now() - 120 * MIN, summary, since: [{ by: 'u1', at: Date.now() - 40 * MIN, kinds: ['ideas'], ids: ['a', 'b', 'c'], actor: 'person' }], names: { u1: 'Ayşe' }, here: ['Ayşe'], newTasks: 2 }
      : { visited: Date.now() - 6 * 1440 * MIN, summary: null },
  })

export default example({
  name: 'Workspace pieces',
  place: 'screens/workspaces',
  file: 'src/views/workspaces/pieces.tsx',
  note: 'the continue piece and another workspace’s card (D-338), on PieceCard',
  states: {
    continue: { size: [1100, 360], render: () => (glance(true), <ContinuePiece w={w} uid="demo" visit={{ visited: Date.now() - 120 * MIN }} onOpen={() => {}} onMenu={() => {}} />) },
    'continue, nothing new': { size: [1100, 360], render: () => (glance(false), <ContinuePiece w={w} uid="demo" visit={{ visited: Date.now() - 6 * 1440 * MIN }} onOpen={() => {}} onMenu={() => {}} />) },
    other: { size: [280, 200], render: () => (glance(true), <OtherPiece w={w} n={2} uid="demo" visit={{ visited: Date.now() - 120 * MIN }} newTasks={2} onOpen={() => {}} onMenu={() => {}} />) },
    'other, empty': { size: [280, 200], render: () => (glance(false), <OtherPiece w={w} n={3} uid="demo" visit={undefined} newTasks={0} onOpen={() => {}} onMenu={() => {}} />) },
  },
})
