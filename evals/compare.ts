// Two runs side by side (docs/specs/agent-pipeline.md §5): `npm run eval -- --compare <run A> <run B>`. Per group the
// pass rate and the cost per attempt, then every task whose passes changed. Runs from before records (no summary) are
// read from their tasks. A run made on other tasks than the other only compares the tasks both have.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { costOf } from './prices'
import type { Usage } from '../src/agent/contract'

type Attempt = { pass: boolean; cost: number; usage?: Usage }
type Report = { manifest?: { run?: string; model?: string; pipeline?: { name: string } | null; git?: { sha: string; dirty: boolean }; promptHash?: string }; meta?: { model?: string }; tasks: { id: string; group: string; attempts: Attempt[] }[] }

// A run read back; an attempt saved with cost 0 but tokens used (Claude's before models.ts priced its bare name) is
// priced again from its tokens and the run's model.
export function readRun(dir: string): { name: string; report: Report } {
  const d = resolve(dir)
  const report = JSON.parse(readFileSync(join(d, 'report.json'), 'utf8')) as Report
  const model = report.manifest?.model ?? report.meta?.model?.split(' ')[0] ?? ''
  for (const t of report.tasks) for (const a of t.attempts) if (!a.cost && a.usage && (a.usage.input || a.usage.output)) a.cost = costOf(model, a.usage)
  return { name: d.split('/').pop() ?? d, report }
}

const pct = (p: number, n: number) => (n ? `${Math.round((100 * p) / n)} %` : '-')
const money = (x: number) => `$${x.toFixed(3)}`

export function compareRuns(a: { name: string; report: Report }, b: { name: string; report: Report }): string[] {
  const both = new Set(a.report.tasks.map((t) => t.id).filter((id) => b.report.tasks.some((t) => t.id === id)))
  const pick = (r: Report) => r.tasks.filter((t) => both.has(t.id))
  const by = (r: Report) => {
    const g = new Map<string, { n: number; p: number; c: number }>()
    for (const t of pick(r)) {
      const x = g.get(t.group) ?? { n: 0, p: 0, c: 0 }
      for (const at of t.attempts) ((x.n += 1), (x.p += at.pass ? 1 : 0), (x.c += at.cost))
      g.set(t.group, x)
    }
    return g
  }
  const ga = by(a.report)
  const gb = by(b.report)
  const label = (x: { name: string; report: Report }) => {
    const m = x.report.manifest
    return `${x.name}${m ? ` (${m.pipeline?.name ?? 'single'} · ${m.model ?? '?'} · ${m.git?.sha ?? '?'}${m.git?.dirty ? '+' : ''} · prompt ${m.promptHash ?? '?'})` : ''}`
  }
  const lines = [`# Compare`, '', `A: ${label(a)}`, `B: ${label(b)}`, `Tasks in both: ${both.size}`, '', '| group | A pass | B pass | A $/attempt | B $/attempt |', '|---|---|---|---|---|']
  const total = (g: Map<string, { n: number; p: number; c: number }>) => [...g.values()].reduce((s, x) => ({ n: s.n + x.n, p: s.p + x.p, c: s.c + x.c }), { n: 0, p: 0, c: 0 })
  for (const [name, x] of [['all', total(ga)] as const, ...[...new Set([...ga.keys(), ...gb.keys()])].map((k) => [k, ga.get(k)] as const)]) {
    const y = name === 'all' ? total(gb) : gb.get(name)
    lines.push(`| ${name} | ${x ? `${x.p}/${x.n} ${pct(x.p, x.n)}` : '-'} | ${y ? `${y.p}/${y.n} ${pct(y.p, y.n)}` : '-'} | ${x ? money(x.c / Math.max(1, x.n)) : '-'} | ${y ? money(y.c / Math.max(1, y.n)) : '-'} |`)
  }
  const changed = [...both].flatMap((id) => {
    const ta = a.report.tasks.find((t) => t.id === id)!
    const tb = b.report.tasks.find((t) => t.id === id)!
    const pa = ta.attempts.filter((x) => x.pass).length
    const pb = tb.attempts.filter((x) => x.pass).length
    return pa / ta.attempts.length === pb / tb.attempts.length ? [] : [`| ${id} | ${pa}/${ta.attempts.length} | ${pb}/${tb.attempts.length} |`]
  })
  if (changed.length) lines.push('', '| task | A | B |', '|---|---|---|', ...changed)
  return lines
}
