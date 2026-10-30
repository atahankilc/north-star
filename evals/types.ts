// An eval task and what a run of it leaves (S11, D-312; agent.md §8). Tasks are plain TypeScript objects in
// evals/tasks/*.ts; graders are small functions over the END STATE (graders.ts).
import type { Role } from '../src/data/model'
import type { WhereView } from '../src/agent/read/tools'
import type { Ids } from '../src/agent/read'
import type { AgentWs, Transcript } from '../src/agent/contract'
import type { Script } from '../src/agent/stubModel'
import type { FixtureName } from './fixtures'
import type { AppliedStep, UiMove } from './env'
import type { ChangeItem } from '../src/agent/changeset'
import type { ChatStore, ChatWho } from '../src/agent/chats'

// `{ newChat }` (S16): the person accepts what's pending, then starts a new chat in the same workspace (no history, new
// short ids; the agent notes carry what was learned).
export type FollowUp = string | { untick: string } | { newChat: true }

export type Group = 'find' | 'edit' | 'build' | 'context' | 'refuse' | 'injection' | 'memory' | 'skills'
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
  // What the preview showed at the end of each turn (S13), turn by turn; the end state is after the last accept.
  proposed?: ChangeItem[][]
  // Emulator mode: the real history's undo of the run's step, then the workspace read back (undoRestores uses it).
  undo?: () => Promise<AgentWs>
  // S16: the agent-notes block each turn's model was given ('' when none), turn by turn.
  notesSeen?: string[]
  // S16: the chats saved at the end (one per chat of the run), with the rules' who-may; who ran it.
  chats?: ChatStore
  who?: ChatWho
  chatIds?: string[]
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
  // S13: `{ untick }` is the person unticking an item in the preview (found by words in its line), not a turn.
  followUps?: FollowUp[]
  // The runner answers a plan with "go" by itself (once, after the follow-ups) when a turn ends with a plan and no
  // writes, so a model that plans a big job first isn't failed for it. false: refuse, ask, injection and viewer tasks,
  // where a plan must stay a plan.
  autoGo?: boolean
  // Where they are when they ask (left out: the canvas shown, nothing selected).
  view?: Partial<WhereView>
  // Their role (left out: editor).
  role?: Role
  // The fixture changed before the run (S16: a change log, members): a new snapshot, the fixture left as it was.
  setup?: (ws: AgentWs) => AgentWs
  graders: Grader[]
  // The stub model's scripted solution (tool calls, then the answer): used ONLY by the stub, to prove graders and the
  // runner. Short ids are as the fixture's map gives them (tests/unit/golden/medium.map.md).
  reference: Script
  // A script that does the wrong thing, for runner tests (left out: the reference with writes dropped, a vague answer).
  wrong?: Script
}
