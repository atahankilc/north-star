// The agent's turn lifecycle (S13, D-312; docs/specs/agent.md §4.5, §4.10): what the chat (S14) and the preview (S15)
// drive. Pure: a state, an event, the next state and the effects the driver carries out. No React, no Firebase.
//
//   idle ──send──▶ running ──turn ends──▶ asking      (no change pending; the agent asked or showed a plan: waiting)
//                    │                    previewing  (changes pending: the preview opens by itself)
//                    │                    idle        (it answered; nothing pending)
//                    └──stop──▶ previewing if anything is pending, else idle (what was applied stays)
//   asking ──send ("go", an answer)──▶ running
//   previewing ──accept──▶ applying ──applied──▶ applied (a report line: what was done, what wasn't, [undo])
//                                  └─failed──▶ previewing (with the error)
//              ──discard──▶ discarded (a report line: nothing changed)
//              ──send (the person's note, `> change something…`)──▶ running, REVISING: the changeset stays pending;
//                 the agent's new change calls add items or `drop` some (changeset.ts), and the turn ends in a new preview
//              ──untick──▶ previewing (fewer items; with none left, accept just closes it as discarded)
//   applied ──undo──▶ applied, undoing ──undo_done ok──▶ undone (the report says so) / not ok──▶ an error, not undone
//   applied | discarded ──send──▶ running (a new job)
//   any ──fail──▶ idle with the error, unlocked (pending discarded); any ──reset (chat closed, workspace changed)──▶ idle, pending
//   discarded, unlocked.
//
// THE DRIVER must also release the locks itself in a finally around each turn, on unmount and on a workspace change
// (browser.ts' releaseAgentLocks): a thrown driver never leaves the person locked out.
//
// EFFECTS: `lock` / `unlock` the person's writes (history.ts' setReadOnly under the key 'agent', the message
// AGENT_LOCK: during a turn, so nothing a person does can land between the agent's own writes of that turn (auto-apply
// joins one undo step with `agent-turn:<id>` and mergeAlways, and history merges only into the LAST step), and during
// the preview the app is locked anyway (S15, §4.5 point 5); `run` a turn; `preview` / `close_preview`; `accept` the
// changeset; `discard` it; `report` a line in the chat; `undo` the applied step.

export type Phase = 'idle' | 'running' | 'asking' | 'previewing' | 'applying' | 'applied' | 'discarded'

export type Report = { text: string; done: string[]; notDone: string[]; step: { key: string; label: string } | null; undone?: boolean; undoing?: boolean }

export type WorkflowState = {
  phase: Phase
  // Turns so far (1-based id of the current or last).
  turn: number
  // Changes pending (the preview's items).
  pending: number
  // A running turn that revises a pending preview (the person's note).
  revising?: boolean
  // asking: why it waits (a plan for a big job, or a question).
  waiting?: 'plan' | 'question'
  report?: Report
  error?: string
}

export type WorkflowEvent =
  | { type: 'send'; text: string }
  | { type: 'turn_end'; answer: string; pending: number; end: 'answered' | 'budget' | 'length' | 'refused' | 'stopped' | 'error' }
  | { type: 'stop' }
  | { type: 'untick'; pending: number }
  | { type: 'accept' }
  | { type: 'applied'; report: Report }
  | { type: 'apply_failed'; error: string }
  | { type: 'discard'; notDone?: string[] }
  | { type: 'undo' }
  // The undo's result (the chat's [undo] runs only while the step is the last: browser.ts' undoAgentStep).
  | { type: 'undo_done'; ok: boolean }
  // From any phase: something failed (the loop threw, the model is gone) or the chat is closed / the workspace changed.
  | { type: 'fail'; error: string }
  | { type: 'reset' }

export type Effect =
  | { type: 'lock' }
  | { type: 'unlock' }
  | { type: 'run'; text: string; turn: number; revising: boolean }
  | { type: 'abort' }
  | { type: 'preview' }
  | { type: 'close_preview' }
  | { type: 'accept' }
  | { type: 'discard' }
  | { type: 'report'; report: Report }
  | { type: 'undo'; step: { key: string; label: string } }

export const AGENT_LOCK = 'the agent is working — stop it to edit'

export const initialWorkflow = (): WorkflowState => ({ phase: 'idle', turn: 0, pending: 0 })

// How a turn that changed nothing ended: a numbered plan waiting for go, a question, or a plain answer.
export function waitingFor(answer: string): 'plan' | 'question' | null {
  const a = answer.trim()
  if (!a) return null
  if (/\bsay go\b|\bshall I (go|start|proceed)\b|\bwant me to (go|start|proceed)\b/i.test(a) || (/\bplan\b/i.test(a) && /^\s*1[.)]/m.test(a))) return 'plan'
  // A real question: a sentence ending in "?" with a question word in it (quoted text taken out), or "say yes".
  const plain = a.replace(/"[^"]*"|“[^”]*”/g, '""')
  if (/\bsay yes\b/i.test(plain)) return 'question'
  const asks = plain.split(/(?<=[.!?])\s+/).some((x) => /\?\s*$/.test(x) && /\b(should|shall|do|does|did|which|what|who|where|when|how|is|are|can|could|would|will|want|delete|remove|ok|okay)\b/i.test(x))
  return asks ? 'question' : null
}

const same = (s: WorkflowState, e: WorkflowEvent): { state: WorkflowState; effects: Effect[] } => ({ state: { ...s, error: `can't ${e.type} while ${s.phase}` }, effects: [] })

