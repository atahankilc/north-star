// The eval runner (S11, D-312; agent.md §6 Phase 3, §8). For each task: load its fixture into an in-memory store, set
// up the short ids and where the person is, run the loop (evals/loop.ts until S12's exists) with the model, collect the
// transcript, grade the END STATE, repeat for pass^k. Writes are real ops: the registry's builders, validate and
// project, the same code the browser's apply runs before it writes (evals/env.ts).
//
//   npm run eval                      every task, the stub model playing each task's reference
//   npm run eval:quick                the regression set
//   npm run eval -- --repeat 3        pass^3 (every attempt must pass)
//   npm run eval -- --task find-01,edit-02 --group build --set capability
//   npm run eval -- --wrong           the stub plays wrong scripts (every task should fail: proves the graders bite)
//   npm run eval -- --write-fixtures  writes evals/fixtures/<name>.workspace.json (export v2)
//   npm run eval -- --emulator        not built yet (see evals/README.md)
//
// The report goes to evals/results/<timestamp>/ (report.md, report.json, transcripts/).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { answerOf, stepsOf, toolsHash, transcriptUsage, type AgentModel, type AgentTurn, type Transcript, type Usage } from '../src/agent/contract'
import { stubModel, wrongScript } from '../src/agent/stubModel'
import { FIXTURES, loadFixture, toBundle } from './fixtures'
import { makeEnv } from './env'
import { runTurn, SYSTEM } from './loop'
import { EVAL_TOOLS } from './tools'
import { diffLines, gradeAll } from './graders'
import { costOf } from './prices'
import { TASKS } from './tasks'
import { writeReport } from './report'
import type { Grade, RunResult, Task } from './types'

// An attempt's verdict: `pass` (every grader passed), `fail` (one failed, or the attempt itself failed), `unjudged` (none
// failed but an LLM judge was skipped: never counted as a pass in the rates).
export type Verdict = 'pass' | 'fail' | 'unjudged'
export type Attempt = {
  verdict: Verdict
  pass: boolean
  grades: (Grade & { name: string })[]
  steps: number
  undoSteps: number
  usage: Usage
  cost: number
  ms: number
  end: AgentTurn['end']
  changes: string[]
  error?: string
  transcript: Transcript
}
export type TaskResult = { id: string; group: Task['group']; set: Task['set']; ask: string; attempts: Attempt[] }

export type RunOpts = {
  repeat?: number
  // The model for a task's attempt (default: the stub playing its reference).
  model?: (task: Task, attempt: number) => AgentModel
}

export const referenceModel = (task: Task): AgentModel => stubModel(task.reference, { name: 'stub' })
export const wrongModel = (task: Task): AgentModel => stubModel(task.wrong ?? wrongScript(task.reference), { name: 'stub (wrong)' })

export const verdictOf = (grades: Grade[]): Verdict => (grades.some((g) => g.pass === false) ? 'fail' : grades.some((g) => g.pass === 'skipped') ? 'unjudged' : 'pass')

// One attempt: a fresh env on the fixture, one turn, the graders over what it left. Anything that throws (the model,
// the loop, a fixture) fails this attempt with its message, never the run.
export async function attempt(task: Task, model: AgentModel): Promise<{ result?: RunResult; attempt: Attempt }> {
  const t0 = performance.now()
  const defs = EVAL_TOOLS.map((t) => t.def)
  try {
    const start = loadFixture(task.fixture)
    const env = makeEnv(start, { role: task.role ?? 'editor', view: task.view })
    const startedAt = env.now()
    const turn = await runTurn(env, model, EVAL_TOOLS, task.ask)
    const transcript: Transcript = { model: model.name, startedAt, turns: [turn], system: SYSTEM, toolsHash: toolsHash(defs) }
    const result: RunResult = { start, end: env.getWs(), steps: env.steps, refused: env.refused, moves: env.moves, transcript, answer: answerOf(transcript), ids: env.ids, view: env.ui.currentView() }
    const grades = await gradeAll(task.graders, result)
    // A turn that didn't end in an answer fails, whatever the graders say (a refusal or a cut-off is not a reply).
    if (turn.end !== 'answered') grades.push({ name: 'turn answered', pass: false, why: `the turn ended: ${turn.end}${turn.error ? ` (${turn.error})` : ''}` })
    const usage = transcriptUsage(transcript)
    const verdict = verdictOf(grades)
    return {
      result,
      attempt: { verdict, pass: verdict === 'pass', grades, steps: stepsOf(transcript), undoSteps: env.steps.length, usage, cost: costOf(model.name, usage), ms: performance.now() - t0, end: turn.end, changes: diffLines(start, result.end), ...(turn.error ? { error: turn.error } : {}), transcript },
    }
  } catch (e) {
    const error = `the attempt failed: ${(e as Error).message}`
    return {
      attempt: { verdict: 'fail', pass: false, grades: [{ name: 'attempt ran', pass: false, why: error }], steps: 0, undoSteps: 0, usage: { input: 0, output: 0 }, cost: 0, ms: performance.now() - t0, end: 'error', changes: [], error, transcript: { model: model.name, startedAt: 0, turns: [], system: SYSTEM, toolsHash: toolsHash(defs) } },
    }
  }
}

