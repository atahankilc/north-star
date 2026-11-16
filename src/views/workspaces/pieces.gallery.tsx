import { example } from '../../gallery/example'
import type { WithId } from '../../data/hooks'
import type { Workspace } from '../../data/model'
import { setDemoGlance } from '../../data/glance'
import { makeSummary, readSummary } from '../../model/summary'
import { ContinuePiece, OtherPiece } from './pieces'

const MIN = 60_000 // tokens-ok: a minute in ms, for made-up times
const w: WithId<Workspace> = { id: 'w-p', name: 'Pazar', description: 'A marketplace for neighbourhood bazaars.', ownerId: 'demo', memberIds: ['demo', 'u1', 'u2'], roles: { demo: 'owner', u1: 'editor', u2: 'editor' }, inviteCode: 'QRSTUVWX', createdAt: 0 }
const summary = readSummary({ ...makeSummary([{ id: 'a', kind: 'plane', x: 0, y: 0, w: 1000, h: 650 }, { id: 'b', kind: 'kanban', x: 1100, y: 0, w: 900, h: 650 }], Array.from({ length: 12 }, (_, i) => ({ type: (['idea', 'problem', 'customer'] as const)[i % 3], pieceId: 'a', x: (i % 4) * 225, y: Math.floor(i / 4) * 125 })), []), by: 'u', at: 0 })
// busy: changed since you left, someone in it; quiet: pictured, nothing new; empty: nothing pictured.
const glance = (how: 'busy' | 'quiet' | 'empty') =>
  setDemoGlance({
    'w-p':
      how === 'busy'
        ? {
            visited: Date.now() - 120 * MIN,
            summary,
            since: [
              { by: 'u1', at: Date.now() - 40 * MIN, kinds: ['ideas'], ids: ['a', 'b', 'c'], actor: 'person' },
              { by: 'u2', at: Date.now() - 70 * MIN, kinds: ['tasks'], ids: ['a', 'b'], actor: 'person' },
            ],
            names: { u1: 'Ayşe', u2: 'Mert' },
            here: ['Ayşe'],
            newTasks: 2,
          }
        : how === 'quiet'
          ? { visited: Date.now() - 6 * 1440 * MIN, summary }
          : { visited: Date.now() - 6 * 1440 * MIN, summary: null },
  })

export default example({
  name: 'Workspace pieces',
  place: 'screens/workspaces',
  file: 'src/views/workspaces/pieces.tsx',
  note: 'the continue card and another workspace’s card (D-338, D-390), on PieceCard: who changed what in their colour, what waits for you in words, who’s in it now',
  states: {
    continue: { size: [1100, 360], render: () => (glance('busy'), <ContinuePiece w={w} uid="demo" visit={{ visited: Date.now() - 120 * MIN }} newTasks={2} asking={1} onOpen={() => {}} onMenu={() => {}} />) },
    'continue, nothing new': { size: [1100, 360], render: () => (glance('quiet'), <ContinuePiece w={w} uid="demo" visit={{ visited: Date.now() - 6 * 1440 * MIN }} onOpen={() => {}} onMenu={() => {}} />) },
    'other, changed since you left': { size: [560, 260], note: 'two columns wide on the page: its picture, then who changed what', render: () => (glance('busy'), <OtherPiece w={w} uid="demo" visit={{ visited: Date.now() - 120 * MIN }} newTasks={2} asking={1} onOpen={() => {}} onMenu={() => {}} />) },
    other: { size: [280, 260], render: () => (glance('quiet'), <OtherPiece w={w} uid="demo" visit={{ visited: Date.now() - 6 * 1440 * MIN }} newTasks={0} onOpen={() => {}} onMenu={() => {}} />) },
    'other, nothing pictured': { size: [280, 260], render: () => (glance('empty'), <OtherPiece w={w} uid="demo" visit={undefined} newTasks={0} onOpen={() => {}} onMenu={() => {}} />) },
  },
})
