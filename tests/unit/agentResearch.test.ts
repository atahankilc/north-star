// `/research` (D-360 step 2, src/agent/research.ts): the `research` tool runs only in /research after go; each question
// is its own researcher (the turn's model, no tools, the web on, only the context and the question), at most
// RESEARCHERS at once, in the order asked; a failed one says so and the rest go on; their tokens, searches and pages join
// the turn's; a search they run is said as a step line. The skill plans before it searches, and its check sends back
// a proposal with no document or a document with no links.
import { describe, expect, it } from 'vitest'
import { runTurn } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { AGENT_TOOLS } from '../../src/agent/tools'
import { foundText, researchAll, researchTool, RESEARCHER_PROMPT } from '../../src/agent/research'
import { RESEARCHERS, RESEARCH_QUESTIONS } from '../../src/agent/web'
import { skillGuide, skillNamed } from '../../src/agent/skills'
import type { AgentModel, ModelRequest, ModelResponse } from '../../src/agent/contract'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { TASKS } from '../../evals/tasks'

// A model that answers each researcher after a pause, counting how many run at once.
function slowResearchers(o: { fail?: string } = {}) {
  const seen: ModelRequest[] = []
  let now = 0
  let most = 0
  const model: AgentModel = {
    name: 'fake',
    async respond(req) {
      seen.push(req)
      now++
      most = Math.max(most, now)
      await new Promise((r) => setTimeout(r, 5))
      now--
      const q = /The question: (.*)$/m.exec(String(req.messages[1]?.content))?.[1] ?? ''
      if (o.fail && q.includes(o.fail)) throw new Error('rate limited')
      const res: ModelResponse = { text: `Found for ${q} ([page](https://site.example/${q.length}))`, toolCalls: [], usage: { input: 100, output: 20, searches: 2 }, stop: 'end', web: { queries: [`q ${q}`], sources: [{ url: `https://site.example/${q.length}`, title: 'page', cited: true }] } }
      return res
    },
  }
  return { model, seen, most: () => most }
}

const QS = ['one?', 'two two?', 'three three three?', 'four four four four?', 'five?????']