export async function runTask(task: Task, o: RunOpts = {}): Promise<TaskResult> {
  const attempts: Attempt[] = []
  for (let i = 0; i < Math.max(1, o.repeat ?? 1); i++) attempts.push((await attempt(task, (o.model ?? referenceModel)(task, i))).attempt)
  return { id: task.id, group: task.group, set: task.set, ask: task.ask, attempts }
}

export async function runTasks(tasks: Task[], o: RunOpts = {}): Promise<TaskResult[]> {
  const out: TaskResult[] = []
  for (const t of tasks) out.push(await runTask(t, o))
  return out
}

// ---- The command line

type Args = { set?: string; group?: string; task?: string[]; repeat: number; wrong: boolean; emulator: boolean; writeFixtures: boolean; out?: string; model: string }

export function parseArgs(argv: string[]): Args {
  const a: Args = { repeat: 1, wrong: false, emulator: false, writeFixtures: false, model: 'stub' }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    const v = () => argv[++i]
    if (k === '--set') a.set = v()
    else if (k === '--group') a.group = v()
    else if (k === '--task') a.task = v().split(',')
    else if (k === '--repeat') a.repeat = Math.max(1, Number(v()) || 1)
    else if (k === '--wrong') a.wrong = true
    else if (k === '--emulator') a.emulator = true
    else if (k === '--write-fixtures') a.writeFixtures = true
    else if (k === '--out') a.out = v()
    else if (k === '--model') a.model = v()
    else throw new Error(`unknown option ${k}`)
  }
  return a
}

// npm runs scripts from the repo's root.
const ROOT = process.cwd()

export function selectTasks(a: Pick<Args, 'set' | 'group' | 'task'>, all: Task[] = TASKS): Task[] {
  return all.filter((t) => (!a.set || t.set === a.set) && (!a.group || t.group === a.group) && (!a.task || a.task.includes(t.id)))
}

export async function main(argv: string[]): Promise<number> {
  const a = parseArgs(argv)
  if (a.writeFixtures) {
    for (const f of FIXTURES) {
      const p = join(ROOT, 'evals/fixtures', `${f}.workspace.json`)
      writeFileSync(p, JSON.stringify(toBundle(loadFixture(f)), null, 1))
      console.log(`wrote ${p}`)
    }
    return 0
  }
  if (a.emulator)
    throw new Error(
      '--emulator is not built yet: the real apply (src/ops/firestore.ts) runs inside the browser app (history.ts, the toasts, the signed-in Firebase app from src/data/firebase.ts, which reads Vite env). See evals/README.md, "Emulator mode". The in-memory mode runs the same ops code.',
    )
  if (a.model !== 'stub') throw new Error(`--model ${a.model}: only the stub model exists until S12 brings the adapters`)
  const tasks = selectTasks(a)
  if (!tasks.length) throw new Error('no task matches')
  const results = await runTasks(tasks, { repeat: a.repeat, model: a.wrong ? wrongModel : referenceModel })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = a.out ? resolve(a.out) : join(ROOT, 'evals/results', stamp)
  mkdirSync(dir, { recursive: true })
  const { summary } = writeReport(dir, results, { model: a.wrong ? 'stub (wrong)' : 'stub', repeat: a.repeat, argv })
  console.log(summary)
  console.log(`\nreport: ${join(dir, 'report.md')}`)
  const failed = results.filter((r) => r.attempts.some((x) => x.verdict === 'fail')).length
  return a.wrong ? 0 : failed ? 1 : 0
}
