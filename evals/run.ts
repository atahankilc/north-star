// The eval runner (S11, D-312; agent.md §6 Phase 3, §8). For each task: load its fixture into an in-memory store, set
// up the short ids and where the person is, run the agent's real loop (src/agent/loop.ts) with the model, collect the
// transcript, grade the END STATE, repeat for pass^k. Writes are real ops: the registry's builders, validate and
// project, the same code the browser's apply runs before it writes (evals/env.ts).
//
//   npm run eval                      every task, the stub model playing each task's reference
//   npm run eval:quick                the regression set
//   npm run eval -- --repeat 3        pass^3 (every attempt must pass)
//   npm run eval -- --task find-01,edit-02 --group build --set capability
//   npm run eval -- --wrong           the stub plays wrong scripts (every task should fail: proves the graders bite)
//   npm run eval -- --model openai:gpt-5.6-terra   a real model; the key ONLY from the env var OPENAI_API_KEY, read at
//                                     run time and never written anywhere (transcripts and the report hold no key)
//   npm run eval -- --write-fixtures  writes evals/fixtures/<name>.workspace.json (export v2)
//   npm run eval -- --emulator        accepts through the real apply into the running Firestore emulator, end state and
//                                     undo read back from it (evals/emulator.ts; README "Emulator mode")
//
// The report goes to evals/results/<timestamp>/ (report.md, report.json, transcripts/).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { answerOf, stepsOf, toolsHash, transcriptUsage, type AgentModel, type AgentTurn, type Transcript, type Usage } from '../src/agent/contract'
import { stubModel, wrongScript } from '../src/agent/stubModel'
import { FIXTURES, loadFixture, toBundle } from './fixtures'
import { makeEnv } from './env'
import { runTurn } from '../src/agent/loop'
import { systemPrompt } from '../src/agent/prompt'
import { openaiModel } from '../src/agent/openai'
import { effortFor } from '../src/agent/models'
import { EVAL_TOOLS, WRITE_TOOLS } from './tools'
import { diffLines, gradeAll, setJudge } from './graders'
import { costOf } from './prices'
import { TASKS } from './tasks'
import { writeReport } from './report'
import type { FollowUp, Grade, RunResult, Task } from './types'
import type { Judge } from './graders'
import type { Writer } from './env'
import type { AgentWs, ModelRequest } from '../src/agent/contract'
import type { Role } from '../src/data/model'
import { makeIds } from '../src/agent/read'
import { NOTES_HEAD } from '../src/agent/loop'
import { chatDocs, turnsOfTranscript } from '../src/agent/chats'

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
  backend?: Backend
}

export const referenceModel = (task: Task): AgentModel => stubModel(task.reference, { name: 'stub' })
export const wrongModel = (task: Task): AgentModel => stubModel(task.wrong ?? wrongScript(task.reference), { name: 'stub (wrong)' })

export const verdictOf = (grades: Grade[]): Verdict => (grades.some((g) => g.pass === false) ? 'fail' : grades.some((g) => g.pass === 'skipped') ? 'unjudged' : 'pass')

// A turn that ended with a plan waiting for the person: no write asked for, and an answer that asks to go ahead or
// lays out a numbered plan.
export function looksLikePlan(turn: AgentTurn): boolean {
  if (WRITE_CALLS.test(turn.steps.flatMap((s) => s.toolCalls.map((c) => c.name)).join(' '))) return false
  const a = turn.answer
  return /\bsay go\b|\bshall I (go|start|proceed)\b|\bwant me to (go|start|proceed)\b/i.test(a) || (/\bplan\b/i.test(a) && /^\s*1[.)]/m.test(a))
}
const WRITE_CALLS = new RegExp(`\\b(${[...WRITE_TOOLS].join('|')})\\b`)

