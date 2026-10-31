import { example } from '../../gallery/example'
import { PAZAR } from '../../gallery/canvas'
import { PeopleSettings } from './PeopleSettings'
import type { JoinRequest } from '../../data/model'
import type { WithId } from '../../data/hooks'

const AT = Date.UTC(2026, 9, 20, 7, 0)
const REQUESTS: WithId<JoinRequest>[] = [
  { id: 'rq-1', workspaceId: PAZAR.wid, uid: 'u-mert', name: 'Mert Yılmaz', email: 'mert@example.com', code: 'ABC123', createdAt: AT },
  { id: 'rq-2', workspaceId: PAZAR.wid, uid: 'u-sofia', name: 'Sofia Rossi', email: 'sofia@example.com', code: 'ABC123', createdAt: AT - 3600_000 },
]
const box = { width: 720, maxHeight: '78vh', overflow: 'auto' }

export default example({
  name: 'People settings',
  place: 'overlays/settings',
  file: 'src/views/workspace/PeopleSettings.tsx',
  note: 'Settings → people (D-062, D-098): members, requests, invites, the code; members come from Firestore, so the gallery’s list is empty',
  states: {
    owner: { fixture: PAZAR, render: () => <div style={box}><PeopleSettings wid={PAZAR.wid} workspace={PAZAR.workspace} requests={REQUESTS} /></div> },
    'owner, no requests': { fixture: PAZAR, render: () => <div style={box}><PeopleSettings wid={PAZAR.wid} workspace={{ ...PAZAR.workspace, inviteCode: 'K7Q2MX', invitedEmails: ['jo@example.com'] }} requests={[]} /></div> },
    editor: { fixture: PAZAR, render: () => <div style={box}><PeopleSettings wid={PAZAR.wid} workspace={{ ...PAZAR.workspace, ownerId: 'u-ayla', roles: { ...PAZAR.workspace.roles, demo: 'editor', 'u-ayla': 'owner' } }} requests={REQUESTS} /></div>, note: 'not an owner: no requests, no code' },
  },
})