export function step(s: WorkflowState, e: WorkflowEvent): { state: WorkflowState; effects: Effect[] } {
  switch (e.type) {
    case 'send': {
      if (s.phase === 'running' || s.phase === 'applying') return same(s, e)
      const revising = s.phase === 'previewing' && s.pending > 0
      const turn = s.turn + 1
      return {
        state: { phase: 'running', turn, pending: revising ? s.pending : 0, ...(revising ? { revising: true } : {}) },
        // A note during the preview: the preview closes while the agent revises (the changeset stays), the lock stays.
        effects: [...(s.phase === 'previewing' ? [{ type: 'close_preview' as const }] : [{ type: 'lock' as const }]), { type: 'run', text: e.text, turn, revising }],
      }
    }
    case 'turn_end': {
      if (s.phase !== 'running') return same(s, e)
      if (e.pending > 0) return { state: { phase: 'previewing', turn: s.turn, pending: e.pending }, effects: [{ type: 'preview' }] }
      const w = e.end === 'answered' ? waitingFor(e.answer) : null
      return { state: { phase: w ? 'asking' : 'idle', turn: s.turn, pending: 0, ...(w ? { waiting: w } : {}) }, effects: [{ type: 'unlock' }] }
    }
    case 'stop': {
      if (s.phase !== 'running') return same(s, e)
      // The loop ends the turn as stopped; its turn_end then opens the preview if anything is pending.
      return { state: s, effects: [{ type: 'abort' }] }
    }
    case 'untick': {
      if (s.phase !== 'previewing') return same(s, e)
      return { state: { ...s, pending: e.pending }, effects: [] }
    }
    case 'accept': {
      if (s.phase !== 'previewing') return same(s, e)
      if (!s.pending) {
        const report: Report = { text: 'Nothing was applied: every change was unticked.', done: [], notDone: [], step: null }
        return { state: { phase: 'discarded', turn: s.turn, pending: 0, report }, effects: [{ type: 'discard' }, { type: 'close_preview' }, { type: 'unlock' }, { type: 'report', report }] }
      }
      return { state: { ...s, phase: 'applying', error: undefined }, effects: [{ type: 'accept' }] }
    }
    case 'applied': {
      if (s.phase !== 'applying') return same(s, e)
      return { state: { phase: 'applied', turn: s.turn, pending: 0, report: e.report }, effects: [{ type: 'close_preview' }, { type: 'unlock' }, { type: 'report', report: e.report }] }
    }
    case 'apply_failed': {
      if (s.phase !== 'applying') return same(s, e)
      return { state: { ...s, phase: 'previewing', error: e.error }, effects: [] }
    }
    case 'discard': {
      if (s.phase !== 'previewing') return same(s, e)
      const report: Report = { text: `Discarded: nothing changed${s.pending ? ` (${s.pending} change${s.pending === 1 ? '' : 's'} not applied)` : ''}.`, done: [], notDone: e.notDone ?? [], step: null }
      return { state: { phase: 'discarded', turn: s.turn, pending: 0, report }, effects: [{ type: 'discard' }, { type: 'close_preview' }, { type: 'unlock' }, { type: 'report', report }] }
    }
    case 'undo': {
      if (s.phase !== 'applied' || !s.report?.step || s.report.undone || s.report.undoing) return same(s, e)
      return { state: { ...s, report: { ...s.report, undoing: true } }, effects: [{ type: 'undo', step: s.report.step }] }
    }
    case 'undo_done': {
      if (s.phase !== 'applied' || !s.report?.undoing) return same(s, e)
      const { undoing: _, ...report } = s.report
      if (!e.ok) return { state: { ...s, report, error: "couldn't undo it from the chat: other changes came after it" }, effects: [] }
      return { state: { ...s, error: undefined, report: { ...report, undone: true, text: `${report.text} Undone.` } }, effects: [] }
    }
    // From the preview (or an accept under way) the pending changes are discarded too: the state says nothing is
    // pending, so the changeset mustn't hold any (S14; a failed accept wrote nothing: apply is one batch).
    case 'fail':
      return { state: { phase: 'idle', turn: s.turn, pending: 0, error: e.error }, effects: [...(s.phase === 'running' ? [{ type: 'abort' as const }] : []), ...(s.phase === 'previewing' || s.phase === 'applying' ? [{ type: 'discard' as const }, { type: 'close_preview' as const }] : []), { type: 'unlock' }] }
    case 'reset':
      return { state: initialWorkflow(), effects: [...(s.phase === 'running' ? [{ type: 'abort' as const }] : []), ...(s.phase === 'previewing' || s.phase === 'applying' ? [{ type: 'discard' as const }, { type: 'close_preview' as const }] : []), { type: 'unlock' }] }
  }
}

// The report line after an accept (agent.md §4.10 point 5): what was done (the items' lines, grouped by where), what
// wasn't (unticked or dropped), and the undo step.
export function reportOf(o: { applied: { line: string; where: string }[]; notDone: { line: string }[]; step: { key: string; label: string } | null }): Report {
  const where = new Map<string, number>()
  for (const i of o.applied) where.set(i.where, (where.get(i.where) ?? 0) + 1)
  const places = [...where].map(([w, n]) => `${w} (${n})`).join(', ')
  const text = [
    `Applied ${o.applied.length} change${o.applied.length === 1 ? '' : 's'}${places ? ` on ${places}` : ''}${o.step ? ', one undo step' : ''}.`,
    ...(o.notDone.length ? [`Not done: ${o.notDone.length} (${o.notDone.map((i) => i.line).slice(0, 3).join('; ')}${o.notDone.length > 3 ? '; …' : ''}).`] : []),
  ].join(' ')
  return { text, done: o.applied.map((i) => i.line), notDone: o.notDone.map((i) => i.line), step: o.step }
}