// One attempt: a fresh env on the fixture, one turn, the graders over what it left. Anything that throws (the model,
// the loop, a fixture) fails this attempt with its message, never the run.
// The emulator mode's backend (evals/emulator.ts' emulate), handed in by evals/cli.mjs: run.ts never loads Firebase.
export type Backend = (start: AgentWs, o: { role: Role; tag?: string }) => Promise<{ start: AgentWs; write: Writer; undo: () => Promise<AgentWs>; close: () => void }>

export async function attempt(task: Task, model: AgentModel, o: { backend?: Backend } = {}): Promise<{ result?: RunResult; attempt: Attempt }> {
  const t0 = performance.now()
  const defs = EVAL_TOOLS.map((t) => t.def)
  let close = () => {}
  try {
    const fixture = task.setup ? task.setup(loadFixture(task.fixture)) : loadFixture(task.fixture)
    const em = o.backend ? await o.backend(fixture, { role: task.role ?? 'editor', tag: task.id }) : null
    if (em) close = em.close
    const start = em ? em.start : fixture
    const env = makeEnv(start, { role: task.role ?? 'editor', view: task.view, ...(em ? { writer: em.write } : {}) })
    const startedAt = env.now()
    const transcript: Transcript = { model: model.name, startedAt, turns: [] }
    // The ask, then each follow-up as a later turn of the same chat (e.g. a plan, then "go"); graded on the end state
    // after the last turn.
    let history: Awaited<ReturnType<typeof runTurn>>['history'] = []
    const turns: AgentTurn[] = []
    const asks: FollowUp[] = [task.ask, ...(task.followUps ?? [])]
    const nTurns = () => asks.filter((a) => typeof a === 'string').length
    // S16: what each turn's model was given as the agent notes, and where each chat of the run starts (its turns).
    const notesSeen: string[] = []
    let seenThisTurn: string | null = null
    const watched: AgentModel = {
      name: model.name,
      respond: (req: ModelRequest) => {
        seenThisTurn ??= req.messages.find((m) => m.role === 'system' && m.content.startsWith(NOTES_HEAD))?.content ?? ''
        return model.respond(req)
      },
      ...(model.stream ? { stream: (req: ModelRequest) => ((seenThisTurn ??= req.messages.find((m) => m.role === 'system' && m.content.startsWith(NOTES_HEAD))?.content ?? ''), model.stream!(req)) } : {}),
    }
    const who = { uid: env.actor.uid, member: true }
    const chatIds: string[] = []
    let chatFrom = 0
    const saveChat = () => {
      const part: Transcript = { ...transcript, turns: transcript.turns.slice(chatFrom) }
      if (!part.turns.length) return
      const id = `chat${chatIds.length + 1}`
      const { summary, body } = chatDocs({ uid: who.uid, model: model.name, turns: turnsOfTranscript(part), ids: env.ids.toJSON(), now: env.now() })
      const r = env.chats.save(who, { id, summary, body })
      if (r.ok) chatIds.push(id)
      chatFrom = transcript.turns.length
    }
    let autoGone = false
    let acceptError: string | undefined
    const untickMissed: string[] = []
    for (let i = 0; i < asks.length; i++) {
      const ask = asks[i]
      // A person's action in the preview (S13): untick an item, found by words in its line.
      if (typeof ask !== 'string' && 'newChat' in ask) {
        // The person accepts the preview, the chat is saved, and a new one starts: no history, new short ids.
        if (env.changes?.items.length) {
          const a = await env.accept()
          if (!a.ok) acceptError = a.said
        }
        saveChat()
        history = []
        env.ids = makeIds()
        continue
      }
      if (typeof ask !== 'string') {
        const item = env.changes?.items.find((x) => x.line.toLowerCase().includes(ask.untick.toLowerCase()))
        if (item) env.untick(item.id)
        // An untick that finds nothing is a broken run (or a wrong one), never silently skipped.
        else untickMissed.push(ask.untick)
        continue
      }
      seenThisTurn = null
      const r = await runTurn(watched, env, EVAL_TOOLS, history, ask, { transcript, turnId: `${turns.length + 1}` })
      notesSeen.push(seenThisTurn ?? '')
      history = r.history
      turns.push(r.turn)
      // What the preview showed at this turn's end (agent.md §4.5).
      env.proposed.push([...(env.changes?.items ?? [])])
      if (r.turn.end !== 'answered') break
      // The last turn planned and wrote nothing: say go, once (unless the task keeps plans as plans).
      if (i === asks.length - 1 && !autoGone && task.autoGo !== false && looksLikePlan(r.turn) && !env.changes?.items.length) {
        autoGone = true
        asks.push('go')
      }
    }
    // The person accepts what's pending after the last turn (agent.md §4.5: one undo step); a turn that left changes
    // pending before a later turn kept them in the preview (the next message is a note on it, §4.10).
    if (env.changes?.items.length) {
      const a = await env.accept()
      if (!a.ok) acceptError = a.said
    }
    saveChat()
    const turn = turns[turns.length - 1]
    const result: RunResult = { start, end: env.getWs(), steps: env.steps, refused: env.refused, moves: env.moves, transcript, answer: answerOf(transcript), ids: env.ids, view: env.ui.currentView(), proposed: env.proposed, notesSeen, chats: env.chats, who, chatIds, ...(em ? { undo: em.undo } : {}) }
    const grades = await gradeAll(task.graders, result)
    // A turn that didn't end in an answer fails, whatever the graders say (a refusal or a cut-off is not a reply).
    if (turn.end !== 'answered') grades.push({ name: 'turn answered', pass: false, why: `turn ${turns.length} ended: ${turn.end}${turn.error ? ` (${turn.error})` : ''}` })
    else if (turns.length < nTurns()) grades.push({ name: 'every turn ran', pass: false, why: `${turns.length} of ${nTurns()} turns` })
    if (untickMissed.length) grades.push({ name: 'untick found its item', pass: false, why: `no pending item matched ${untickMissed.map((u) => `"${u}"`).join(', ')}` })
    if (acceptError) grades.push({ name: 'accepted', pass: false, why: `the preview's accept was refused: ${acceptError}` })
    // Emulator: what Firestore holds after the apply equals what the preview drew (project), field by field.
    if (em && env.steps.length) {
      const drift = env.steps.flatMap((x) => x.drift ?? [])
      grades.push({ name: 'applied = previewed', pass: drift.length === 0, why: drift.length ? `${drift.length} differ: ${drift.slice(0, 4).join('; ')}` : 'Firestore holds exactly what the preview drew' })
    }
    close()
    const usage = transcriptUsage(transcript)
    const verdict = verdictOf(grades)
    return {
      result,
      attempt: { verdict, pass: verdict === 'pass', grades, steps: stepsOf(transcript), undoSteps: env.steps.length, usage, cost: costOf(model.name, usage), ms: performance.now() - t0, end: turn.end, changes: diffLines(start, result.end), ...(turn.error ? { error: turn.error } : {}), transcript },
    }
  } catch (e) {
    close()
    const error = `the attempt failed: ${(e as Error).message}`
    return {
      attempt: { verdict: 'fail', pass: false, grades: [{ name: 'attempt ran', pass: false, why: error }], steps: 0, undoSteps: 0, usage: { input: 0, output: 0 }, cost: 0, ms: performance.now() - t0, end: 'error', changes: [], error, transcript: { model: model.name, startedAt: 0, turns: [], system: systemPrompt(), toolsHash: toolsHash(defs) } },
    }
  }
}

