// The eval report (S11, D-312; agent.md §6 Phase 3): per task pass/fail with why, pass rates per group and set, pass^k,
// unjudged attempts (an LLM judge skipped: counted apart, never as a pass), steps, tokens (cached and reasoning too),
// cost, time; written as report.md + report.json, with every attempt's transcript under transcripts/.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskResult } from './run'
import { priced } from './prices'

const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)} %` : '-')

export type Rates = { tasks: number; pass1: number; passK: number; unjudged: number; failed: number; steps: number; input: number; cached: number; output: number; reasoning: number; cost: number; ms: number }

export function rates(results: TaskResult[]): Rates {
  const r: Rates = { tasks: results.length, pass1: 0, passK: 0, unjudged: 0, failed: 0, steps: 0, input: 0, cached: 0, output: 0, reasoning: 0, cost: 0, ms: 0 }
  for (const t of results) {
    if (t.attempts[0]?.verdict === 'pass') r.pass1++
    if (t.attempts.every((a) => a.verdict === 'pass')) r.passK++
    if (t.attempts.some((a) => a.verdict === 'fail')) r.failed++
    else if (t.attempts.some((a) => a.verdict === 'unjudged')) r.unjudged++
    for (const a of t.attempts) {
      r.steps += a.steps
      r.input += a.usage.input
      r.cached += a.usage.cached ?? 0
      r.output += a.usage.output
      r.reasoning += a.usage.reasoning ?? 0
      r.cost += a.cost
      r.ms += a.ms
    }
  }
  return r
}

function table(rows: [string, Rates][], k: number): string {
  const head = `| | tasks | pass@1 | pass^${k} | unjudged | failed | steps | tokens in (cached) | out (reasoning) | cost | time |\n|---|---|---|---|---|---|---|---|---|---|---|`
  return [
    head,
    ...rows.map(([name, r]) => `| ${name} | ${r.tasks} | ${r.pass1}/${r.tasks} (${pct(r.pass1, r.tasks)}) | ${r.passK}/${r.tasks} (${pct(r.passK, r.tasks)}) | ${r.unjudged} | ${r.failed} | ${r.steps} | ${r.input} (${r.cached}) | ${r.output} (${r.reasoning}) | $${r.cost.toFixed(4)} | ${(r.ms / 1000).toFixed(1)} s |`),
  ].join('\n')
}

export function summarise(results: TaskResult[], repeat: number): string {
  const by = <K extends string>(key: (t: TaskResult) => K) => {
    const m = new Map<K, TaskResult[]>()
    for (const t of results) m.set(key(t), [...(m.get(key(t)) ?? []), t])
    return [...m].map(([k, list]) => [k, rates(list)] as [string, Rates])
  }
  return table([['all', rates(results)], ...by((t) => `set ${t.set}`), ...by((t) => `group ${t.group}`)], repeat)
}

export function writeReport(dir: string, results: TaskResult[], meta: { model: string; repeat: number; argv: string[] }): { summary: string } {
  mkdirSync(join(dir, 'transcripts'), { recursive: true })
  const summary = summarise(results, meta.repeat)
  const t0 = results[0]?.attempts[0]?.transcript
  const lines = [
    `# Eval report`,
    '',
    `Model: ${meta.model}${priced(meta.model) ? '' : ' (no price known: cost shows 0)'} · repeat ${meta.repeat} · ${new Date().toISOString()} · \`npm run eval -- ${meta.argv.join(' ')}\` · tools ${t0?.toolsHash ?? '-'}`,
    '',
    summary,
    '',
    'pass@1 and pass^k count only attempts whose every grader passed; an attempt with a judge skipped (no judge model) is "unjudged", never a pass.',
    '',
    '## Tasks',
    '',
  ]
  for (const t of results) {
    const v = t.attempts.some((a) => a.verdict === 'fail') ? 'FAIL' : t.attempts.some((a) => a.verdict === 'unjudged') ? 'UNJUDGED' : 'PASS'
    lines.push(`### ${v} ${t.id} · ${t.group} · ${t.set}`, '', `> ${t.ask}`, '')
    t.attempts.forEach((a, i) => {
      lines.push(`Attempt ${i + 1}: ${a.verdict} · ended ${a.end} · ${a.steps} steps · ${a.undoSteps} undo steps · ${a.usage.input + a.usage.output} tokens · $${a.cost.toFixed(4)} · ${a.ms.toFixed(0)} ms${a.error ? ` · ${a.error}` : ''}`)
      for (const g of a.grades) lines.push(`- ${g.pass === true ? '✓' : g.pass === 'skipped' ? '–' : '✗'} ${g.name}: ${g.why}`)
      if (a.changes.length) lines.push('', '<details><summary>changes</summary>', '', ...a.changes.map((c) => `    ${c}`), '', '</details>')
      lines.push('')
      writeFileSync(join(dir, 'transcripts', `${t.id}-${i + 1}.json`), JSON.stringify(a.transcript, null, 1))
    })
  }
  writeFileSync(join(dir, 'report.md'), lines.join('\n'))
  writeFileSync(
    join(dir, 'report.json'),
    JSON.stringify(
      {
        meta: { ...meta, at: new Date().toISOString(), toolsHash: t0?.toolsHash, system: t0?.system },
        rates: rates(results),
        tasks: results.map((t) => ({ id: t.id, group: t.group, set: t.set, ask: t.ask, attempts: t.attempts.map(({ transcript: _t, ...a }) => a) })),
      },
      null,
      1,
    ),
  )
  return { summary }
}
