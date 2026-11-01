// agent-bugs 25: the evals build the agent's store the way the app does. Only the agent notes' text comes up front; a
// document's text loads when read_document asks (AgentEnv.loadBody: src/data's readDocBody in the app and the
// emulator, the fixture's texts in memory). What the person did with a preview reaches the model through one function
// (workflow.ts' withOutcome), the same words in the app and the evals.
import { describe, expect, it } from 'vitest'
import { asTheAppLoads, makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { AGENT_TOOLS } from '../../src/agent/tools'
import { runTurn } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { reportOf, withOutcome } from '../../src/agent/workflow'
import { NOTES_ID } from '../../src/model/notes'
import type { AgentWs } from '../../src/agent/contract'

const readDoc = AGENT_TOOLS.find((t) => t.def.name === 'read_document')!

// The medium fixture with one document's text, and the notes' text.
function withBodies(): { ws: AgentWs; doc: string } {
  const ws = loadFixture('medium')
  const doc = ws.documents.find((d) => d.kind === 'markdown' && d.id !== NOTES_ID)!
  return { ws: { ...ws, bodies: { ...(ws.bodies ?? {}), [doc.id]: { text: '# Pilot\n\nOnly 1 in 8 stalls takes cards.' }, [NOTES_ID]: { text: '# Agent notes' } } } as AgentWs, doc: doc.id }
}

describe('the evals load document text as the app does (bug 25)', () => {
  it('starts with only the notes\' text', () => {
    const { ws, doc } = withBodies()
    const { ws: start, held } = asTheAppLoads(ws)
    expect(Object.keys(start.bodies ?? {})).toEqual([NOTES_ID])
    expect(held[doc]?.text).toContain('1 in 8')
    expect(makeEnv(ws).getWs().bodies?.[doc]).toBeUndefined()
  })

  it('read_document loads the text, then reads it', async () => {
    const { ws, doc } = withBodies()
    const env = makeEnv(ws)
    const r = await readDoc.run(env, { id: env.ids.short('document', doc) })
    expect(r.text).toContain('1 in 8 stalls')
    expect(r.text).not.toContain("isn't loaded")
    expect(env.getWs().bodies?.[doc]?.text).toContain('1 in 8')
  })

  it('through the loop too (its own env hands loadBody on)', async () => {
    const { ws, doc } = withBodies()
    const env = makeEnv(ws)
    const m = stubModel([{ calls: [{ name: 'read_document', args: { id: env.ids.short('document', doc) } }] }, { answer: 'ok' }])
    const r = await runTurn(m, env, AGENT_TOOLS, [], 'what does the pilot say?')
    expect(r.turn.steps[0].results[0].text).toContain('1 in 8 stalls')
  })

  it('a text that can\'t be loaded says so (a reader that finds nothing, as a refused one)', async () => {
    const { ws, doc } = withBodies()
    const env = makeEnv(ws, { readBody: async () => null })
    const r = await readDoc.run(env, { id: env.ids.short('document', doc) })
    expect(r.text).toContain("isn't loaded")
  })
})

describe('the model hears what the person did with a preview (bugs 5, 25)', () => {
  const report = reportOf({ applied: [{ line: '+ card "A"', where: 'Segments · plane' }], notDone: [], step: { key: 'k', label: 'l' } })
  it('applied, discarded, undone: one system line each', () => {
    expect(withOutcome([], { applied: report })).toEqual([{ role: 'system', tag: 'outcome', content: 'The person applied your proposed changes. Applied 1 change on Segments · plane (1), one undo step.' }])
    expect(withOutcome([], { discarded: { text: 'Discarded: nothing changed.', done: [], notDone: [], step: null } })[0].content).toBe('The person discarded your proposed changes: nothing was written. Discarded: nothing changed.')
    expect(withOutcome([{ role: 'user', content: 'q' }], { undone: true })).toHaveLength(2)
  })
})
