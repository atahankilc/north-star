// The agent's env on the server (D-434, docs/specs/agent-server.md §5): what the loop may touch there. It reads the
// workspace as the person, keeps the pending changes, and NEVER writes: `apply` refuses, whatever asks. The person
// accepts the changes in their own tab, as themselves.
import type { AgentEnv, UiFacade } from '../../../src/agent/contract'
import { emptyChangeset, type Changeset } from '../../../src/agent/changeset'
import type { Job } from '../../../src/agent/job'
import { makeIds, type IdsState } from '../../../src/agent/read'
import { autoId } from '../../../src/ops/newId'
import type { Role } from './membership'
import { serverRender } from './render'
import type { ServerWorkspace } from './workspace'

// What a run keeps between two steps beside the loop's own state (loop.ts' TurnState), as plain data.
export type EnvState = { changes: Changeset; ids: IdsState; job: Job | null }

export type ServerEnv = AgentEnv & { state: () => EnvState }

export function serverEnv(o: { ws: ServerWorkspace; uid: string; name?: string; role: Role; chatId: string; ui: UiFacade; was?: EnvState; now?: () => number; render?: AgentEnv['render'] }): ServerEnv {
  let job: Job | null = o.was?.job ?? null
  const ids = makeIds(o.was?.ids)
  const env: ServerEnv = {
    getWs: o.ws.get,
    apply: async () => ({ ok: false, errors: [{ op: 'apply', message: 'the agent on the server proposes changes; only the person applies them', fix: 'propose them with change' }] }),
    actor: { uid: o.uid, role: o.role, agent: true, ...(o.name ? { name: o.name } : {}) },
    ids,
    ui: o.ui,
    now: o.now ?? (() => Date.now()),
    newId: () => autoId(),
    chatId: o.chatId,
    changes: o.was?.changes ?? emptyChangeset(),
    job: { get: () => job, set: (j) => void (job = j) },
    render: o.render ?? serverRender,
    loadBody: async (id) => void (await o.ws.loadBody(id)),
    state: () => ({ changes: env.changes ?? emptyChangeset(), ids: ids.toJSON(), job }),
  }
  return env
}
