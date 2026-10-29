// S13 (D-312; agent.md §4.4, §4.5, §7.2): the pending changeset and the real `change` tool on the medium fixture. A
// change call writes nothing; reads see it; items carry plain words, where, dependencies, deletes with their why;
// untick takes an item and what depends on it off while new things keep their ids; accept is ONE undo step as the
// agent and one undo gives the exact start back; dry runs add nothing; viewers are refused; ids resolve only where an
// id goes (names exact, prefixes and ambiguous names answered with candidates); auto-apply's rule.
import { describe, expect, it } from 'vitest'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { realOf } from '../../evals/tasks/util'
import { AGENT_TOOLS } from '../../src/agent/tools'
import { runTurn } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { canAutoApply, closure, previewDiff, viewOf, emptyChangeset, type Changeset } from '../../src/agent/changeset'
import { parseChange, MAX_OPS } from '../../src/agent/change'
import { deleteAny } from '../../src/ops/delete'
import { project } from '../../src/ops/project'
import { diff } from '../../src/ops/diff'
import type { AgentWs } from '../../src/agent/contract'

const change = AGENT_TOOLS.find((t) => t.def.name === 'change')!
const R = (s: string) => realOf('medium', s)
const env = (o: Parameters<typeof makeEnv>[1] = {}) => makeEnv(loadFixture('medium'), o)

const THREE = [
  { op: 'create_card', args: { type: 'idea', plane: 'p3', title: 'Bread club', handle: '$a' } },
  { op: 'create_card', args: { type: 'idea', plane: 'p3', title: 'Cheese club', handle: '$b' } },
  { op: 'link', args: { from: '$a', to: 'c53', kind: 'solves' } },
]

describe('the change tool proposes; nothing is written until accept', () => {
  it('a 3-op batch: items in words grouped by where, new short ids, a short view; nothing written; reads see it', async () => {
    const e = env()
    const r = await change.run(e, { ops: THREE, summary: 'two clubs' })
    expect(r.ok).toBe(true)
    expect(r.text).toMatch(/^Proposed 3 changes \(3 pending in all\)/)
    expect(r.text).toContain('Bets · plane:')
    expect(r.text).toMatch(/i1 add an idea: new idea c\d+ "Bread club"/)
    expect(r.text).toMatch(/i3 link: new link solves: idea "Bread club" → problem "Stall owners carry heavy bags home on foot"/)
    expect(r.text).toMatch(/New: \$a → c\d+, \$b → c\d+, \$3 → e\d+\./)
    expect(r.text).toContain('After the change:\n# p3 plane "Bets"')
    // Nothing written: the env's workspace is the fixture's, no step.
    expect(e.steps).toHaveLength(0)
    expect(e.getWs()).toBe(e.start)
    // The changeset: three items, the link depending on the first card.
    const cs = e.changes!
    expect(cs.items.map((i) => [i.id, i.op, i.dependsOn])).toEqual([
      ['i1', 'create_card', []],
      ['i2', 'create_card', []],
      ['i3', 'link', ['i1']],
    ])
    expect(cs.items.every((i) => i.where === 'Bets · plane')).toBe(true)
    // Reads in the turn see it (the loop's getWs is the view).
    const seen = viewOf(cs, e.getWs())
    expect(seen.cards.filter((c) => ['Bread club', 'Cheese club'].includes(c.title))).toHaveLength(2)
  })

  it('accept: ONE undo step, the agent\'s, labelled agent: …; one undo gives the exact start back', async () => {
    const e = env()
    await change.run(e, { ops: THREE, summary: 'two clubs' })
    await change.run(e, { ops: [{ op: 'update_card', args: { card: 'c53', fields: { tags: ['heavy'] } } }] })
    const a = await e.accept()
    expect(a.ok).toBe(true)
    expect(e.steps).toHaveLength(1)
    expect(e.steps[0]).toMatchObject({ actor: 'agent', applies: 1 })
    expect(e.steps[0].label).toBe('agent: two clubs')
    expect(e.changes!.items).toHaveLength(0)
    const back = project(e.getWs(), [e.steps[0].inverse]) as AgentWs
    expect(diff(e.start, back).size).toBe(0)
  })

  it('later calls build on what is pending and name it by short id; handles stay within their call', async () => {
    const e = env()
    const r1 = await change.run(e, { ops: [{ op: 'create_card', args: { type: 'idea', plane: 'p3', title: 'Bread club', handle: '$a' } }] })
    const short = /\$a → (c\d+)/.exec(r1.text)![1]
    const r2 = await change.run(e, { ops: [{ op: 'create_card', args: { type: 'feature', plane: 'p3', title: 'Club card', handle: '$a', links: [{ to: short, kind: 'part-of' }] } }] })
    expect(r2.ok, r2.text).toBe(true)
    expect(e.changes!.items[1].dependsOn).toEqual(['i1'])
    await e.accept()
    const ws = e.getWs()
    const club = ws.cards.find((c) => c.title === 'Bread club')!
    const card = ws.cards.find((c) => c.title === 'Club card')!
    expect(ws.edges.some((x) => x.fromId === card.id && x.toId === club.id)).toBe(true)
  })
})

