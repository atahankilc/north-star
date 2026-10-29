// The agent's contract (S11, D-312; docs/specs/agent.md §4.1–§4.4, §6 Phase 3–5, §7.2): the types the loop (S12), the
// model adapters (S12: OpenAI; the stub, stubModel.ts), the write tool (S13) and the eval runner (evals/) share. Pure
// types and a few small helpers: no React, no Firebase, no module state (tests/unit/purity.test.ts's rule for src/agent).
//
// The shape of one turn: the loop sends the model `messages` + `tools`; the model answers with text and/or tool calls;
// the loop runs each call against an `AgentEnv` (reads over `getWs()`, writes through `apply` as `actor: 'agent'`, UI
// moves through `ui`), sends the results back, and repeats until the model answers without a call, the step budget runs
// out, or the person stops it. Everything that happened is a `Transcript`: steps with their calls, results, timings and
// tokens, kept for the evals and (later) the usage log, which keeps counts and never text (§7.2 point 5).
import type { Plan, OpActor, OpError } from '../ops/types'
import type { WorkspaceCtx } from '../state/wsStore'
import type { Ids, ReadWs } from './read'
import type { WhereView } from './read/tools'
import type { AgentSettings, Changeset } from './changeset'

// ---- What the model sees and says

// A tool as the model is told about it: a name (snake_case), what it does, its arguments as a JSON Schema object.
// `strict`: the provider holds the model to the schema (OpenAI's strict mode needs `additionalProperties: false`).
export type ToolDef = { name: string; description: string; strict?: boolean; parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean } }

// One call the model asks for. `id` is the provider's (OpenAI's call_id), echoed in the result. `rawArgs`: the
// arguments as the provider sent them (a JSON string); `argsError`: they didn't parse (the loop returns the error to
// the model instead of running the tool, and `args` is {}).
export type ToolCall = { id: string; name: string; args: Record<string, unknown>; rawArgs?: string; argsError?: string }

// What a call gave back, as the model will read it. `ok: false`: the tool refused or failed; `text` says why and how to
// put it right (validate's `fix`), so the model can try again (agent.md §4.4: errors go back to the model).
export type ToolResult = { callId: string; name: string; ok: boolean; text: string; ms: number }

// Tokens as the provider counts them (the stub reports zeros). `cached`: input read from the provider's prompt cache
// (part of `input`); `reasoning`: hidden reasoning tokens (part of `output`).
export type Usage = { input: number; output: number; cached?: number; reasoning?: number }
export const NO_USAGE: Usage = Object.freeze({ input: 0, output: 0, cached: 0, reasoning: 0 })

export type ModelMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  // `providerItems`: the provider's own output items (reasoning items, encrypted or not) to send back unchanged on the
  // next request; `responseId`: the provider's id for the response (OpenAI's previous_response_id).
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[]; providerItems?: unknown[]; responseId?: string }
  | { role: 'tool'; callId: string; name: string; content: string }

// `toolChoice: 'none'`: the tools stay listed (the prompt cache's prefix stays the same) but the model must answer in
// text: the loop's last allowed step (S12, src/agent/loop.ts). Left out: the model may call tools ('auto').
export type ModelRequest = { messages: ModelMessage[]; tools: ToolDef[]; signal?: AbortSignal; toolChoice?: 'auto' | 'none' }

// Why the model stopped: it wants tools run, it answered, it ran out of room, the provider's filter stopped it, the
// model refused, or the provider failed.
export type StopReason = 'tool_calls' | 'end' | 'length' | 'content_filter' | 'refusal' | 'error'

// A whole response: text (possibly empty when it only calls tools) and the calls, in the order given (the loop may run
// them in parallel: they never depend on each other within one response).
export type ModelResponse = { text: string; toolCalls: ToolCall[]; usage: Usage; stop: StopReason; error?: string; providerItems?: unknown[]; responseId?: string }

// A streamed response, piece by piece; `done` carries the whole response, the same as `respond` gives.
export type ModelEvent = { type: 'text'; delta: string } | { type: 'tool_call'; call: ToolCall } | { type: 'done'; response: ModelResponse }

// A model adapter. `respond` is required; `stream` is optional (the loop falls back to `respond`).
export interface AgentModel {
  // Shown in the transcript and the report (`stub`, `gpt-5-mini`…).
  readonly name: string
  respond(req: ModelRequest): Promise<ModelResponse>
  stream?(req: ModelRequest): AsyncIterable<ModelEvent>
}

// ---- What the loop may touch

// The UI facade (src/agent/ui.ts in the browser; recorded only in the evals): moves the view, writes no data.
export type UiFacade = {
  goTo: (id: string) => Promise<void>
  focus: (planeId: string | null) => Promise<void>
  select: (ids: string[]) => Promise<void>
  openPanel: (id: string) => Promise<void>
  showBeside: (pieceId: string) => Promise<void>
  currentView: () => WhereView
}

// What one apply did: the plans written as one undo step, or refused (validate's errors, each with its fix).
// `step`: the undo step it joined (its key, for the chat's `[undo]`), when the env knows it; null: nothing was recorded.
export type Applied = { ok: true; label: string; plans: Plan[]; step?: { key: string; label: string } | null } | { ok: false; errors: OpError[] }

// How the agent applies: always as the agent (onboarding skips those steps; agent-run.md "S12/S13 must"), with the undo
// line's text when the loop has a better one than the plans' labels.
// `key` + `mergeAlways`: auto-apply's several applies in one turn joining one undo step (`agent-turn:<turnId>`, S13).
export type ApplyAs = { actor: 'agent'; label?: string; key?: string; mergeAlways?: boolean }

