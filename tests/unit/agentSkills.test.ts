// S17's skills (D-312; agent.md §4.10, §4.9 layer 7, §6 Phase 9): parsing `/name`, each guide short (≤ ~600 estimated
// tokens) and naming only tools and ops that exist, the system prompt listing names and one-liners only (still ≤ 4k),
// the loop adding a guide for that turn only (never kept in the history), an unknown `/x` sent on as an ordinary
// message with a note listing the skills.
import { describe, expect, it } from 'vitest'
import { parseSkill, skillGuide, SKILLS, SKILL_NAMES, unknownSkillReply } from '../../src/agent/skills'
import { METHODS } from '../../src/agent/skills/methods'
import { systemPrompt } from '../../src/agent/prompt'
import { estimateTokens } from '../../src/agent/read'
import { TOOL_NAMES, AGENT_TOOLS } from '../../src/agent/tools'
import { REGISTRY } from '../../src/ops/registry'
import { runTurn } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { TASKS } from '../../evals/tasks'

describe('skills', () => {
  it('ships the §4.10 table without /research (the web)', () => {
    expect(SKILL_NAMES.sort()).toEqual(['ask', 'compare', 'dedupe', 'digest', 'gaps', 'import', 'interview', 'lean-canvas', 'learn', 'next', 'one-pager', 'organize', 'pitch', 'prioritize', 'review-deck', 'sort-stickies', 'swot', 'test'].sort())
  })

  it('every skill has at least three eval tasks (agent.md §6 Phase 9), each starting with its command', () => {
    for (const s of SKILLS) {
      const mine = TASKS.filter((t) => t.id.startsWith(`skill-${s.name}-`))
      expect(mine.length, s.name).toBeGreaterThanOrEqual(3)
      for (const t of mine) expect(t.ask.startsWith(`/${s.name}`), t.id).toBe(true)
      expect(mine.filter((t) => t.set === 'regression').length, `${s.name}: a regression task`).toBeGreaterThanOrEqual(1)
      expect(mine.filter((t) => !t.graders.some((g) => g.name.startsWith('judge('))).length, `${s.name}: model-free tasks`).toBeGreaterThanOrEqual(3)
    }
  })

  it('parses /name at the very start, case-insensitive, with what follows; not paths or mid-message slashes', () => {
    expect(parseSkill('/gaps')).toMatchObject({ skill: { name: 'gaps' }, rest: '' })
    expect(parseSkill('  /Test "Pre-order bread"')).toMatchObject({ skill: { name: 'test' }, rest: '"Pre-order bread"' })
    expect(parseSkill('/sort-stickies on Bets')).toMatchObject({ skill: { name: 'sort-stickies' }, rest: 'on Bets' })
    expect(parseSkill('/gapz')).toEqual({ unknown: 'gapz' })
    expect(parseSkill('what about /gaps')).toBeNull()
    expect(parseSkill('/usr/bin is a path')).toBeNull()
    expect(parseSkill('/ hello')).toBeNull()
  })

  it('each guide is short (≤ 600 estimated tokens with its methods), says plan-first for big jobs, names only real tools and ops', () => {
    const real = new Set([...TOOL_NAMES, ...REGISTRY.keys()])
    for (const s of SKILLS) {
      const g = skillGuide(s, 'x')
      expect(estimateTokens(g), s.name).toBeLessThanOrEqual(600)
      expect(g.includes('big job'), s.name).toBe(!!s.plan)
      for (const t of s.tools ?? []) expect(real.has(t), `${s.name}: ${t}`).toBe(true)
      for (const w of g.match(/\b[a-z]+_[a-z_]+\b/g) ?? []) expect(real.has(w) || ['no_evidence'].includes(w), `${s.name}: ${w}`).toBe(true)
      expect(s.summary.length, s.name).toBeLessThan(90)
    }
    for (const m of Object.values(METHODS)) expect(estimateTokens(m)).toBeLessThan(300)
  })

  it('the system prompt lists every skill by name and one-liner, but no guide; still ≤ 4k', () => {
    const P = systemPrompt({ workspaceName: 'Pazar' })
    for (const s of SKILLS) expect(P).toContain(`/${s.name}`)
    expect(P).not.toContain('people are kind about the future')
    expect(P).not.toContain('Steps:')
    expect(estimateTokens(P)).toBeLessThanOrEqual(4000)
  })

  it('the loop adds the guide right before the ask for that turn only, and keeps it out of the history', async () => {
    const e = makeEnv(loadFixture('medium'))
    const m = stubModel([{ answer: 'Three gaps.' }, { answer: 'Fine.' }])
    const first = await runTurn(m, e, AGENT_TOOLS, [], '/gaps')
    const req = m.seen[0].messages
    const at = req.findIndex((x) => x.role === 'user')
    expect(req[at - 1]).toMatchObject({ role: 'system' })
    expect(req[at - 1].content).toMatch(/^## Skill: \/gaps/)
    expect(first.history.some((x) => x.content.includes('## Skill:'))).toBe(false)
    m.reset()
    await runTurn(m, e, AGENT_TOOLS, first.history, 'and the next?')
    expect(m.seen[1].messages.some((x) => x.content.includes('## Skill:'))).toBe(false)
  })

  it('an unknown /x goes to the model as an ordinary message, with a one-line note listing the skills', async () => {
    const e = makeEnv(loadFixture('medium'))
    const m = stubModel([{ answer: 'Did you mean /gaps?' }])
    const { turn, history } = await runTurn(m, e, AGENT_TOOLS, [], '/gap what is missing')
    expect(m.seen).toHaveLength(1)
    const req = m.seen[0].messages
    const at = req.findIndex((x) => x.role === 'user')
    expect(req[at].content).toBe('/gap what is missing')
    expect(req[at - 1].content).toMatch(/^The message starts with \/gap, which is not a skill .*\/gaps/)
    expect(req[at - 1].content.split('\n')).toHaveLength(1)
    expect(turn.answer).toBe('Did you mean /gaps?')
    expect(history.some((x) => x.content.startsWith('The message starts with'))).toBe(false)
    expect(unknownSkillReply('zzz')).toContain('/swot')
  })
})
