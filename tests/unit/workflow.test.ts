// S13 (D-312; agent.md §4.5, §4.10): the agent's turn lifecycle as a pure state machine: plan → go → run → preview →
// accept (one step, a report with [undo]) or discard; a note during the preview revises with the changes kept; stop;
// untick to nothing; the lock held from a turn's start to its end (through the preview) and released after.
import { describe, expect, it } from 'vitest'
import { initialWorkflow, reportOf, step, waitingFor, type Effect, type WorkflowEvent, type WorkflowState } from '../../src/agent/workflow'

const run = (events: WorkflowEvent[], from: WorkflowState = initialWorkflow()) => {
  let s = from
  const effects: Effect[] = []
  for (const e of events) {
    const r = step(s, e)
    s = r.state
    effects.push(...r.effects)
  }
  return { s, effects, kinds: effects.map((x) => x.type) }
}

const end = (answer: string, pending = 0, e: 'answered' | 'stopped' = 'answered'): WorkflowEvent => ({ type: 'turn_end', answer, pending, end: e })
const STEP = { key: 'agent-turn:3', label: 'agent: two clubs' }

describe('the workflow', () => {
  it('a big job: plan → asking; go → running → preview → accept → applied with a report; undo once', () => {
    const plan = run([{ type: 'send', text: 'make a competitor matrix' }, end('Here is my plan:\n1. Read p1\n2. Make a matrix\nSay go.')])
    expect([plan.s.phase, plan.s.waiting]).toEqual(['asking', 'plan'])
    expect(plan.kinds).toEqual(['lock', 'run', 'unlock'])
    const go = run([{ type: 'send', text: 'go' }, end('Ready.', 12)], plan.s)
    expect([go.s.phase, go.s.pending, go.s.turn]).toEqual(['previewing', 12, 2])
    expect(go.kinds).toEqual(['lock', 'run', 'preview'])
    const report = reportOf({ applied: [{ line: 'add a matrix', where: 'Main · canvas' }], notDone: [], step: STEP })
    const done = run([{ type: 'accept' }, { type: 'applied', report }], go.s)
    expect(done.s.phase).toBe('applied')
    expect(done.kinds).toEqual(['accept', 'close_preview', 'unlock', 'report'])
    expect(done.s.report!.text).toBe('Applied 1 change on Main · canvas (1), one undo step.')
    const undone = run([{ type: 'undo' }, { type: 'undo' }, { type: 'undo_done', ok: true }], done.s)
    expect(undone.effects).toEqual([{ type: 'undo', step: STEP }])
    expect(undone.s.report!.undone).toBe(true)
    expect(undone.s.report!.text).toMatch(/Undone\.$/)
    // The [undo] refused (something came after): not marked undone, it says why, and can be tried again.
    const no = run([{ type: 'undo' }, { type: 'undo_done', ok: false }], done.s)
    expect([no.s.report!.undone, no.s.report!.undoing, /other changes came after/.test(no.s.error ?? '')]).toEqual([undefined, undefined, true])
    expect(run([{ type: 'undo' }], no.s).kinds).toEqual(['undo'])
  })

  it('a note during the preview revises: running with the changes kept, the lock kept, a new preview', () => {
    const p = run([{ type: 'send', text: 'add three ideas' }, end('Here they are.', 3)])
    const r = run([{ type: 'send', text: "don't add the third" }], p.s)
    expect([r.s.phase, r.s.revising, r.s.pending]).toEqual(['running', true, 3])
    // S15: the turn's lock goes on right after the preview closes (closing it lets go of the preview's lock), so the
    // person is never unlocked while the agent revises.
    expect(r.effects).toEqual([{ type: 'close_preview' }, { type: 'lock' }, { type: 'run', text: "don't add the third", turn: 2, revising: true }])
    const again = run([end('Dropped it.', 2)], r.s)
    expect([again.s.phase, again.s.pending]).toEqual(['previewing', 2])
  })

  it('discard: nothing changed, a report; untick to nothing then accept closes it as discarded', () => {
    const p = run([{ type: 'send', text: 'x' }, end('ok', 2)])
    const d = run([{ type: 'discard' }], p.s)
    expect([d.s.phase, d.s.report!.text]).toEqual(['discarded', 'Discarded: nothing changed (2 changes not applied).'])
    expect(d.kinds).toEqual(['discard', 'close_preview', 'unlock', 'report'])
    const u = run([{ type: 'untick', pending: 0 }, { type: 'accept' }], p.s)
    expect(u.s.phase).toBe('discarded')
    expect(u.kinds).toEqual(['discard', 'close_preview', 'unlock', 'report'])
  })

  it('stop aborts; the stopped turn previews what is pending, else goes idle and unlocks', () => {
    const r = run([{ type: 'send', text: 'x' }, { type: 'stop' }])
    expect(r.kinds).toEqual(['lock', 'run', 'abort'])
    expect(run([end('', 1, 'stopped')], r.s).s.phase).toBe('previewing')
    const idle = run([end('', 0, 'stopped')], r.s)
    expect([idle.s.phase, idle.kinds]).toEqual(['idle', ['unlock']])
  })

  it('a failed apply goes back to the preview with the error; events out of place change nothing', () => {
    const p = run([{ type: 'send', text: 'x' }, end('ok', 1), { type: 'accept' }, { type: 'apply_failed', error: 'refused' }])
    expect([p.s.phase, p.s.error]).toEqual(['previewing', 'refused'])
    const bad = step(initialWorkflow(), { type: 'accept' })
    expect([bad.state.phase, bad.effects, bad.state.error]).toEqual(['idle', [], "can't accept while idle"])
    const busy = run([{ type: 'send', text: 'a' }, { type: 'send', text: 'b' }])
    expect(busy.kinds).toEqual(['lock', 'run'])
  })

  it('a question waits; a plain answer goes idle', () => {
    expect(run([{ type: 'send', text: 'delete the duplicate' }, end('Delete c12 "Bread club" (a duplicate of c11)? Say yes and I will.')]).s).toMatchObject({ phase: 'asking', waiting: 'question' })
    expect(run([{ type: 'send', text: 'how many' }, end('There are 12 problems.')]).s.phase).toBe('idle')
    expect(waitingFor('It says "what now?" in the note.')).toBe(null)
  })

  it('the report says what was not done', () => {
    const r = reportOf({ applied: [{ line: 'a', where: 'P · plane' }, { line: 'b', where: 'P · plane' }], notDone: [{ line: 'add an idea: new idea "Cheese club"' }], step: null })
    expect(r.text).toBe('Applied 2 changes on P · plane (2). Not done: 1 (add an idea: new idea "Cheese club").')
    expect(r.notDone).toHaveLength(1)
  })

  it('fail and reset from any phase unlock (and abort a running turn, close or discard a preview)', () => {
    const running = run([{ type: 'send', text: 'x' }]).s
    expect(run([{ type: 'fail', error: 'the model is gone' }], running)).toMatchObject({ s: { phase: 'idle', error: 'the model is gone' }, kinds: ['abort', 'unlock'] })
    const previewing = run([{ type: 'send', text: 'x' }, end('ok', 2)]).s
    expect(run([{ type: 'reset' }], previewing)).toMatchObject({ s: { phase: 'idle', pending: 0 }, kinds: ['discard', 'close_preview', 'unlock'] })
    expect(run([{ type: 'fail', error: 'x' }], previewing).kinds).toEqual(['discard', 'close_preview', 'unlock'])
    expect(run([{ type: 'reset' }], initialWorkflow()).kinds).toEqual(['unlock'])
  })
})
