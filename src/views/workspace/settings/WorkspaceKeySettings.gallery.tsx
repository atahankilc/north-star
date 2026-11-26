import { example } from '../../../gallery/example'
import { PAZAR } from '../../../gallery/canvas'
import { WorkspaceKeyView } from './WorkspaceKeySettings'
import type { AiConfig, Spend } from '../../../data/workspaceKey'
import { SUGGESTED } from '../../../agent/models'
import { PEOPLE } from '../../../demo/fixtures/pazar'

const box = { width: 720, maxHeight: '78vh', overflow: 'auto', display: 'grid', gap: 'var(--space-8)' }
const ws = PAZAR.workspace
const names = new Map(Object.values(PEOPLE).map((p) => [p.uid, p.name]))
const KEYED: AiConfig = { hasKey: true, keyHint: 'sk-…9f2c', access: 'chosen', allowed: [PEOPLE.ayla.uid], allowedModels: [SUGGESTED] }
const asRole = (role: 'owner' | 'editor' | 'viewer') => ({ ...ws, roles: { ...ws.roles, demo: role } })
// A month's use (D-434): micro-dollars, as the ledger keeps them.
const SPEND: Spend[] = [
  { uid: null, spent: 6_100_000, reserved: 0, calls: 51 },
  { uid: PEOPLE.ayla.uid, spent: 3_290_000, reserved: 0, calls: 30 },
  { uid: 'demo', spent: 2_810_000, reserved: 120_000, calls: 21 },
]
const LIMITED: AiConfig = { ...KEYED, limits: { person: 300, total: 1000 } }
const view = (config: AiConfig | null, role: 'owner' | 'editor' | 'viewer' = 'owner', spend: Spend[] = []) => (
  <div style={box}>
    <WorkspaceKeyView wid={PAZAR.wid} workspace={asRole(role)} me="demo" config={config} names={names} spend={spend} />
  </div>
)

export default example({
  name: 'Workspace key settings',
  place: 'overlays/settings',
  file: 'src/views/workspace/settings/WorkspaceKeySettings.tsx',
  note: "Settings → workspace → agent key (D-079, D-427, D-434): an owner's OpenAI key for everyone's agent, kept encrypted on the server; who may use it, which models it runs, its month's limits and this month's use",
  states: {
    'owner, no key': { fixture: PAZAR, render: () => view(null) },
    'owner, a key': { fixture: PAZAR, render: () => view(KEYED) },
    'owner, everyone': { fixture: PAZAR, render: () => view({ ...KEYED, access: 'everyone' }) },
    'owner, limits and a month': { fixture: PAZAR, render: () => view(LIMITED, 'owner', SPEND), note: "the month's limits typed where shown; this month by person, in euros" },
    'editor, near the limit': { fixture: PAZAR, render: () => view({ ...LIMITED, access: 'everyone' }, 'editor', SPEND), note: 'their own use of their limit' },
    'editor, allowed': { fixture: PAZAR, render: () => view({ ...KEYED, access: 'everyone' }, 'editor'), note: 'not an owner: whether they may, in words' },
    'editor, not allowed': { fixture: PAZAR, render: () => view({ ...KEYED, allowed: [] }, 'editor') },
    viewer: { fixture: PAZAR, render: () => view(KEYED, 'viewer') },
  },
})
