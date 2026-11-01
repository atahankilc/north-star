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
import { placeOnPlan } from '../../src/ops/places'
import { counterIds } from '../../src/ops/newId'

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

describe('place_on names what it brings along (bug 27)', () => {
  it('parts and members it brought, by short id and title', async () => {
    const ws = loadFixture('medium')
    const planes = ws.pieces.filter((p) => p.kind === 'plane')
    // A card that brings others with it, onto a plane where none of them is.
    let found: { card: string; plane: string; along: string[] } | null = null
    for (const c of ws.cards) {
      for (const p of planes) {
        const r = placeOnPlan({ ws, actor: { uid: 'u', role: 'editor', agent: true }, now: 0, newId: counterIds('t') }, { cards: [c.id], plane: p.id })
        if (r.list.length > 1 && r.list.some((x) => x.id === c.id)) found = { card: c.id, plane: p.id, along: r.list.filter((x) => x.id !== c.id).map((x) => x.id) }
        if (found) break
      }
      if (found) break
    }
    expect(found).not.toBeNull()
    const env = makeEnv(ws)
    const change = AGENT_TOOLS.find((t) => t.def.name === 'change')!
    const r = await change.run(env, { ops: [{ op: 'place_on', args: { cards: [env.ids.short('card', found!.card)], plane: env.ids.short('piece', found!.plane) } }] })
    expect(r.ok, r.text).toBe(true)
    const line = r.text.split('\n').find((l) => l.includes('also brought along'))!
    expect(line).toBeDefined()
    for (const id of found!.along) expect(line).toContain(env.ids.short('card', id))
    expect(line).not.toContain(`${env.ids.short('card', found!.card)} `)
  })

  it('nothing said when only the cards asked for came', async () => {
    const env = makeEnv(loadFixture('medium'))
    const change = AGENT_TOOLS.find((t) => t.def.name === 'change')!
    const r = await change.run(env, { ops: [{ op: 'place_on', args: { cards: ['c53'], plane: 'p1' } }] })
    expect(r.ok, r.text).toBe(true)
    expect(r.text).not.toContain('also brought along')
  })
})

describe("a step whose last change was refused can't be marked done (bug 28)", () => {
  const tool = (n: string) => AGENT_TOOLS.find((t) => t.def.name === n)!
  it('refused, then fixed: done only after the change went in', async () => {
    const env = makeEnv(loadFixture('medium'))
    expect((await tool('plan').run(env, { title: 'Two steps', steps: [{ title: 'Add a problem' }, { title: 'Link it' }] })).ok).toBe(true)
    await tool('progress').run(env, { step: 1, state: 'doing' })
    const bad = await tool('change').run(env, { ops: [{ op: 'create_card', args: { type: 'problem', title: 'Bags run out', plane: 'no such plane' } }] })
    expect(bad.ok).toBe(false)
    const refused = await tool('progress').run(env, { step: 1, state: 'done' })
    expect(refused.ok).toBe(false)
    expect(refused.text).toMatch(/last change was refused/)
    // A dry run doesn't count either way.
    await tool('change').run(env, { ops: [{ op: 'create_card', args: { type: 'problem', title: 'Bags run out', plane: 'p1' } }], dry_run: true })
    expect((await tool('progress').run(env, { step: 1, state: 'done' })).ok).toBe(false)
    const good = await tool('change').run(env, { ops: [{ op: 'create_card', args: { type: 'problem', title: 'Bags run out', plane: 'p1' } }] })
    expect(good.ok, good.text).toBe(true)
    expect((await tool('progress').run(env, { step: 1, state: 'done' })).ok).toBe(true)
    // Skipping stays open after a refusal.
    await tool('progress').run(env, { step: 2, state: 'doing' })
    await tool('change').run(env, { ops: [{ op: 'link', args: { from: 'nothing', to: 'nobody' } }] })
    expect((await tool('progress').run(env, { step: 2, state: 'skipped', why: 'no card to link to' })).ok).toBe(true)
  })
})

describe("a viewer's agent is offered no write tool (bug 18)", () => {
  it('the loop drops change and adds the read-only note for a viewer, in the evals as in the app', async () => {
    const { READ_ONLY } = await import('../../src/agent/prompt')
    const seen: { tools: string[]; system: string }[] = []
    const model = { name: 'spy', async respond(req: { tools: { name: string }[]; messages: { role: string; content: unknown }[] }) {
      seen.push({ tools: req.tools.map((t) => t.name), system: String(req.messages.find((m) => m.role === 'system')?.content ?? '') })
      return { text: 'ok', toolCalls: [], usage: { input: 0, output: 0, cached: 0, reasoning: 0 }, stop: 'end' as const }
    } }
    await runTurn(model as never, makeEnv(loadFixture('medium'), { role: 'viewer' }), AGENT_TOOLS, [], 'mark it global')
    await runTurn(model as never, makeEnv(loadFixture('medium'), { role: 'editor' }), AGENT_TOOLS, [], 'mark it global')
    expect(seen[0].tools).not.toContain('change')
    expect(seen[0].system).toContain(READ_ONLY)
    expect(seen[1].tools).toContain('change')
    expect(seen[1].system).not.toContain(READ_ONLY)
  })
})