describe('untick, drop and dry run', () => {
  it('untick takes the item and what depends on it off; the rest keeps its ids', async () => {
    const e = env()
    await change.run(e, { ops: THREE })
    const before = e.changes!.items.find((i) => i.id === 'i2')!.made
    const off = e.untick('i1')
    expect(off.map((i) => i.id).sort()).toEqual(['i1', 'i3'])
    expect(e.changes!.items.map((i) => i.id)).toEqual(['i2'])
    expect(e.changes!.items[0].made).toEqual(before)
    await e.accept()
    expect(e.getWs().cards.some((c) => c.title === 'Bread club')).toBe(false)
    expect(e.getWs().cards.find((c) => c.title === 'Cheese club')!.id).toBe(before[0])
  })

  it('drop in a later call revises: the item goes, the new op comes, ids of the rest unchanged', async () => {
    const e = env()
    await change.run(e, { ops: THREE })
    const r = await change.run(e, { drop: ['i2'], ops: [{ op: 'create_card', args: { type: 'problem', plane: 'p3', title: 'Cheese goes off' } }] })
    expect(r.ok, r.text).toBe(true)
    expect(r.text).toMatch(/^Took off i2\. Proposed 1 change \(3 pending in all\)/)
    expect(e.changes!.items.map((i) => [i.id, i.op])).toEqual([
      ['i1', 'create_card'],
      ['i3', 'link'],
      ['i4', 'create_card'],
    ])
    expect(e.changes!.off.map((i) => i.id)).toEqual(['i2'])
    expect((await change.run(e, { drop: ['i9'], ops: [] })).text).toContain('there is no pending item i9')
  })

  it('dry run: the same words, nothing added', async () => {
    const e = env()
    const r = await change.run(e, { ops: THREE, dry_run: true })
    expect(r.ok).toBe(true)
    expect(r.text).toMatch(/^Dry run: nothing was added\. Would propose 3 changes/)
    expect(r.text).toMatch(/new idea c\d+ "Bread club"/)
    expect(e.changes!.items).toHaveLength(0)
  })

  it('closure follows dependencies however far', () => {
    const items = [
      { id: 'i1', dependsOn: [] },
      { id: 'i2', dependsOn: ['i1'] },
      { id: 'i3', dependsOn: ['i2'] },
      { id: 'i4', dependsOn: [] },
    ] as unknown as Changeset['items']
    expect(closure(items, ['i1']).sort()).toEqual(['i1', 'i2', 'i3'])
  })
})

