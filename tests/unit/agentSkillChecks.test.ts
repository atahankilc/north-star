// A skill's checks (agent-bugs 21, src/agent/skills/checks.ts): run once when a skill's turn ends with changes waiting;
// what they find goes back to the model for one more step, and what's left goes into the preview's warnings. A plan
// skill's guide comes again on its `go` turn (its "on go" steps are for it).
import { describe, expect, it } from 'vitest'
import { runTurn } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { AGENT_TOOLS } from '../../src/agent/tools'
import type { ModelMessage } from '../../src/agent/contract'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { TASKS } from '../../evals/tasks'

type Script = Parameters<typeof stubModel>[0]

// A task's ask and its follow-ups (text ones) through the loop on one script, as the evals run it.
async function play(id: string, script: Script) {
  const task = TASKS.find((t) => t.id === id)!
  const ws = loadFixture(task.fixture)
  const e = makeEnv(task.setup ? task.setup(ws) : ws)
  const m = stubModel(script)
  let history: ModelMessage[] = []
  let last
  for (const ask of [task.ask, ...(task.followUps ?? []).filter((f): f is string => typeof f === 'string')]) {
    last = await runTurn(m, e, AGENT_TOOLS, history, ask)
    history = last.history
  }
  const checks = m.seen.flatMap((r) => r.messages.filter((x) => x.role === 'system' && x.tag === 'checks').map((x) => x.content))
  return { e, m, turn: last!.turn, history, checks: [...new Set(checks)] }
}
const wrongOf = (id: string) => TASKS.find((t) => t.id === id)!.wrong as Script
const refOf = (id: string) => TASKS.find((t) => t.id === id)!.reference as Script

describe('a skill\'s checks (agent-bugs 21)', () => {
  it('/test: an idea given test tasks but left a hypothesis is found once; what is left goes to the preview', async () => {
    const { e, checks, turn, m } = await play('skill-test-01', [...wrongOf('skill-test-01'), { answer: 'Left it: the person decides.' }])
    expect(checks).toHaveLength(1)
    expect(checks[0]).toMatch(/the \/test guide's checks found:\n- the idea c58 "Pre-order bread for pickup" gets test tasks but is still hypothesis/)
    expect(turn.answer).toBe('Left it: the person decides.')
    expect(e.changes!.warnings.some((w) => w.model.startsWith('/test: the idea c58'))).toBe(true)
    // One more step only: the checks never loop.
    expect(m.seen.filter((r) => r.messages.at(-1)?.role === 'system' && (r.messages.at(-1) as { tag?: string }).tag === 'checks')).toHaveLength(1)
  })

  it('/test: the guide comes again on the go turn, and not on the turn after', async () => {
    const { m, history, e } = await play('skill-test-01', refOf('skill-test-01'))
    const guides = (i: number) => m.seen[i].messages.filter((x) => x.role === 'system' && x.content.startsWith('## Skill: /test')).length
    expect(guides(0)).toBe(1)
    const goAt = m.seen.findIndex((r) => r.messages.some((x) => x.role === 'user' && x.content === 'go'))
    expect(guides(goAt)).toBe(1)
    const m2 = stubModel([{ answer: 'ok' }])
    await runTurn(m2, e, AGENT_TOOLS, history, 'thanks')
    expect(m2.seen[0].messages.some((x) => x.content.startsWith('## Skill:'))).toBe(false)
  })

  it('the reference scripts set off no check (test, import, compare)', async () => {
    for (const id of ['skill-test-01', 'skill-import-01', 'skill-compare-02']) expect((await play(id, refOf(id))).checks).toEqual([])
  })

  it('/import: new cards with no for link to the customer the ask names', async () => {
    const { checks } = await play('skill-import-01', wrongOf('skill-import-01'))
    expect(checks[0]).toMatch(/the ask names the customer c11 "Bakers near the tram", but 3 of the 3 new cards have no for link to it/)
  })

  it('/compare: a matrix over every feature when the ask named a plane', async () => {
    const { checks } = await play('skill-compare-02', wrongOf('skill-compare-02'))
    expect(checks[0]).toMatch(/takes every feature, but the ask names p10 "Pricing": set rows.plane to it/)
  })

  it('/prioritize: features on the plane asked about still without impact or effort', async () => {
    // Only c142 filled on go: c146 and c147 still have no effort.
    const script: Script = [{ answer: 'Plan: fill the gaps. Say go.' }, { calls: [{ name: 'change', args: { ops: [{ op: 'update_card', args: { card: 'c142', fields: { impact: 'medium' } } }] } }] }, { answer: 'Done.' }]
    const { checks } = await play('skill-prioritize-01', script)
    expect(checks[0]).toMatch(/2 features on p10 "Pricing" still lack impact or effort \(c146 "Seasonal boxes QR codes" no effort, c147 "The weekly basket map" no effort\)/)
  })
})
