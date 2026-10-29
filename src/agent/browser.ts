// The agent's writes in the browser (S13, D-312; docs/specs/agent.md §4.5, §7.2 points 1–2): the env's `apply` over the
// ops layer's real apply (src/ops/firestore.ts: validate, then ONE tracked() step), the turn's write lock, and the
// chat's `[undo]`. The only file of the agent that reaches Firebase (through src/ops and src/data/history.ts).
//
// ONE UNDO STEP PER TURN. A turn's changes are written once, at accept: one apply, one step (label `agent: …`,
// `meta.actor: 'agent'`). Auto-apply (off by default) may apply several times in a turn: each apply passes the key
// `agent-turn:<turnId>` with mergeAlways, and history.ts merges a step only into the LAST step and only when its key is
// the same, so a person's write landing in between would split the turn into two steps (it can never merge INTO the
// agent's). That's why the person's writes are locked while the agent works (`holdLock('agent', AGENT_LOCK)`: every
// tracked write, undo and redo is refused with "the agent is working — stop it to edit"), released when the turn ends
// or is stopped (workflow.ts' effects). The agent's own apply lifts the locks this module holds for exactly the
// synchronous part of apply (validate, writable(), tracked() all run before apply's first await), then puts them back.
// The preview's lock (S15) is held through `lockPreview()` (its own message), so accept can write under it. The driver
// must release the locks in a finally around every turn, on unmount and on a workspace change (`releaseAgentLocks`).
import { apply as applyOps, OpsRefused, type OpActor } from '../ops'
import { setReadOnly, undo, useHistory } from '../data/history'
import type { WorkspaceCtx } from '../state/wsStore'
import type { AgentEnv, Applied } from './contract'
import { AGENT_LOCK } from './workflow'

// The locks the agent's side holds now, by key, with their message.
const held = new Map<string, string>()

export function holdLock(key: string, why: string) {
  held.set(key, why)
  setReadOnly(why, key)
}

export function releaseLock(key: string) {
  held.delete(key)
  setReadOnly(null, key)
}

export const lockTurn = () => holdLock('agent', AGENT_LOCK)
export const unlockTurn = () => releaseLock('agent')
// S15's preview lock: its own message (the app is locked while a preview is open, agent.md §4.5 point 5).
export const PREVIEW_LOCK = 'a preview is open — apply or discard it to edit'
export const lockPreview = () => holdLock('preview', PREVIEW_LOCK)
export const unlockPreview = () => releaseLock('preview')
export const locksHeld = () => [...held.keys()]

// Every lock the agent's side holds, released: the driver calls this in a finally around a turn, on unmount and when
// the workspace changes, so a crash or a closed panel never leaves the person locked out.
export function releaseAgentLocks() {
  for (const k of [...held.keys()]) releaseLock(k)
}

// Runs `fn` with the agent's own locks lifted (synchronously), then puts them back.
function unlocked<T>(fn: () => T): T {
  const was = [...held]
  for (const [k] of was) setReadOnly(null, k)
  try {
    return fn()
  } finally {
    for (const [k, why] of was) setReadOnly(why, k)
  }
}

// The env's apply in the browser: the plans written as one undo step as the agent, on the workspace as it is now
// (`ws()`, the listeners' snapshot: freshWs). Refusals come back as errors with their fixes, never thrown.
export function browserApply(wid: string, by: OpActor, ws: () => WorkspaceCtx | null): AgentEnv['apply'] {
  return async (plans, as): Promise<Applied> => {
    const snap = ws()
    if (!snap || snap.wid !== wid) return { ok: false, errors: [{ op: 'apply', message: 'the workspace is not open', fix: 'open the workspace and try again' }] }
    let p: ReturnType<typeof applyOps>
    try {
      p = unlocked(() => applyOps(wid, plans, { actor: 'agent', ...(as.label ? { label: as.label } : {}), ws: snap, by: { ...by, agent: true }, ...(as.key ? { key: as.key } : {}), ...(as.mergeAlways ? { mergeAlways: true } : {}) }))
    } catch (e) {
      return refused(e)
    }
    try {
      const a = await p
      if (!a.step && plans.some((x) => x.writes.length)) return { ok: false, errors: [{ op: 'apply', message: 'writes are refused right now (the app is locked or read-only)', fix: 'close what locks it, or ask an editor' }] }
      return { ok: true, label: a.step?.label ?? as.label ?? plans.map((x) => x.label).join(', '), plans, step: a.step }
    } catch (e) {
      return refused(e)
    }
  }
}

function refused(e: unknown): Applied {
  if (e instanceof OpsRefused) return { ok: false, errors: e.errors }
  return { ok: false, errors: [{ op: 'apply', message: (e as Error)?.message ?? String(e), fix: 'try again' }] }
}

// The chat's `[undo]` for an applied step: only while it's still the last step (else something came after it, and
// undoing would take that instead). True when it was undone.
export async function undoAgentStep(key: string): Promise<boolean> {
  const { past, say } = useHistory.getState()
  if (past[past.length - 1]?.key !== key) {
    say("Can't undo the agent's change from here: other changes came after it (use ⌘Z step by step)")
    return false
  }
  await undo()
  return true
}