describe('/research', () => {
  it('runs each question as its own researcher: no tools, the web on, only the context and the question; at most RESEARCHERS at once, in order', async () => {
    const f = slowResearchers()
    const found = await researchAll(f.model, QS, 'Pazar: pre-orders from market stalls')
    expect(f.most()).toBe(RESEARCHERS)
    expect(found.map((x) => x.question)).toEqual(QS)
    for (const r of f.seen) {
      expect(r.tools).toEqual([])
      expect(r.web).toBe(true)
      expect(r.messages).toHaveLength(2)
      expect(r.messages[0]).toEqual({ role: 'system', content: RESEARCHER_PROMPT })
      expect(r.messages[1].content).toMatch(/^The startup: Pazar: pre-orders from market stalls\n\nThe question: /)
    }
  })

  it('a failed researcher says so and the others go on; the findings list each question with its pages', async () => {
    const f = slowResearchers({ fail: 'two' })
    const found = await researchAll(f.model, QS.slice(0, 3), 'ctx')
    expect(found[1].error).toBe('rate limited')
    const text = foundText(found)
    expect(text).toContain('## Q2. two two?\nNot researched: rate limited')
    expect(text).toContain('## Q1. one?\nFound for one?')
    expect(text).toContain('- [page](https://site.example/4)')
  })

  it('the tool runs only in /research, takes 1–6 questions, and keeps the context short', async () => {
    const env = makeEnv(loadFixture('medium'))
    const f = slowResearchers()
    expect((await researchTool.run({ ...env, model: f.model }, { questions: ['a?'], context: 'x' })).text).toMatch(/only in \/research/)
    const inSkill = { ...env, model: f.model, skill: 'research' }
    expect((await researchTool.run(inSkill, { questions: [], context: 'x' })).ok).toBe(false)
    expect((await researchTool.run(inSkill, { questions: Array.from({ length: RESEARCH_QUESTIONS + 1 }, (_, i) => `q${i}?`), context: 'x' })).text).toMatch(/at most 6/)
    const r = await researchTool.run(inSkill, { questions: ['a?', 'a?'], context: 'y'.repeat(2000) })
    expect(f.seen).toHaveLength(1)
    expect(String(f.seen[0].messages[1].content).length).toBeLessThan(700)
    expect(r.usage).toMatchObject({ input: 100, output: 20, searches: 2 })
    expect(r.web?.sources).toEqual([{ url: 'https://site.example/2', title: 'page', cited: true }])
  })

  it("in a turn: the researchers' tokens, searches and pages join the turn's, and their searches are step lines", async () => {
    const f = slowResearchers()
    // The agent: a research call after go, then its answer; the researchers answer from the same model.
    const script: ModelResponse[] = [
      { text: '', toolCalls: [{ id: 'r1', name: 'research', args: { questions: ['one?', 'two two?'], context: 'Pazar' } }], usage: { input: 1000, output: 50 }, stop: 'tool_calls' },
      { text: 'The research waits in the preview.', toolCalls: [], usage: { input: 1200, output: 30 }, stop: 'end' },
    ]
    const model: AgentModel = {
      name: 'fake',
      async *stream(req) {
        if (!req.tools.length) {
          const res = await f.model.respond(req)
          for (const q of res.web?.queries ?? []) yield { type: 'search', query: q }
          yield { type: 'done', response: res }
          return
        }
        yield { type: 'done', response: script.shift()! }
      },
      async respond() {
        throw new Error('streams')
      },
    }
    const searches: string[] = []
    const env = makeEnv(loadFixture('medium'))
    const history = [{ role: 'user' as const, content: '/research market fees' }, { role: 'assistant' as const, content: '1. one?\n2. two two?' }]
    const r = await runTurn(model, env, AGENT_TOOLS, history, 'go', { onEvent: (e) => void (e.type === 'search' && searches.push(e.query)) })
    expect(r.turn.end).toBe('answered')
    expect(r.turn.steps[0].results[0]).toMatchObject({ name: 'research', ok: true })
    expect(searches.sort()).toEqual(['q one?', 'q two two?'])
    expect(r.turn.usage).toMatchObject({ input: 2400, output: 120, searches: 4 })
    expect(r.turn.sources?.map((s) => s.url).sort()).toEqual(['https://site.example/4', 'https://site.example/8'])
  })

  it('plans before it searches; the guide names the tool, the link form and the context rule', () => {
    const g = skillGuide(skillNamed('research')!, 'rival fees')
    expect(g).toMatch(/big job: answer first with a short numbered plan/)
    expect(g).toMatch(/Never search before go/)
    expect(g).toMatch(/one research call/)
    expect(g).toMatch(/\[title\]\(url\)/)
    expect(g).toMatch(/Nothing else of the workspace goes into it/)
  })

  it('the check sends back a document with no links once, then warns in the preview; the linked reference passes', async () => {
    const task = TASKS.find((t) => t.id === 'skill-research-01')!
    const play = async (script: typeof task.reference) => {
      const env = makeEnv(loadFixture('medium'))
      const model = stubModel(script, { research: task.research })
      const first = await runTurn(model, env, AGENT_TOOLS, [], task.ask)
      const second = await runTurn(model, env, AGENT_TOOLS, first.history, 'go')
      return { warnings: env.changes?.warnings ?? [], history: second.history }
    }
    expect((await play(task.reference)).warnings.filter((w) => w.model.startsWith('/research'))).toEqual([])
    const unlinked = [
      ...task.reference.slice(0, 3),
      { calls: [{ name: 'change', args: { ops: [{ op: 'create_document', args: { title: 'Research: fees', text: '# Research\n- c47 "Localmate" takes 8 %.' } }] } }] },
      { answer: 'Wrote it.' },
      { answer: 'Left as it is.' },
    ]
    const r = await play(unlinked)
    expect(r.history.some((m) => m.role === 'system' && /links no web page/.test(m.content))).toBe(true)
    expect(r.warnings.map((w) => w.person)).toContain('/research: the document "Research: fees" names no sources')
  })

  it('two research calls in one step never put more than RESEARCHERS on the web: the second is refused', async () => {
    let now = 0
    let most = 0
    let researchers = 0
    const script: ModelResponse[] = [
      { text: '', toolCalls: [
        { id: 'r1', name: 'research', args: { questions: ['a1?', 'a2?', 'a3?'], context: 'P' } },
        { id: 'r2', name: 'research', args: { questions: ['b1?', 'b2?', 'b3?'], context: 'P' } },
      ], usage: { input: 1, output: 1 }, stop: 'tool_calls' },
      { text: 'done', toolCalls: [], usage: { input: 1, output: 1 }, stop: 'end' },
    ]
    const model: AgentModel = {
      name: 'fake',
      async respond(req) {
        if (req.tools.length) return script.shift()!
        researchers++
        now++
        most = Math.max(most, now)
        await new Promise((r) => setTimeout(r, 5))
        now--
        return { text: 'x [p](https://a.example/1)', toolCalls: [], usage: { input: 1, output: 1 }, stop: 'end' }
      },
    }
    const env = makeEnv(loadFixture('medium'))
    const history = [{ role: 'user' as const, content: '/research fees' }, { role: 'assistant' as const, content: '1. a' }]
    const r = await runTurn(model, env, AGENT_TOOLS, history, 'go')
    expect(most).toBeLessThanOrEqual(RESEARCHERS)
    expect(researchers).toBe(3)
    expect(r.turn.steps[0].results.map((x) => x.ok)).toEqual([true, false])
    expect(r.turn.steps[0].results[1].text).toMatch(/already running this turn/)
  })

  it("a stop during research keeps what the finished researchers spent, and starts no new one", async () => {
    const ac = new AbortController()
    let calls = 0
    const script: ModelResponse[] = [{ text: '', toolCalls: [{ id: 'r1', name: 'research', args: { questions: ['a1?', 'a2?', 'a3?', 'a4?'], context: 'P' } }], usage: { input: 1, output: 1 }, stop: 'tool_calls' }]
    const model: AgentModel = {
      name: 'fake',
      async respond(req) {
        if (req.tools.length) return script.shift()!
        // The first answers at once and the person stops right after; the others wait until the stop (no timers: the
        // order never depends on how busy the machine is).
        if (++calls === 1) {
          setTimeout(() => ac.abort(), 0)
          return { text: 'x', toolCalls: [], usage: { input: 1000, output: 500, searches: 5 }, stop: 'end' }
        }
        return new Promise((_, no) => req.signal?.addEventListener('abort', () => no(Object.assign(new Error('stopped'), { name: 'AbortError' }))))
      },
    }
    const env = makeEnv(loadFixture('medium'))
    const history = [{ role: 'user' as const, content: '/research fees' }, { role: 'assistant' as const, content: '1. a' }]
    const r = await runTurn(model, env, AGENT_TOOLS, history, 'go', { signal: ac.signal })
    expect(r.turn.end).toBe('stopped')
    expect(r.turn.usage).toMatchObject({ input: 1001, output: 501, searches: 5 })
    // The first's worker took the fourth question before the stop; nothing started after it.
    expect(calls).toBe(RESEARCHERS + 1)
  })

  it('a plan turn with an earlier preview still waiting gets no research check', async () => {
    const env = makeEnv(loadFixture('medium'))
    const plane = loadFixture('medium').pieces.find((p) => p.kind === 'plane')!
    const m1 = stubModel([
      { calls: [{ name: 'change', args: { ops: [{ op: 'create_card', args: { type: 'idea', plane: env.ids.short('piece', plane.id), title: 'Pending idea' } }], summary: 'one idea' } }] },
      { answer: 'Proposed an idea.' },
    ])
    const t1 = await runTurn(m1, env, AGENT_TOOLS, [], 'add an idea')
    expect(env.changes?.items.length).toBeGreaterThan(0)
    const m2 = stubModel([{ answer: '1. What does Localmate charge?\n2. Who else?\nSay go.' }, { answer: 'again' }])
    const t2 = await runTurn(m2, env, AGENT_TOOLS, t1.history, '/research rival fees')
    expect(t2.history.some((m) => m.role === 'system' && /not written up/.test(m.content))).toBe(false)
    expect((env.changes?.warnings ?? []).filter((w) => w.model.startsWith('/research'))).toEqual([])
  })
})
