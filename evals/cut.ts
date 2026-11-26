// A turn whose worker dies before every step (D-434, docs/specs/agent-server.md §5.2): at each step the loop's state and
// the env's own (the pending changes, the short ids, the job) are turned into JSON, the turn is thrown away, and a new
// one goes on from the JSON alone. What comes out must be what an uncut turn gives: `--cut` runs any eval this way, and
// tests/unit/agentResume.test.ts holds the two together.
import { runTurn, type TurnOpts, type TurnResult, type TurnState } from '../src/agent/loop'
import { makeIds, type IdsState } from '../src/agent/read'
import type { AgentModel, AgentTool, ModelMessage } from '../src/agent/contract'
import type { Changeset } from '../src/agent/changeset'
import type { Job } from '../src/agent/job'
import type { EvalEnv } from './env'

// What a worker would keep between two steps, as it is kept: JSON.
type Kept = { state: TurnState; changes?: Changeset; ids: IdsState; job: Job | null }

class Cut extends Error {}

export async function runCut(model: AgentModel, env: EvalEnv, tools: AgentTool[], history: ModelMessage[], ask: string, opts: TurnOpts = {}): Promise<TurnResult & { cuts: number }> {
  let kept: string | null = null
  let cuts = 0
  let at = 0
  for (;;) {
    const was: Kept | null = kept ? (JSON.parse(kept) as Kept) : null
    if (was) {
      env.changes = was.changes
      env.ids = makeIds(was.ids)
      env.job?.set(was.job)
    }
    try {
      const r = await runTurn(model, env, tools, was ? [] : history, was ? '' : ask, {
        ...opts,
        ...(was ? { resume: was.state } : {}),
        onStep: (state) => {
          // Each step is cut once, the first time it's reached; the resumed turn goes on past it.
          if (state.n <= at) return
          at = state.n
          kept = JSON.stringify({ state, changes: env.changes, ids: env.ids.toJSON(), job: env.job?.get() ?? null } satisfies Kept)
          cuts++
          throw new Cut()
        },
      })
      return { ...r, cuts }
    } catch (e) {
      if (!(e instanceof Cut)) throw e
    }
  }
}
