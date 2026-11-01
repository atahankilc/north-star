import { example, type GalleryCtx } from '../../gallery/example'
import { usePresence, type Peer } from '../../data/presence'
import { PeopleHere } from './PeopleHere'

const COLORS = ['#ff3d9a', '#2de2e6', '#ffd23f', '#3d7bff', '#3dff8a']
const NAMES = ['Bob', 'Carol', 'Deniz', 'Elif', 'Fatih', 'Gül']
const peers = (n: number): Peer[] => NAMES.slice(0, n).map((name, i) => ({ uid: `p${i}`, name, color: COLORS[i % COLORS.length], view: 'canvas', ts: 0, plane: i === 1 ? 'pazar' : undefined }))
// `away`: how many of the last are away (D-331); they sort last, as presence.ts gives them.
const withPeers = (n: number, follow?: string, away = 0) => (_c: GalleryCtx) =>
  usePresence.setState({ peers: peers(n).map((p, i) => (i >= n - away ? { ...p, away: true } : p)), following: follow ?? null })

export default example({
  name: 'PeopleHere',
  place: 'hud/presence',
  file: 'src/ui/patterns/PeopleHere.tsx',
  note: 'squares, never names (D-169); hover shows who and where; away faint and last (D-331)',
  states: {
    one: { render: () => <PeopleHere />, setup: withPeers(1) },
    three: { render: () => <PeopleHere />, setup: withPeers(3) },
    'more than four': { render: () => <PeopleHere />, setup: withPeers(6) },
    following: { render: () => <PeopleHere />, setup: withPeers(3, 'p1') },
    'one away': { render: () => <PeopleHere />, setup: withPeers(3, undefined, 1) },
    'away in the list': { render: () => <PeopleHere />, setup: withPeers(6, undefined, 2) },
    'all away': { render: () => <PeopleHere />, setup: withPeers(2, undefined, 2) },
    nobody: () => <PeopleHere />,
  },
})
