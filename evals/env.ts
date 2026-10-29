// The eval's in-memory environment (S11, D-312): an `AgentEnv` over a snapshot, with no Firebase. Writes are real ops:
// `apply` runs validate and project, the same code the browser's apply runs before it writes (src/ops/validate.ts,
// project.ts). Every apply within one turn joins that turn's undo step (agent.md §7.2 point 2: one agent turn = one
// undo step), whose inverse is each touched doc as it was when the turn began, so a grader can undo the run and compare. The UI facade only records the moves and keeps a view in step with them.
import { validate } from '../src/ops/validate'
import { project } from '../src/ops/project'
import { toDocs } from '../src/ops/docs'
import { counterIds } from '../src/ops/newId'
import type { OpActor, Plan, Write } from '../src/ops/types'
import type { Role } from '../src/data/model'
import { makeIds, type Ids } from '../src/agent/read'
import type { WhereView } from '../src/agent/read/tools'
import type { AgentEnv, AgentWs, Applied, ApplyAs, UiFacade } from '../src/agent/contract'

// One undo step (a turn's applies) as the undo stack would hold it: who, the plans, the plan that puts back what they
// touched, how many applies it joined, and the turn it belongs to.
export type AppliedStep = { label: string; actor: 'agent' | 'person'; ops: string[]; plans: Plan[]; inverse: Plan; applies: number; turn: number }

// A UI move the model asked for (recorded, never drawn).
export type UiMove = { tool: string; args: unknown[] }

export type EvalEnv = AgentEnv & {
  start: AgentWs
  steps: AppliedStep[]
  refused: number
  moves: UiMove[]
  view: WhereView
  // New ids for op builders: the same every run (`evalnew001`…).
  newId: () => string
}

export const EMPTY_VIEW: WhereView = { canvas: 'main', focus: null, selection: [], piece: null, tasks: [], panel: null, beside: [], side: null }

// The plan that undoes `plans` on `ws`: every doc they touch set back to what it was, or deleted if it wasn't there.
export function inverseOf(ws: AgentWs, plans: Plan[]): Plan {
  const store = toDocs(ws)
  const seen = new Set<string>()
  const writes: Write[] = []
  for (const p of plans)
    for (const w of p.writes) {
      const key = `${w.coll}/${w.id}`
      if (seen.has(key)) continue
      seen.add(key)
      const was = store.get(w.coll)?.get(w.id)
      if (!was) writes.push({ coll: w.coll, id: w.id, del: true })
      else {
        const { id: _id, ...fields } = was as Record<string, unknown>
        writes.push({ coll: w.coll, id: w.id, set: fields })
      }
    }
  return { op: 'undo', label: `undo ${plans.map((p) => p.label).join(', ')}`, writes: writes.reverse(), ids: {} }
}

export type EnvOpts = { role?: Role; uid?: string; view?: Partial<WhereView>; now?: number }

export function makeEnv(start: AgentWs, o: EnvOpts = {}): EvalEnv {
  let ws = start
  const uid = o.uid ?? start.me ?? start.workspace.ownerId
  const role: Role = o.role ?? 'editor'
  const actor: OpActor = { uid, role, agent: true }
  const ids: Ids = makeIds()
  ids.sync(ws)
  const now = o.now ?? start.now ?? Date.now()
  const steps: AppliedStep[] = []
  const moves: UiMove[] = []
  const view: WhereView = { ...EMPTY_VIEW, canvas: start.canvas, ...o.view }
  const newId = counterIds('evalnew')
  const record = (tool: string, ...args: unknown[]) => void moves.push({ tool, args })
  // The turn now (newTurn counts them) and the workspace when its first apply came.
  let turn = 0
  let turnStart = ws
  const ui: UiFacade = {
    goTo: async (id) => record('go_to', id),
    focus: async (plane) => {
      record('focus', plane)
      view.focus = plane
      view.selection = []
      view.beside = []
    },
    select: async (list) => {
      record('select', list)
      view.selection = [...list]
    },
    openPanel: async (id) => {
      record('open_panel', id)
      view.panel = ws.tasks.some((t) => t.id === id) ? { task: id } : { card: id }
    },
    showBeside: async (id) => {
      record('show_beside', id)
      if (!view.beside.includes(id)) view.beside = [...view.beside, id]
    },
    currentView: () => ({ ...view }),
  }
  const env: EvalEnv = {
    start,
    steps,
    moves,
    view,
    refused: 0,
    newId,
    actor,
    ids,
    ui,
    now: () => now,
    newTurn: () => void turn++,
    getWs: () => ws,
    async apply(plans: Plan[], as: ApplyAs): Promise<Applied> {
      const actorNow: OpActor = { ...actor, agent: as.actor === 'agent' }
      const v = validate(plans, ws, actorNow)
      if (!v.ok) {
        env.refused++
        return { ok: false, errors: v.errors }
      }
      // validate passed, but a write may still not apply (a patch on a doc that's gone): refused the same way.
      let next: AgentWs
      try {
        next = project(ws, plans) as AgentWs
      } catch (e) {
        env.refused++
        return { ok: false, errors: [{ op: plans[0]?.op ?? 'apply', message: (e as Error).message, fix: 'read the workspace again and retry with what is there' }] }
      }
      // Like the browser's apply: no step for plans that write nothing.
      if (!plans.some((p) => p.writes.length)) return { ok: true, label: 'nothing to change', plans }
      const label = as.label ?? plans.map((p) => p.label).join(', ')
      const last = steps[steps.length - 1]
      if (last && last.turn === turn && last.actor === as.actor) {
        // The same turn: one step, its inverse from the turn's start (each doc's earliest "before").
        last.plans = [...last.plans, ...plans]
        last.ops = [...last.ops, ...plans.map((p) => p.op)]
        last.label = `${last.label}; ${label}`
        last.applies++
        last.inverse = inverseOf(turnStart, last.plans)
      } else {
        turnStart = ws
        steps.push({ label, actor: as.actor, ops: plans.map((p) => p.op), plans, inverse: inverseOf(ws, plans), applies: 1, turn })
      }
      ws = next
      ids.sync(ws)
      return { ok: true, label, plans }
    },
  }
  return env
}
