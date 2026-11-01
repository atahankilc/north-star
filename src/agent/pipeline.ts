// The agent pipeline (docs/specs/agent-pipeline.md): which model does which part of the work. A turn has a role, read
// from what is known before it runs (never from the person's words in one language, D-333); a pipeline names a model
// for each role. The same pipeline runs in the app and in the evals, so what is measured is what ships.
//
// Roles today: `chat` (any turn that is not part of a big job), `planner` (the turn that starts a plan skill: it
// writes the plan), `executor` (a big job's steps, once a plan is under way). `reviewer` is named for the later stage
// (one look at a finished job's result) and has no turn of its own yet. Pure: no React, no Firebase.
import type { Job } from './job'
import { parseSkill } from './skills'
import type { Effort } from './openai'

export type Role = 'chat' | 'planner' | 'executor' | 'reviewer'
export const ROLES: Role[] = ['chat', 'planner', 'executor', 'reviewer']

// What is known before a turn runs: the message (a `/skill` is a fact, not a reading of words), the chat's job.
export type TurnSignals = { message: string; job: Job | null }

// The role of a turn: a job planned or running → its steps (executor); a message starting a plan skill → planner;
// anything else → chat. A big job asked in plain words starts as chat; once the model calls `plan`, its next turns are
// the executor's.
export function roleOf(s: TurnSignals): Role {
  if (s.job && (s.job.status === 'planned' || s.job.status === 'running' || s.job.status === 'paused')) return 'executor'
  const skill = parseSkill(s.message)
  if (skill && 'skill' in skill && skill.skill.plan) return 'planner'
  return 'chat'
}

// A model for each role (`provider:model` as models.ts reads them; `chat` is required, the others fall back to it) and
// an optional reasoning effort per role. One provider per pipeline: a chat's history carries one provider's items.
export type Pipeline = { name: string; models: { chat: string } & Partial<Record<Exclude<Role, 'chat'>, string>>; effort?: Partial<Record<Role, Effort>> }

export const modelFor = (p: Pipeline, role: Role): string => p.models[role] ?? p.models.chat
export const effortFor = (p: Pipeline, role: Role): Effort | undefined => p.effort?.[role] ?? p.effort?.chat

const providerOfId = (id: string) => (id.startsWith('anthropic:') ? 'anthropic' : 'openai')

// What's wrong with a pipeline: a role on another provider than chat's.
export function pipelineProblems(p: Pipeline): string[] {
  const home = providerOfId(p.models.chat)
  return ROLES.flatMap((r) => (p.models[r] && providerOfId(p.models[r]!) !== home ? [`${r} is on ${providerOfId(p.models[r]!)}, chat on ${home}: one provider per pipeline`] : []))
}

// One model for everything: what the app does today.
export const single = (model: string): Pipeline => ({ name: 'single', models: { chat: model } })

// The cheap model for chat, a stronger one for big jobs (planning and steps): the first routing to measure.
export const routed = (cheap: string, strong: string): Pipeline => ({ name: 'routed', models: { chat: cheap, planner: strong, executor: strong } })

// The strong model plans, the cheap one runs the steps: the planner/executor split to measure.
export const planThenCheap = (cheap: string, strong: string): Pipeline => ({ name: 'plan-strong', models: { chat: cheap, planner: strong, executor: cheap } })
