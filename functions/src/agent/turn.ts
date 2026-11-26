// One turn of the agent on the server (D-434, docs/specs/agent-server.md §5): the same loop the tab and the evals run,
// over the workspace read as the person, kept after every step so a run whose worker dies goes on from its last step.
// What starts it, leases it, streams it and stores it is the worker's (P2); this knows neither Cloud Tasks nor RTDB.
import type { Firestore } from 'firebase-admin/firestore'
import { runTurn, type LoopEvent, type TurnOpts, type TurnResult, type TurnState } from '../../../src/agent/loop'
import type { AgentEnv, AgentModel, ModelMessage, UiFacade } from '../../../src/agent/contract'
import { emptyChangeset, untick } from '../../../src/agent/changeset'
import { AGENT_TOOLS } from '../../../src/agent/tools'
import { serverEnv, type EnvState } from './env'
import { roleNow, type Role } from './membership'
import { openAsPerson, type WebConfig } from './person'
import { openWorkspace } from './workspace'

// A run between two steps: the loop's state and the env's, plain data.
export type Checkpoint = { v: 1; turn: TurnState; env: EnvState }

export type TurnJob = {
  wid: string
  uid: string
  name?: string
  chatId: string
  turnId: string
  ask: string
  canvas?: string
  history: ModelMessage[]
  // The chat's short ids, pending changes and job as the last turn left them.
  was?: EnvState
  // Items of the open preview the person unticked: off the pending changes before the turn, with what needs them.
  off?: string[]
  // Goes on from here instead of starting.
  from?: Checkpoint
}

export type TurnDeps = {
  web: WebConfig
  admin: Firestore
  model: AgentModel
  ui: UiFacade
  signal?: AbortSignal
  steer?: () => string[]
  onEvent?: (e: LoopEvent) => void
  // Keeps the run before each step; what it throws (the lease is gone, the time is nearly up) ends the turn by throwing.
  keep: (c: Checkpoint) => Promise<void>
  // The evals' (--server): a fixture's clock, their own drawer, the transcript, a smaller map.
  now?: () => number
  render?: AgentEnv['render']
  loop?: Pick<TurnOpts, 'transcript' | 'mapBudget'>
}

// The person's role changed while the run worked: it ends, since what it may propose was decided by the old one.
export class RoleChanged extends Error {
  constructor(was: Role, now: Role) {
    super(`your role changed from ${was} to ${now}`)
    this.name = 'RoleChanged'
  }
}

export type Done = TurnResult & { env: EnvState }

export async function runServerTurn(job: TurnJob, deps: TurnDeps): Promise<Done> {
  const role = await roleNow(deps.admin, job.wid, job.uid)
  const check = async () => {
    const now = await roleNow(deps.admin, job.wid, job.uid)
    if (now !== role) throw new RoleChanged(role, now)
  }
  const person = await openAsPerson(job.uid, deps.web)
  try {
    const ws = await openWorkspace(person, job.wid, { ...(job.canvas ? { canvas: job.canvas } : {}), ...(deps.now ? { now: deps.now } : {}) })
    try {
      const env = serverEnv({ ws, uid: job.uid, ...(job.name ? { name: job.name } : {}), role, chatId: job.chatId, ui: deps.ui, ...(deps.now ? { now: deps.now } : {}), ...(deps.render ? { render: deps.render } : {}), ...(job.from ? { was: job.from.env } : job.was ? { was: job.was } : {}) })
      if (!job.from)
        for (const item of job.off ?? []) env.changes = untick(env.changes ?? emptyChangeset(), item, { live: env.getWs(), actor: env.actor, now: env.now(), ids: env.ids, newId: env.newId }).cs
      const r = await runTurn(deps.model, env, AGENT_TOOLS, job.history, job.ask, {
        ...deps.loop,
        turnId: job.turnId,
        ...(deps.signal ? { signal: deps.signal } : {}),
        ...(deps.steer ? { steer: deps.steer } : {}),
        ...(deps.onEvent ? { onEvent: deps.onEvent } : {}),
        ...(job.from ? { resume: job.from.turn } : {}),
        onStep: async (turn) => {
          await check()
          await deps.keep({ v: 1, turn, env: env.state() })
        },
      })
      // Before anything is handed over: still a member, in the same role.
      await check()
      return { ...r, env: env.state() }
    } finally {
      ws.close()
    }
  } finally {
    await person.end()
  }
}

export { NotAMember } from './membership'