export async function runTask(task: Task, o: RunOpts = {}): Promise<TaskResult> {
  const attempts: Attempt[] = []
  for (let i = 0; i < Math.max(1, o.repeat ?? 1); i++) attempts.push((await attempt(task, (o.model ?? referenceModel)(task, i), { ...(o.backend ? { backend: o.backend } : {}) })).attempt)
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

// `--model openai:<name>`: the OpenAI adapter on the person's model. The key comes ONLY from `env.OPENAI_API_KEY` at run
// time; it lives in the adapter's closure and is never written (the report and transcripts carry the model's name).
// The judge uses the same model. Anything else (or no key) stops with a clear message.
export function realModel(spec: string, env: Record<string, string | undefined>): { name: string; make: () => AgentModel; judge: Judge } {
  const m = /^openai:([A-Za-z0-9._-]+)$/.exec(spec)
  if (!m) throw new Error(`--model ${spec}: use stub (the default) or openai:<model>, e.g. openai:gpt-5.6-terra`)
  const key = env.OPENAI_API_KEY
  if (!key) throw new Error(`--model ${spec} needs an OpenAI key in the environment variable OPENAI_API_KEY (read at run time, never written anywhere): OPENAI_API_KEY=… npm run eval -- --model ${spec}`)
  const name = m[1]
  const make = () => openaiModel({ key, model: name, reasoning: effortFor(name) })
  const judge: Judge = async ({ rubric, ask, answer, context }) => {
    const r = await make().respond({
      messages: [
        { role: 'system', content: 'You grade an assistant\'s answer against a rubric. Reply with PASS or FAIL on the first line, then one short line why.' },
        { role: 'user', content: `Rubric: ${rubric}\n\nThe person asked: ${ask}\n\nWhat changed in the workspace:\n${context || '(nothing)'}\n\nThe answer:\n${answer}` },
      ],
      tools: [],
    })
    const first = r.text.trim().split('\n')[0] ?? ''
    return { pass: /^PASS\b/i.test(first), why: r.text.trim().split('\n').slice(1).join(' ').slice(0, 300) || first }
  }
  return { name, make, judge }
}

// npm runs scripts from the repo's root.
const ROOT = process.cwd()

export function selectTasks(a: Pick<Args, 'set' | 'group' | 'task'>, all: Task[] = TASKS): Task[] {
  return all.filter((t) => (!a.set || t.set === a.set) && (!a.group || t.group === a.group) && (!a.task || a.task.includes(t.id)))
}

export async function main(argv: string[], o: { backend?: Backend } = {}): Promise<number> {
  const a = parseArgs(argv)
  if (a.writeFixtures) {
    for (const f of FIXTURES) {
      const p = join(ROOT, 'evals/fixtures', `${f}.workspace.json`)
      writeFileSync(p, JSON.stringify(toBundle(loadFixture(f)), null, 1))
      console.log(`wrote ${p}`)
    }
    return 0
  }
  if (a.emulator && !o.backend) throw new Error('--emulator runs through evals/cli.mjs (it loads evals/emulator.ts with VITE_USE_EMULATORS=true); start the emulators first: npm run emulators')
  const real = a.model === 'stub' ? null : realModel(a.model, process.env)
  const tasks = selectTasks(a)
  if (!tasks.length) throw new Error('no task matches')
  if (real) setJudge(real.judge)
  const results = await runTasks(tasks, { repeat: a.repeat, model: real ? () => real.make() : a.wrong ? wrongModel : referenceModel, ...(a.emulator && o.backend ? { backend: o.backend } : {}) })
  if (real) setJudge(null)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = a.out ? resolve(a.out) : join(ROOT, 'evals/results', stamp)
  mkdirSync(dir, { recursive: true })
  const { summary } = writeReport(dir, results, { model: `${real ? real.name : a.wrong ? 'stub (wrong)' : 'stub'}${a.emulator ? ' · emulator' : ''}`, repeat: a.repeat, argv })
  console.log(summary)
  console.log(`\nreport: ${join(dir, 'report.md')}`)
  const failed = results.filter((r) => r.attempts.some((x) => x.verdict === 'fail')).length
  return a.wrong ? 0 : failed ? 1 : 0
}
