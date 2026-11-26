// The evals on the server's own path (D-434, docs/specs/agent-server.md P1): `npm run eval -- --server`. The emulator mode
// (evals/emulator.ts: seeded, accepted through the real apply, read back), but every turn runs through
// functions/src/agent/turn.ts: the workspace read from Firestore under the rules as the person, in a session of its own,
// and the run thrown away before every step and gone on with from its checkpoint as JSON. What a task's grader sees is
// the same as ever, so a difference between the two hosts is a failing task.
import { createRequire } from 'node:module'
import type { AgentModel } from '../src/agent/contract'
import { makeIds } from '../src/agent/read'
import type { TurnOpts } from '../src/agent/loop'
import type { EvalEnv } from './env'
import { nodeRender } from './render'
import { emulate, PROJECT } from './emulator'
import type { Backend, Runner } from './run'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
const need = createRequire(new URL('../functions/package.json', import.meta.url))
const adminApp = need('firebase-admin/app') as typeof import('../functions/node_modules/firebase-admin/lib/app')
const adminDb = need('firebase-admin/firestore') as typeof import('../functions/node_modules/firebase-admin/lib/firestore')
if (!adminApp.getApps().length) adminApp.initializeApp({ projectId: PROJECT })

import { runServerTurn, type Checkpoint, type Done } from '../functions/src/agent/turn'

class Cut extends Error {}

const runner = (wid: string): Runner => async (model: AgentModel, env: EvalEnv, _tools, history, ask, opts: TurnOpts = {}) => {
  const changes = env.changes
  const was = { changes: changes!, ids: env.ids.toJSON(), job: env.job?.get() ?? null }
  let kept: string | null = null
  let at = 0
  for (;;) {
    const from = kept ? (JSON.parse(kept) as Checkpoint) : undefined
    let done: Done
    try {
      done = await runServerTurn(
        { wid, uid: env.actor.uid, ...(env.actor.name ? { name: env.actor.name } : {}), chatId: 'eval', turnId: opts.turnId ?? '1', ask, canvas: env.ui.currentView().canvas, history, was, ...(from ? { from } : {}) },
        {
          web: { projectId: PROJECT, apiKey: 'demo' },
          admin: adminDb.getFirestore() as never,
          model,
          ui: env.ui,
          now: env.now,
          // Vite's module runner can't load resvg's native binding the way node does (evals/render.ts).
          render: nodeRender,
          loop: { ...(opts.transcript ? { transcript: opts.transcript } : {}), ...(opts.mapBudget ? { mapBudget: opts.mapBudget } : {}) },
          keep: async (c) => {
            if (c.turn.n <= at) return
            at = c.turn.n
            kept = JSON.stringify(c)
            throw new Cut()
          },
        },
      )
    } catch (e) {
      if (e instanceof Cut) continue
      throw e
    }
    env.changes = done.env.changes
    env.ids = makeIds(done.env.ids)
    env.job?.set(done.env.job)
    return done
  }
}

export const emulateServer: Backend = async (start, o) => {
  const em = await emulate(start, o)
  return { ...em, run: runner(em.wid) }
}