describe('what the tool refuses, and how it reads ids', () => {
  it('a delete needs a why, shown in the result; an unlink too', async () => {
    const e = env()
    const no = await change.run(e, { ops: [{ op: 'delete', args: { ids: ['x4'] } }] })
    expect([no.ok, no.text.includes('delete needs a why')]).toEqual([false, true])
    const yes = await change.run(e, { ops: [{ op: 'delete', args: { ids: ['x4'] }, why: 'a duplicate of x5' }] })
    expect(yes.ok, yes.text).toBe(true)
    expect(yes.text).toContain('(why: a duplicate of x5)')
    expect(e.changes!.items[0]).toMatchObject({ delete: true, why: 'a duplicate of x5' })
    expect((await change.run(e, { ops: [{ op: 'unlink', args: { link: 'e52' } }] })).text).toContain('unlink needs a why')
  })

  it("a viewer's agent is read-only", async () => {
    const r = await change.run(env({ role: 'viewer' }), { ops: THREE })
    expect([r.ok, r.text.includes("a viewer's agent is read-only")]).toEqual([false, true])
  })

  it('UI-only and unknown args, coordinates, and keys beside op/args/why are refused', async () => {
    const e = env()
    const say = async (op: unknown) => (await change.run(e, { ops: [op] })).text
    expect(await say({ op: 'create_card', args: { type: 'idea', plane: 'p3', parts: [], moves: [] } })).toContain('moves: not taken here')
    expect(await say({ op: 'move_task', args: { tasks: ['t52'], column: 'done', order: 3 } })).toContain('order: not taken here')
    expect(await say({ op: 'update_card', args: { card: 'c53', x: 10 } })).toContain('coordinate')
    expect(await say({ op: 'rename', args: { id: 'p6', name: 'x' }, when: 'now' })).toContain('when not taken here')
    expect(e.changes!.items).toHaveLength(0)
  })

  it('titles resolve only in id fields: exact names, a prefix asks for the short id, several answer with candidates', async () => {
    const e = env()
    const ok = await change.run(e, { ops: [{ op: 'create_card', args: { type: 'problem', plane: 'Segments', title: 'Bakers near the tram', links: [{ to: 'Bakers near the tram', kind: 'for' }] } }] })
    expect(ok.ok, ok.text).toBe(true)
    const made = viewOf(e.changes, e.getWs()).cards.find((c) => c.title === 'Bakers near the tram' && c.type === 'problem')!
    expect(made.pieceId).toBe(R('p1'))
    // The title stays as written; the link's `to` became the customer.
    expect(viewOf(e.changes, e.getWs()).edges.some((x) => x.fromId === made.id && x.toId === R('c11'))).toBe(true)
    // And the duplicate title is warned about.
    expect(ok.text).toMatch(/≈ c11 "Bakers near the tram" already exists \(customer\)/)
    const prefix = await change.run(e, { ops: [{ op: 'link', args: { from: 'c55', to: 'Bakers near' } }] })
    expect([prefix.ok, /only starts c11/.test(prefix.text)]).toEqual([false, true])
    const many = await change.run(e, { ops: [{ op: 'update_card', args: { card: 'Young parents', fields: { tags: ['x'] } } }] })
    expect(many.ok).toBe(false)
    expect(many.text).toMatch(/could be any of these/)
    expect((await change.run(e, { ops: [{ op: 'update_card', args: { card: 'c9999', fields: { tags: ['x'] } } }] })).text).toContain('there is no c9999')
  })

  it('people by name, email or me for a task\'s assignee', async () => {
    const e = env()
    const r = await change.run(e, { ops: [{ op: 'update_task', args: { task: 't54', assignee: 'Mert Kaya' } }] })
    expect(r.ok, r.text).toBe(true)
    expect(viewOf(e.changes, e.getWs()).tasks.find((t) => t.id === R('t54'))!.assignee).toBe('u-mert')
    const bad = await change.run(e, { ops: [{ op: 'update_task', args: { task: 't54', assignee: 'Nobody Atall' } }] })
    expect([bad.ok, bad.text.includes('nobody called')]).toEqual([false, true])
  })

  it('validate refusals come back with their fix, nothing added', async () => {
    const e = env()
    const r = await change.run(e, { ops: [{ op: 'create_card', args: { type: 'idea', plane: 'p13', title: 'x' } }] })
    expect(r.ok).toBe(false)
    expect(r.text).toMatch(/change refused, nothing added:\n.*fix:/)
    expect(e.changes!.items).toHaveLength(0)
  })

  it('an empty new section is warned about', async () => {
    const e = env()
    const r = await change.run(e, { ops: [{ op: 'create_text', args: { kind: 'section', plane: 'p3', text: 'Later' } }] })
    expect(r.ok, r.text).toBe(true)
    expect(r.text).toMatch(/the new section x\d+ "Later" is empty/)
  })
})

