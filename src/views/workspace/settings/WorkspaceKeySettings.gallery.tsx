import { example } from '../../../gallery/example'
import { PAZAR } from '../../../gallery/canvas'
import { WorkspaceKeyView } from './WorkspaceKeySettings'
import type { AiConfig } from '../../../data/workspaceKey'
import { SUGGESTED } from '../../../agent/models'
import { PEOPLE } from '../../../demo/fixtures/pazar'

const box = { width: 720, maxHeight: '78vh', overflow: 'auto', display: 'grid', gap: 'var(--space-8)' }
const ws = PAZAR.workspace
const names = new Map(Object.values(PEOPLE).map((p) => [p.uid, p.name]))
const KEYED: AiConfig = { hasKey: true, keyHint: 'sk-…9f2c', access: 'chosen', allowed: [PEOPLE.ayla.uid], allowedModels: [SUGGESTED] }
const asRole = (role: 'owner' | 'editor' | 'viewer') => ({ ...ws, roles: { ...ws.roles, demo: role } })
const view = (config: AiConfig | null, role: 'owner' | 'editor' | 'viewer' = 'owner') => (
  <div style={box}>
    <WorkspaceKeyView wid={PAZAR.wid} workspace={asRole(role)} me="demo" config={config} names={names} />
  </div>
)

export default example({
  name: 'Workspace key settings',
  place: 'overlays/settings',
  file: 'src/views/workspace/settings/WorkspaceKeySettings.tsx',
  note: "Settings → workspace → agent key (D-079, D-427): an owner's OpenAI key for everyone's agent, kept encrypted on the server; who may use it and which models it runs",
  states: {
    'owner, no key': { fixture: PAZAR, render: () => view(null) },
    'owner, a key': { fixture: PAZAR, render: () => view(KEYED) },
    'owner, everyone': { fixture: PAZAR, render: () => view({ ...KEYED, access: 'everyone' }) },
    'editor, allowed': { fixture: PAZAR, render: () => view({ ...KEYED, access: 'everyone' }, 'editor'), note: 'not an owner: whether they may, in words' },
    'editor, not allowed': { fixture: PAZAR, render: () => view({ ...KEYED, allowed: [] }, 'editor') },
    viewer: { fixture: PAZAR, render: () => view(KEYED, 'viewer') },
  },
})
