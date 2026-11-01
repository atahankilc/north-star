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
// How the person reviews the job (D-328, the user 2026-11-01: chosen at go): `all`, one preview when every step is
// done (the steps pile up in it); `each`, one preview per step, the next starting after an apply. `suggest` is the
// model's pick when it plans; the person's choice at go is `preview` (a message instead of a button takes `suggest`).
export type JobPreview = 'all' | 'each'
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
  suggest?: JobPreview
  preview?: JobPreview
}

export const PREVIEWS: JobPreview[] = ['all', 'each']
// The preview a job runs with: the person's choice, else the model's, else one per step.
export const previewOf = (j: Job): JobPreview => j.preview ?? j.suggest ?? 'each'
// The person's choice at go (a button), or the model's when they just wrote.
export const chooseAt = (j: Job, preview?: JobPreview): Job => ({ ...j, preview: preview ?? j.preview ?? j.suggest ?? 'each' })

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
  if (args.preview !== undefined && !PREVIEWS.includes(args.preview as JobPreview)) return { error: 'preview is all (one preview when every step is done) or each (one per step)' }
  const suggest = (args.preview as JobPreview | undefined) ?? prev?.suggest
  // A choice the person made stays with a changed plan.
  return { title, steps, status, tokens: base.tokens, budget: base.budget, settledAt: Math.min(base.settledAt, steps.length), ...(suggest ? { suggest } : {}), ...(prev?.preview ? { preview: prev.preview } : {}) }
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
  const tail = j.status === 'planned' && !j.preview ? `Waiting for the person to say go and to pick the preview (you suggested ${j.suggest === 'all' ? 'one at the end' : j.suggest === 'each' ? 'one per step' : 'nothing'}).` : j.status === 'planned' ? 'The person picked the preview: on go, start with step 1.' : j.status === 'done' ? 'Every step is settled: say what was done and what was left out.' : nx ? `Next: step ${nx.n}.` : ''
  // The preview line once it's known: picked by the person, or the job under way.
  const how = j.status !== 'done' && (j.preview || j.status === 'running') ? [PREVIEW_NOTE[previewOf(j)]] : []
  return [head, ...lines, ...(tail ? [tail] : []), ...how].join('\n')
}

// How to run the steps, by the preview the person picked.
export const PREVIEW_NOTE: Record<JobPreview, string> = {
  all: 'Preview: one at the end, as the person chose. Do the steps one after another in this turn, each with progress doing, its change, progress done; the changes pile up in one preview. End your turn only when every step is settled.',
  each: 'Preview: one per step, as the person chose. After a step\'s change and progress done, end your turn: the person reviews that step, and once they accept it the app tells you to go on.',
}

// What a finished turn means for the job: go on (the next step's message), stop with why (the job pauses), or
// nothing (no job running). `applied`: the turn's changes were just applied; `waits`: the turn ended with nothing
// proposed, so the agent waits for the person (an answer, a question; never told from its words, agent-bugs 17);
// `stopped`: the person stopped the turn.
export type Move = { go: string } | { pause: string } | null

// `pending`: the turn ended with its changes still in the preview; with one preview for the job (`all`) and steps
// left, the app goes on without an apply, the preview growing.
export function nextMove(j: Job | null, o: { applied?: number; waits?: boolean; stopped?: boolean; discarded?: boolean; pending?: boolean }): Move {
  if (!j || j.status !== 'running') return null
  if (o.stopped) return { pause: 'stopped by the person' }
  // One preview per step: a waiting preview is the person's to apply first.
  if (o.pending && previewOf(j) === 'each') return null
  if (o.discarded) return { pause: 'the step\'s changes were discarded' }
  if (o.waits) return { pause: 'waiting for the person\'s answer' }
  if (j.stopAfter) return { pause: 'stopped after the step, as asked' }
  if (j.tokens >= j.budget) return { pause: `the budget (${Math.round(j.budget / 1000)}k tokens) is used up` }
  if (settled(j) <= j.settledAt) return { pause: 'no step was finished since the last go-on' }
  const nx = nextStep(j)
  if (!nx) return null
  if (o.pending) return { go: `The preview holds the steps so far and waits until every step is done. Go on with step ${nx.n} of ${j.steps.length}: ${nx.title}.` }
  const done = o.applied !== undefined ? `The changes were applied (${o.applied}). ` : ''
  return { go: `${done}Go on with step ${nx.n} of ${j.steps.length}: ${nx.title}.` }
}