describe('for the preview and the loop', () => {
  it('previewDiff maps a place to its card and tags each change with its item', async () => {
    const e = env()
    await change.run(e, { ops: [{ op: 'place_on', args: { cards: ['c53'], plane: 'p1' } }] })
    const d = previewDiff(e.changes!, e.getWs())
    const place = [...d.values()].find((c) => c.kind === 'places')!
    expect(place).toMatchObject({ change: 'added', owner: R('c53'), item: 'i1' })
    expect(d.get(R('c53'))).toMatchObject({ change: 'changed', fields: ['planes'] })
  })

  it('in a turn, reads after a change see it; the map of the next turn too', async () => {
    const e = env()
    const m = stubModel([{ calls: [{ name: 'change', args: { ops: [THREE[0]] } }] }, { calls: [{ name: 'search', args: { query: 'Bread club' } }] }, { answer: 'ok' }])
    const { turn } = await runTurn(m, e, AGENT_TOOLS, [], 'add')
    expect(turn.steps[1].results[0].text).toContain('Bread club')
    expect(e.steps).toHaveLength(0)
    const m2 = stubModel([{ answer: 'ok' }])
    await runTurn(m2, e, AGENT_TOOLS, [], 'and?')
    expect(JSON.stringify(m2.seen[0].messages[1])).toContain('Bread club')
  })
})

