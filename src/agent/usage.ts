// The agent's usage log (S12, D-312; docs/specs/agent.md §4.8, §7.2 point 5; CLAUDE.md's hard rule): per answer, the
// tokens (in, cached, out, reasoning), the tools used (names only), the steps, the time and the model. Kept in the
// person's own browser (localStorage), never sent anywhere. NEVER message text, tool arguments or results, workspace
// content, or the key: an entry is built field by field from counts and names (`usageEntry`), and `record` checks the
// shape again before it writes, so nothing else can slip in.
import type { AgentTurn } from './contract'

export const USAGE_KEY = 'northstar.agentUsage.v1'
export const USAGE_MAX = 500

export type UsageEntry = {
  at: number
  model: string
  input: number
  cached: number
  output: number
  reasoning: number
  // Tool names in the order first used, each once.
  tools: string[]
  calls: number
  steps: number
  ms: number
  end: AgentTurn['end']
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

const ENDS: AgentTurn['end'][] = ['answered', 'budget', 'length', 'refused', 'stopped', 'error']
const NAME = /^[a-z][a-z0-9_]{0,39}$/
// A model id: letters, digits and . _ : - (an id like gpt-5.6-terra or openai:gpt-5.4-mini), at most 60.
const MODEL = /^[A-Za-z0-9._:() -]{1,60}$/

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0)

// An entry from a finished turn: counts and names only.
export function usageEntry(turn: AgentTurn, model: string, at = Date.now()): UsageEntry {
  const tools: string[] = []
  let calls = 0
  for (const s of turn.steps)
    for (const c of s.toolCalls) {
      calls++
      if (NAME.test(c.name) && !tools.includes(c.name)) tools.push(c.name)
    }
  return {
    at: count(at),
    model: MODEL.test(model) ? model : 'unknown',
    input: count(turn.usage.input),
    cached: count(turn.usage.cached),
    output: count(turn.usage.output),
    reasoning: count(turn.usage.reasoning),
    tools,
    calls,
    steps: turn.steps.length,
    ms: count(turn.ms),
    end: ENDS.includes(turn.end) ? turn.end : 'error',
  }
}

// The entry again with only its known fields, checked: anything else is dropped.
function sanitize(e: UsageEntry): UsageEntry {
  return {
    at: count(e.at),
    model: typeof e.model === 'string' && MODEL.test(e.model) ? e.model : 'unknown',
    input: count(e.input),
    cached: count(e.cached),
    output: count(e.output),
    reasoning: count(e.reasoning),
    tools: (Array.isArray(e.tools) ? e.tools : []).filter((t): t is string => typeof t === 'string' && NAME.test(t)).slice(0, 40),
    calls: count(e.calls),
    steps: count(e.steps),
    ms: count(e.ms),
    end: ENDS.includes(e.end) ? e.end : 'error',
  }
}

const store = (s?: Storage): Storage | null => {
  if (s) return s
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function readUsage(s?: Storage): UsageEntry[] {
  const st = store(s)
  if (!st) return []
  try {
    const v = JSON.parse(st.getItem(USAGE_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.map((e) => sanitize(e as UsageEntry)) : []
  } catch {
    return []
  }
}

// Adds one answer's entry (the newest last; the oldest dropped past USAGE_MAX). A full or blocked storage drops it.
export function recordUsage(entry: UsageEntry, s?: Storage): void {
  const st = store(s)
  if (!st) return
  const list = [...readUsage(st), sanitize(entry)].slice(-USAGE_MAX)
  try {
    st.setItem(USAGE_KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked: the log is a convenience, never in the way.
  }
}

export const recordTurn = (turn: AgentTurn, model: string, s?: Storage) => recordUsage(usageEntry(turn, model), s)

export function clearUsage(s?: Storage): void {
  try {
    store(s)?.removeItem(USAGE_KEY)
  } catch {
    // Nothing to do.
  }
}

export type UsageSum = { answers: number; input: number; cached: number; output: number; reasoning: number; steps: number; ms: number }

// Totals since a time (all when left out), for Settings' usage line.
export function sumUsage(list: UsageEntry[], since = 0): UsageSum {
  const out: UsageSum = { answers: 0, input: 0, cached: 0, output: 0, reasoning: 0, steps: 0, ms: 0 }
  for (const e of list) {
    if (e.at < since) continue
    out.answers++
    out.input += e.input
    out.cached += e.cached
    out.output += e.output
    out.reasoning += e.reasoning
    out.steps += e.steps
    out.ms += e.ms
  }
  return out
}