// The snapshot the agent reads: the store's workspace plus what the read layer can use beside it (members, messages,
// document bodies, me, now). In the browser `getWs()` gives the store's; in the evals the in-memory store's.
export type AgentWs = WorkspaceCtx & Omit<ReadWs, keyof WorkspaceCtx>

export type AgentEnv = {
  getWs: () => AgentWs
  // Validates, then writes the plans as one undo step with `meta.actor === 'agent'` (S13's change tool; the eval's
  // in-memory adapter projects them with the same ops code).
  apply: (plans: Plan[], as: ApplyAs) => Promise<Applied>
  // The person the agent acts for: their uid and role (a viewer's agent reads only, §7.2 point 7), `agent: true`.
  actor: OpActor
  // Short ids for this chat (src/agent/read/ids.ts), synced to every snapshot the model is shown.
  ids: Ids
  ui: UiFacade
  now: () => number
  // Ids for new things (op builders' OpCtx.newId); left out, Firestore-style random ids (src/ops/newId.ts' autoId).
  newId?: () => string
  // Called by the loop when a turn starts: every apply within one turn is one undo step (agent.md §7.2 point 2).
  newTurn?: (ask: string) => void
  // S13: the chat's pending changes (src/agent/changeset.ts). `change` adds to it and writes nothing; the workflow
  // (workflow.ts) previews it at the turn's end and accepts or discards it. Left out, the first change call makes one.
  changes?: Changeset
  // The person's agent settings (auto-apply, off by default).
  settings?: AgentSettings
  // Set by the loop for the tools: this turn's id (auto-apply's undo key) and the workspace without the pending changes
  // (`getWs()` inside a turn shows them, so the agent reads its own result).
  turnId?: string
  liveWs?: () => AgentWs
  // The chat's id (auto-apply's undo key `agent-turn:<chatId>:<turnId>`, so two chats' turns never share a step).
  chatId?: string
}

// A tool the loop can run: its definition for the model and how it runs. Read tools never write; write tools go
// through `env.apply`; UI tools through `env.ui`.
export type AgentTool = { def: ToolDef; kind: 'read' | 'write' | 'ui'; run: (env: AgentEnv, args: Record<string, unknown>) => Promise<{ ok: boolean; text: string }> }

// ---- What happened

// One round trip: what the model said and asked for, what the tools gave back, how long, how many tokens.
export type AgentStep = { n: number; text: string; toolCalls: ToolCall[]; results: ToolResult[]; usage: Usage; ms: number; stop: StopReason }

// Why a turn ended: the model answered; the step budget ran out; the model ran out of room before answering; the
// provider's filter or the model refused; the person stopped it; the provider (or the loop) failed.
export type TurnEnd = 'answered' | 'budget' | 'length' | 'refused' | 'stopped' | 'error'

export type AgentTurn = { ask: string; steps: AgentStep[]; answer: string; end: TurnEnd; usage: Usage; ms: number; error?: string }

// `system`: the prompt the turns ran with; `toolsHash`: a hash of the tool definitions (a changed tool shows in the
// report even when its name didn't change).
export type Transcript = { model: string; startedAt: number; turns: AgentTurn[]; system?: string; toolsHash?: string }

// ---- Helpers

export function addUsage(a: Usage, b: Usage): Usage {
  return { input: a.input + b.input, output: a.output + b.output, cached: (a.cached ?? 0) + (b.cached ?? 0), reasoning: (a.reasoning ?? 0) + (b.reasoning ?? 0) }
}

export const turnUsage = (steps: AgentStep[]): Usage => steps.reduce((u, s) => addUsage(u, s.usage), { ...NO_USAGE })
export const transcriptUsage = (t: Transcript): Usage => t.turns.reduce((u, x) => addUsage(u, x.usage), { ...NO_USAGE })

// Every call the model made in a transcript, in order.
export const callsOf = (t: Transcript): ToolCall[] => t.turns.flatMap((x) => x.steps.flatMap((s) => s.toolCalls))
export const resultsOf = (t: Transcript): ToolResult[] => t.turns.flatMap((x) => x.steps.flatMap((s) => s.results))
// The last turn's answer (what the person reads).
export const answerOf = (t: Transcript): string => t.turns[t.turns.length - 1]?.answer ?? ''
export const stepsOf = (t: Transcript): number => t.turns.reduce((n, x) => n + x.steps.length, 0)

// A tool definition from the ops registry's or the read layer's description of a tool (`additionalProperties` kept).
export function toolDef(name: string, description: string, parameters: { type?: string | string[]; properties?: Record<string, unknown>; required?: string[]; additionalProperties?: boolean }, o: { strict?: boolean } = {}): ToolDef {
  return {
    name,
    description,
    ...(o.strict !== undefined ? { strict: o.strict } : {}),
    parameters: { type: 'object', properties: parameters.properties ?? {}, ...(parameters.required?.length ? { required: parameters.required } : {}), ...(parameters.additionalProperties !== undefined ? { additionalProperties: parameters.additionalProperties } : {}) },
  }
}

// A short stable hash of tool definitions (FNV-1a over their JSON), for the transcript.
export function toolsHash(defs: ToolDef[]): string {
  let h = 0x811c9dc5
  for (const ch of JSON.stringify(defs)) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// Call ids the stub and tests give (`call_1`, `call_2`…); real providers give their own.
export function callIds(prefix = 'call_'): () => string {
  let n = 0
  return () => `${prefix}${++n}`
}
