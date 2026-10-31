// A big job as state, not text (D-328, docs/specs/agent-bugs.md item 28): the plan's steps, each with its state, what
// the job has used, and the one rule that decides whether the app goes on by itself. Pure: no React, no Firebase, no
// module state (tests/unit/purity.test.ts' rule for src/agent).
//
// The model writes the plan with `plan` and moves its steps with `progress` (tools.ts). The person sees it as a live
// checklist and approves each step's changes in the preview as now (D-312); after an apply the app goes on with the
// next step by itself (agentStore.ts' `goOn`). What stops it: a step left without progress since the last go-on, the
// job's token budget (seen and raised by the person), `[stop]`, a discard, or a question from the model. No fixed
// number of steps: the job is as long as its plan.

export type JobStepState = 'todo' | 'doing' | 'done' | 'skipped'
export type JobStep = { n: number; title: string; scope?: string; check?: string; state: JobStepState; why?: string }
// planned: written, waiting for go; running: under way; paused: stopped by the person, the budget or no progress
// (`paused` says why); done: every step done or skipped.
export type JobStatus = 'planned' | 'running' | 'paused' | 'done'
export type Job = {
  title: string
  steps: JobStep[]
  status: JobStatus
  paused?: string
  // Tokens (in + out) the job's turns used, and the budget the app stops at (the person raises it).
  tokens: number
  budget: number
  // How many steps were settled (done or skipped) when the app last went on by itself: it goes on again only after more.
  settledAt: number
  // Set by the person: finish the step under way, then stop.
  stopAfter?: boolean
}

// Where a job lives for the tools: the chat's runtime in the app, a plain variable in the evals.
export type JobHost = { get: () => Job | null; set: (job: Job | null) => void }

export const JOB_BUDGET = 2_000_000
export const MAX_STEPS = 12
const TITLE = 120
const LINE = 300

const cut = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '')

export const settled = (j: Job) => j.steps.filter((s) => s.state === 'done' || s.state === 'skipped').length
export const nextStep = (j: Job) => j.steps.find((s) => s.state === 'doing') ?? j.steps.find((s) => s.state === 'todo')
export const finished = (j: Job) => j.steps.length > 0 && j.steps.every((s) => s.state === 'done' || s.state === 'skipped')

type Fail = { error: string }

// `plan`: a new plan, or the plan changed (a step already done keeps its state when its title stays).
export function planJob(args: Record<string, unknown>, prev: Job | null): Job | Fail {
  const title = cut(args.title, TITLE)
  const raw = Array.isArray(args.steps) ? args.steps : []
  if (!title) return { error: 'plan needs a title: what the job is, in a few words' }
  if (raw.length < 2) return { error: 'plan needs at least two steps; a job of one step needs no plan: just do it' }
  if (raw.length > MAX_STEPS) return { error: `plan takes at most ${MAX_STEPS} steps: join small ones (a step is a part you propose in one go)` }
  const was = new Map((prev?.steps ?? []).map((s) => [s.title.toLowerCase(), s]))
  const steps: JobStep[] = []
  for (const [i, x] of raw.entries()) {
    const o = (x && typeof x === 'object' ? x : { title: x }) as Record<string, unknown>
    const t = cut(o.title, TITLE)
    if (!t) return { error: `step ${i + 1} has no title` }
    const kept = was.get(t.toLowerCase())
    const scope = cut(o.scope, LINE)
    const check = cut(o.check, LINE)
    steps.push({ n: i + 1, title: t, ...(scope ? { scope } : {}), ...(check ? { check } : {}), state: kept && kept.state !== 'doing' ? kept.state : 'todo', ...(kept?.why ? { why: kept.why } : {}) })
  }
  const base = prev ?? { tokens: 0, budget: JOB_BUDGET, settledAt: 0 }
  // A changed plan goes on as it was (running stays running); a new one waits for go.
  const status: JobStatus = prev && (prev.status === 'running' || prev.status === 'paused') ? prev.status : 'planned'
  return { title, steps, status, tokens: base.tokens, budget: base.budget, settledAt: Math.min(base.settledAt, steps.length) }
}

// `progress`: one step moved. Starting a step starts the job; the last one settled ends it.
export function progressJob(j: Job | null, args: Record<string, unknown>): Job | Fail {
  if (!j) return { error: 'there is no plan in this chat: call plan first' }
  const n = Math.floor(Number(args.step))
  const state = args.state as JobStepState
  const step = j.steps.find((s) => s.n === n)
  if (!step) return { error: `there is no step ${args.step}; the steps are 1–${j.steps.length}` }
  if (!['doing', 'done', 'skipped'].includes(state)) return { error: 'state is doing, done or skipped' }
  const why = cut(args.why, LINE)
  if (state === 'skipped' && !why) return { error: 'skipping a step needs why: the reason the person reads' }
  const steps = j.steps.map((s) => (s.n === n ? { ...s, state, ...(why ? { why } : {}) } : state === 'doing' && s.state === 'doing' ? { ...s, state: 'todo' as const } : s))
  const next: Job = { ...j, steps }
  if (finished(next)) return { ...next, status: 'done', paused: undefined }
  if (state === 'doing' && (j.status === 'planned' || j.status === 'paused')) return { ...next, status: 'running', paused: undefined }
  return next
}

const MARK: Record<JobStepState, string> = { todo: '[ ]', doing: '[>]', done: '[x]', skipped: '[-]' }

// The job as the model reads it each turn (with where the person is): the steps, their state, what's next.
export function jobText(j: Job): string {
  const head = `## The job: ${j.title} (${j.status}${j.paused ? `: ${j.paused}` : ''}; ${settled(j)}/${j.steps.length} settled)`
  const lines = j.steps.map((s) => `${MARK[s.state]} ${s.n}. ${s.title}${s.scope ? ` (scope: ${s.scope})` : ''}${s.check ? ` (check: ${s.check})` : ''}${s.why ? ` (why: ${s.why})` : ''}`)
  const nx = nextStep(j)
  const tail = j.status === 'planned' ? 'Waiting for the person to say go.' : j.status === 'done' ? 'Every step is settled: say what was done and what was left out.' : nx ? `Next: step ${nx.n}.` : ''
  return [head, ...lines, ...(tail ? [tail] : [])].join('\n')
}

// What a finished turn means for the job: go on (the next step's message), stop with why (the job pauses), or
// nothing (no job running). `applied`: the turn's changes were just applied; `asked`: the model's answer waits for
// the person (a question or a plan); `stopped`: the person stopped the turn.
export type Move = { go: string } | { pause: string } | null

export function nextMove(j: Job | null, o: { applied?: number; asked?: boolean; stopped?: boolean; discarded?: boolean }): Move {
  if (!j || j.status !== 'running') return null
  if (o.stopped) return { pause: 'stopped by the person' }
  if (o.discarded) return { pause: 'the step\'s changes were discarded' }
  if (o.asked) return { pause: 'waiting for the person\'s answer' }
  if (j.stopAfter) return { pause: 'stopped after the step, as asked' }
  if (j.tokens >= j.budget) return { pause: `the budget (${Math.round(j.budget / 1000)}k tokens) is used up` }
  if (settled(j) <= j.settledAt) return { pause: 'no step was finished since the last go-on' }
  const nx = nextStep(j)
  if (!nx) return null
  const done = o.applied !== undefined ? `The changes were applied (${o.applied}). ` : ''
  return { go: `${done}Go on with step ${nx.n} of ${j.steps.length}: ${nx.title}.` }
}
