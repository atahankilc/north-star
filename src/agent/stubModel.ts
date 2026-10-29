// The stub model (S11, D-312; agent-run.md S11, S12): plays a script of steps, tool calls then a final answer, and
// answers exactly as a real adapter would (`AgentModel`: text, tool calls with ids, usage, a stop reason). It ignores
// what it's sent, except to count it. When its script runs out it ends the turn with no text.
//
// Used by the eval runner (evals/run.ts: each task's `reference` is a script, proving graders and the runner) and later
// by S12's dev stub (`?agentStub=1`) so the UI can be driven without a key. `wrong` turns a right script into one that
// does the wrong thing (for grader and runner tests): writes dropped and a vague answer, unless a task gives its own.
import { callIds, NO_USAGE, type AgentModel, type ModelRequest, type ModelResponse, type ToolCall } from './contract'

// One step of a script: the calls of one response (several = parallel calls), or the final answer. A step may carry
// text with its calls (a model "thinking aloud" before calling).
// For loop tests: `stop` overrides how an answer ends (length, refusal…), `fail` makes the call throw (a provider error).
export type ScriptStep = { calls: { name: string; args: Record<string, unknown> }[]; text?: string } | { answer: string; stop?: ModelResponse['stop'] } | { fail: string }
export type Script = ScriptStep[]

export type StubModel = AgentModel & {
  // Requests it has answered (the messages it was sent, for tests).
  readonly seen: ModelRequest[]
  // Back to the script's start (a new turn of the same script).
  reset: () => void
}

export function stubModel(script: Script, o: { name?: string; callId?: () => string } = {}): StubModel {
  const seen: ModelRequest[] = []
  const id = o.callId ?? callIds()
  let at = 0
  return {
    name: o.name ?? 'stub',
    seen,
    reset: () => void (at = 0),
    async respond(req: ModelRequest): Promise<ModelResponse> {
      seen.push(req)
      const step = script[at++]
      if (!step) return { text: '', toolCalls: [], usage: { ...NO_USAGE }, stop: 'end' }
      if ('fail' in step) throw new Error(step.fail)
      if ('answer' in step) return { text: step.answer, toolCalls: [], usage: { ...NO_USAGE }, stop: step.stop ?? 'end' }
      const toolCalls: ToolCall[] = step.calls.map((c) => ({ id: id(), name: c.name, args: structuredClone(c.args) }))
      return { text: step.text ?? '', toolCalls, usage: { ...NO_USAGE }, stop: 'tool_calls' }
    },
  }
}

// The names of tools that change data (S13's `change`; any op name called directly as a tool counts too, as a model
// might try it).
const WRITES = new Set(['change'])

// A right script turned wrong: its reads kept, every write dropped, and an answer that says nothing about the
// workspace. Graders that look at the end state or the answer should fail on it.
export function wrongScript(script: Script, answer = 'Done. Everything looks fine.'): Script {
  const out: Script = []
  for (const s of script) {
    if (!('calls' in s)) continue
    const calls = s.calls.filter((c) => !WRITES.has(c.name))
    if (calls.length) out.push({ ...s, calls })
  }
  out.push({ answer })
  return out
}
