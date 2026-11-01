// Run records (docs/specs/agent-pipeline.md §4): what a run was, so two runs can be told apart and compared later,
// here and in the backoffice. Each report.json gets a `manifest` (the code, prompt, tools and pipeline it ran with) and
// a `summary` (pass and cost overall, by group, by model and by role); every run adds one line to
// evals/results/index.jsonl (gitignored, like the results): the list a backoffice reads first.
import { execSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { costOf } from './prices'
import type { Pipeline } from '../src/agent/pipeline'
import type { TaskResult } from './run'

export type Manifest = {
  // The results folder's name: the run's id.
  run: string
  at: string
  git: { sha: string; dirty: boolean }
  command: string
  pipeline: Pipeline | null
  model: string
  judge: string | null
  // The system prompt's and the tools' hashes: a prompt change shows even when the code's sha didn't move.
  promptHash: string
  toolsHash: string
  tasks: number
  repeat: number
  pictures: boolean
}

type Tally = { attempts: number; passed: number; cost: number; input: number; cached: number; output: number }
export type RunSummary = {
  all: Tally
  groups: Record<string, Tally>
  // By the model that ran a turn and by its role (a pipeline's turns name both; a single model's: `chat`).
  models: Record<string, Tally>
  roles: Record<string, Tally>
}

const tally = (): Tally => ({ attempts: 0, passed: 0, cost: 0, input: 0, cached: 0, output: 0 })

export function gitState(cwd: string): { sha: string; dirty: boolean } {
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const dirty = execSync('git status --porcelain --untracked-files=no', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().length > 0
    return { sha, dirty }
  } catch {
    return { sha: 'unknown', dirty: true }
  }
}

export const hashOf = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 8)

export function summarise(results: TaskResult[], fallbackModel: string): RunSummary {
  const s: RunSummary = { all: tally(), groups: {}, models: {}, roles: {} }
  for (const r of results)
    for (const a of r.attempts) {
      const g = (s.groups[r.group] ??= tally())
      for (const t of [s.all, g]) {
        t.attempts++
        t.passed += a.pass ? 1 : 0
        t.cost += a.cost
        t.input += a.usage.input
        t.cached += a.usage.cached ?? 0
        t.output += a.usage.output
      }
      for (const turn of a.transcript.turns) {
        const model = turn.model ?? fallbackModel
        const cost = costOf(model, turn.usage)
        for (const t of [(s.models[model] ??= tally()), (s.roles[turn.role ?? 'chat'] ??= tally())]) {
          t.cost += cost
          t.input += turn.usage.input
          t.cached += turn.usage.cached ?? 0
          t.output += turn.usage.output
        }
      }
    }
  return s
}

// The manifest and summary into report.json, and one line into the results' index.
export function recordRun(dir: string, resultsRoot: string, manifest: Manifest, results: TaskResult[]): RunSummary {
  const summary = summarise(results, manifest.model)
  const file = join(dir, 'report.json')
  const report = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  writeFileSync(file, JSON.stringify({ manifest, summary, ...report }, null, 1))
  appendFileSync(join(resultsRoot, 'index.jsonl'), `${JSON.stringify({ manifest, summary: { all: summary.all, groups: summary.groups, models: summary.models, roles: summary.roles } })}\n`)
  return summary
}
