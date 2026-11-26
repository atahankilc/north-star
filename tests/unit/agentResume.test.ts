// A turn that goes on from a state (D-434, loop.ts' `onStep` and `resume`): cut before every step and resumed from JSON
// alone (evals/cut.ts), it sends the model the same requests and gives the same turn, history and changes as one never
// cut; for a model that replays the whole chat and for one whose history only grows (Claude's).
import { describe, expect, it } from 'vitest'
import { runTurn, type TurnState } from '../../src/agent/loop'
import { stubModel, type Script, type StubModel } from '../../src/agent/stubModel'
import { AGENT_TOOLS } from '../../src/agent/tools'
import type { ModelMessage, ModelRequest } from '../../src/agent/contract'
import { makeIds } from '../../src/agent/read'
import { makeEnv } from '../../evals/env'
import { runCut } from '../../evals/cut'
import { attempt, referenceModel } from '../../evals/run'
import { TASKS } from '../../evals/tasks'
import { loadFixture } from '../../evals/fixtures'

const env = () => makeEnv(loadFixture('medium'))
// Times differ between two runs; nothing else may.
const plain = (v: unknown) => JSON.parse(JSON.stringify(v, (k, x) => (k === 'ms' ? undefined : x)))
const sent = (m: StubModel) => m.seen.map((r: ModelRequest) => plain({ messages: r.messages, tools: r.tools.map((t) => t.name), toolChoice: r.toolChoice ?? null, web: !!r.web }))
const add: Script = [
  { calls: [{ name: 'search', args: { query: 'stall' } }, { name: 'where_am_i', args: {} }] },
  { calls: [{ name: 'view', args: { piece: 'p1' } }], text: 'Looking.' },
  { calls: [{ name: 'change', args: { summary: 'a problem', ops: [{ op: 'create_card', args: { plane: 'p1', type: 'problem', title: 'Rain soaks the stalls', handle: '$a' } }] } }] },
  { calls: [{ name: 'search', args: { query: 'Rain soaks' } }] },
  { answer: 'One problem is in the preview.' },
]

describe('a turn resumed from JSON before every step', () => {
  for (const appendOnly of [false, true])
    it(`${appendOnly ? 'append-only' : 'replayed'}: the same requests, turn, history and changes`, async () => {
      const make = () => Object.assign(stubModel(add), appendOnly ? { appendOnly: true, provider: 'anthropic' as const } : {})
      const past: ModelMessage[] = [{ role: 'user', content: 'earlier' }, { role: 'assistant', content: 'yes' }]
      const [a, b] = [make(), make()]
      const [ea, eb] = [env(), env()]
      const whole = await runTurn(a, ea, AGENT_TOOLS, past, 'add a problem about rain', { turnId: 't1' })
      const cut = await runCut(b, eb, AGENT_TOOLS, past, 'add a problem about rain', { turnId: 't1' })
      expect(cut.cuts).toBe(5)
      expect(whole.turn.end).toBe('answered')
      expect(ea.changes!.items).toHaveLength(1)
      expect(sent(b)).toEqual(sent(a))
      expect(plain(cut.turn)).toEqual(plain(whole.turn))
      expect(plain(cut.history)).toEqual(plain(whole.history))
      expect(plain(eb.changes)).toEqual(plain(ea.changes))
      expect(eb.ids.toJSON()).toEqual(ea.ids.toJSON())
    })

  it('what the person wrote meanwhile is in the state before the call, so it is never lost or sent twice', async () => {
    const said = ['only the covered stalls']
    const m = stubModel([{ calls: [{ name: 'where_am_i', args: {} }] }, { calls: [{ name: 'where_am_i', args: {} }] }, { answer: 'ok' }])
    const { history } = await runCut(m, env(), AGENT_TOOLS, [], 'go', { steer: () => said.splice(0) })
    expect(history.filter((x) => x.role === 'user' && x.content.includes('only the covered stalls'))).toHaveLength(1)
  })

  it('what onStep throws ends the turn by throwing: nothing more is asked of the model', async () => {
    const m = stubModel([{ calls: [{ name: 'where_am_i', args: {} }] }, { answer: 'ok' }])
    await expect(runTurn(m, env(), AGENT_TOOLS, [], 'go', { onStep: (s: TurnState) => (s.n === 2 ? Promise.reject(new Error('left the workspace')) : undefined) })).rejects.toThrow('left the workspace')
    expect(m.seen).toHaveLength(1)
  })

  for (const appendOnly of [false, true])
    it(`${appendOnly ? 'append-only' : 'replayed'}: resumed in a workspace and a view that changed meanwhile, the state and what was sent stay as they were`, async () => {
      const make = (script: Script) => Object.assign(stubModel(script), appendOnly ? { appendOnly: true, provider: 'anthropic' as const } : {})
      const script: Script = [{ calls: [{ name: 'where_am_i', args: {} }] }, { calls: [{ name: 'search', args: { query: 'stall' } }] }, { answer: 'ok' }]
      // Cut before the third step of a skill's turn (its guide, the planes it's about).
      let state: TurnState | null = null
      const first = make(script)
      const e1 = env()
      await runTurn(first, e1, AGENT_TOOLS, [], '/compare our features with the rivals', {
        onStep: (x) => {
          if (x.n < 3) return
          state = JSON.parse(JSON.stringify(x))
          throw new Error('cut')
        },
      }).catch(() => undefined)
      // Every flag set, so one that isn't carried over shows.
      const kept: TurnState = { ...state!, checked: true, trimmed: true, nudged: true, researched: true, about: ['somewhere'], before: ['i7'] }
      expect(kept.skill?.name).toBe('compare')
      const fixture = loadFixture('medium')
      const later = makeEnv({ ...fixture, workspace: { ...fixture.workspace, name: 'Renamed' }, cards: fixture.cards.slice(3) }, { view: { focus: fixture.pieces[0].id } })
      later.ids = makeIds(e1.ids.toJSON())
      const second = make([{ answer: 'ok' }])
      let again: TurnState | null = null
      await runTurn(second, later, AGENT_TOOLS, [], '', { resume: kept, onStep: (x) => void (again ??= plain(x)) })
      expect(again).toEqual(plain(kept))
      const before = plain(first.seen[1].messages) as unknown[]
      const after = plain(second.seen[0].messages) as unknown[]
      expect(after.slice(0, before.length)).toEqual(before)
      // Resumed by newer code whose words differ (a deploy mid-run): the state's own words are used.
      const old = (tag: 'map' | 'guide' | 'where'): ModelMessage => ({ role: 'system', tag, content: `as it was: ${tag}` })
      const words: TurnState = { ...kept, guide: [old('guide')], lead: [old('map')], context: [old('where')], notesText: 'as it was: notes' }
      let same: TurnState | null = null
      await runTurn(make([{ answer: 'ok' }]), later, AGENT_TOOLS, [], '', { resume: words, onStep: (x) => void (same ??= plain(x)) })
      expect(same).toEqual(plain(words))
    })

  it('every eval task on the stub, whole and cut: the same transcripts and the same verdict', async () => {
    for (const task of TASKS) {
      const whole = (await attempt(task, referenceModel(task))).attempt
      const cut = (await attempt(task, referenceModel(task), { cut: true })).attempt
      expect([task.id, cut.verdict]).toEqual([task.id, whole.verdict])
      expect([task.id, plain(cut.transcript)]).toEqual([task.id, plain(whole.transcript)])
      expect([task.id, cut.changes]).toEqual([task.id, whole.changes])
    }
  }, 120_000)
})