describe('auto-apply (off by default)', () => {
  it('canAutoApply: on, ≤ 5 in the turn, no delete, only the agent\'s own new things', async () => {
    const e = env()
    await change.run(e, { ops: THREE })
    const cs = e.changes!
    expect(canAutoApply(cs, undefined)).toBe(false)
    expect(canAutoApply(cs, { autoApply: false })).toBe(false)
    expect(canAutoApply(cs, { autoApply: true })).toBe(true)
    expect(canAutoApply(cs, { autoApply: true }, { appliedThisTurn: 3 })).toBe(false)
    expect(canAutoApply(emptyChangeset(), { autoApply: true })).toBe(false)
    // Touching an existing card: not its own.
    const e2 = env()
    await change.run(e2, { ops: [{ op: 'update_card', args: { card: 'c53', fields: { tags: ['x'] } } }] })
    expect(canAutoApply(e2.changes!, { autoApply: true })).toBe(false)
    expect(canAutoApply(e2.changes!, { autoApply: true }, { agentMade: [R('c53')] })).toBe(true)
    // A delete never.
    const e3 = env()
    await change.run(e3, { ops: [{ op: 'delete', args: { ids: ['x4'] }, why: 'x' }] })
    expect(canAutoApply(e3.changes!, { autoApply: true }, { agentMade: [R('x4')] })).toBe(false)
  })

  it('on: small batches apply at once and a turn\'s several applies are one undo step', async () => {
    const e = env({ settings: { autoApply: true } })
    const m = stubModel([
      { calls: [{ name: 'change', args: { ops: [THREE[0]] } }] },
      { calls: [{ name: 'change', args: { ops: [THREE[1]] } }] },
      { answer: 'ok' },
    ])
    const { turn } = await runTurn(m, e, AGENT_TOOLS, [], 'add two')
    expect(turn.steps[0].results[0].text).toMatch(/^Applied at once \(auto-apply is on/)
    expect(e.steps).toHaveLength(1)
    expect(e.steps[0].applies).toBe(2)
    expect(e.changes!.items).toHaveLength(0)
    const back = project(e.getWs(), [e.steps[0].inverse]) as AgentWs
    expect(diff(e.start, back).size).toBe(0)
  })
})

describe('reviewer fixes', () => {
  it('a canvas named under from: move_to_canvas and place_on read it as a canvas', () => {
    const e = env()
    const ws = e.getWs()
    const m = parseChange(ws, e.ids, { ops: [{ op: 'move_to_canvas', args: { items: ['p1'], canvas: 'Build', from: 'Discovery' } }] })
    expect(m.ok && m.ops[0].args).toMatchObject({ canvas: 'canv0000000000000001', from: 'main' })
    const p = parseChange(ws, e.ids, { ops: [{ op: 'place_on', args: { pieces: ['p1'], canvas: 'Build', from: 'Discovery' } }] })
    expect(p.ok && p.ops[0].args).toMatchObject({ from: 'main' })
  })

  it('a stale preview at accept: rebuilt on the workspace as it is; what came off goes back to the person in names, nothing written', async () => {
    const e = env()
    await change.run(e, { ops: THREE })
    // A collaborator deletes the problem the link names (as the person, through the same env).
    const del = deleteAny({ ws: e.getWs(), actor: { uid: e.actor.uid, role: 'editor' }, now: 1, newId: () => 'x' }, { ids: [R('c53')] })
    const gone = await e.apply([del], { actor: 'person' } as never)
    expect(gone.ok).toBe(true)
    const steps = e.steps.length
    const a = await e.accept()
    expect(a.ok).toBe(false)
    if (a.ok) return
    expect(a.stale).toBe(true)
    expect(a.said).toMatch(/^Not applied: the workspace changed since the preview, so one change no longer works and came off: link: new link solves: idea "Bread club"/)
    expect(a.said).not.toMatch(/[A-Za-z0-9]{20}/)
    expect(e.steps.length).toBe(steps)
    // What's left is still pending; accepting again applies it.
    expect(e.changes!.items.map((i) => i.id)).toEqual(['i1', 'i2'])
    const b = await e.accept()
    expect(b.ok).toBe(true)
  })

  it('at most MAX_OPS ops a call; a title "$a" stays text while $a under an id key is the handle', async () => {
    const e = env()
    const many = Array.from({ length: MAX_OPS + 1 }, (_, i) => ({ op: 'create_card', args: { type: 'idea', plane: 'p3', title: `x${i}` } }))
    expect((await change.run(e, { ops: many })).text).toMatch(new RegExp(`at most ${MAX_OPS}`))
    const r = await change.run(e, { ops: [
      { op: 'create_card', args: { type: 'idea', plane: 'p3', title: 'Club', handle: '$a' } },
      { op: 'create_card', args: { type: 'idea', plane: 'p3', title: '$a', links: [{ to: '$a', kind: 'relates' }] } },
    ] })
    expect(r.ok, r.text).toBe(true)
    const ws = viewOf(e.changes, e.getWs())
    const club = ws.cards.find((c) => c.title === 'Club')!
    const literal = ws.cards.find((c) => c.title === '$a')!
    expect(literal).toBeTruthy()
    expect(ws.edges.some((x) => x.fromId === literal.id && x.toId === club.id)).toBe(true)
  })

  it('a dry run gives no real short ids', async () => {
    const e = env()
    const before = JSON.stringify(e.ids.toJSON())
    const r = await change.run(e, { ops: THREE, dry_run: true })
    expect(r.text).toContain('only examples')
    expect(JSON.stringify(e.ids.toJSON())).toBe(before)
  })
})
