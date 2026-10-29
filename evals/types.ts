// An eval task and what a run of it leaves (S11, D-312; agent.md §8). Tasks are plain TypeScript objects in
// evals/tasks/*.ts; graders are small functions over the END STATE (graders.ts).
import type { Role } from '../src/data/model'
import type { WhereView } from '../src/agent/read/tools'
import type { Ids } from '../src/agent/read'
import type { AgentWs, Transcript } from '../src/agent/contract'
import type { Script } from '../src/agent/stubModel'
import type { FixtureName } from './fixtures'
import type { AppliedStep, UiMove } from './env'

export type Group = 'find' | 'edit' | 'build' | 'context' | 'refuse' | 'injection'
// regression: must pass on every change (100 %); capability: what a phase gate measures.
export type EvalSet = 'regression' | 'capability'

// What a run leaves for the graders: the start and end snapshots, every apply (one undo step each, with its inverse),
// the UI moves, the transcript and the chat's short ids (to read the answer's citations).
export type RunResult = {
  start: AgentWs
  end: AgentWs
  steps: AppliedStep[]
  refused: number
  moves: UiMove[]
  transcript: Transcript
  answer: string
  ids: Ids
  view: WhereView
}

// `pass: 'skipped'`: a grader that couldn't run (the LLM judge with no model): counted apart, never a failure.
export type Grade = { pass: boolean | 'skipped'; why: string }

export type Grader = { name: string; grade: (r: RunResult) => Grade | Promise<Grade> }

export type Task = {
  id: string
  group: Group
  set: EvalSet
  fixture: FixtureName
  // What the person types.
  ask: string
  // What they type next, each a later turn of the same chat (e.g. ['go'] after the agent's plan for a big job); the
  // graders read the end state after the last one.
  followUps?: string[]
  // The runner answers a plan with "go" by itself (once, after the follow-ups) when a turn ends with a plan and no
  // writes, so a model that plans a big job first isn't failed for it. false: refuse, ask, injection and viewer tasks,
  // where a plan must stay a plan.
  autoGo?: boolean
  // Where they are when they ask (left out: the canvas shown, nothing selected).
  view?: Partial<WhereView>
  // Their role (left out: editor).
  role?: Role
  graders: Grader[]
  // The stub model's scripted solution (tool calls, then the answer): used ONLY by the stub, to prove graders and the
  // runner. Short ids are as the fixture's map gives them (tests/unit/golden/medium.map.md).
  reference: Script
  // A script that does the wrong thing, for runner tests (left out: the reference with writes dropped, a vague answer).
  wrong?: Script
}
