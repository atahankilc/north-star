// OpenAI's Responses API, streamed. No SDK. A call goes either straight from the browser with the user's own key
// (D-006) or through our server on the workspace key (D-079); `send` decides which. Errors carry OpenAI's message, never the key.

const API = 'https://api.openai.com/v1'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }
// What a call is given: chat turns, plus within one answer the previous steps' output items and tool results (D-084).
export type InputItem = ChatTurn | Record<string, unknown>
// A function call the model made; its result goes back as a `function_call_output` with the same call id.
export type ToolCall = { callId: string; name: string; args: string }
// One step's result: every output item (reasoning, text, calls, searches), to send back as input, and the calls to run.
export type StepResult = { output: Record<string, unknown>[]; calls: ToolCall[] }

export class AiError extends Error {}

// A source the answer cites (D-076): OpenAI asks that these are shown and clickable.
export type Citation = { url: string; title: string }
export type SearchEvent = { status: 'searching' } | { status: 'done'; queries: string[] }

// What a call used, from the last event of the stream (D-079).
export type Usage = { inputTokens: number; cachedTokens: number; outputTokens: number; reasoningTokens: number }

// Posts a Responses API body and returns the streaming response.
export type Send = (body: object, signal: AbortSignal) => Promise<Response>

// Straight to OpenAI with your own key.
export const directSend =
  (key: string): Send =>
  (body, signal) =>
    fetch(`${API}/responses`, { method: 'POST', headers: headers(key), signal, body: JSON.stringify(body) })

const headers = (key: string) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' })

// `direct`: the status came from OpenAI itself (our server words its own errors).
async function failure(res: Response, model: string, direct = true): Promise<AiError> {
  let detail = ''
  try {
    detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ''
  } catch {
    // Not JSON; the status says enough.
  }
  if (!direct) return new AiError(detail || `The workspace key's server answered ${res.status}.`)
  if (res.status === 401) return new AiError("OpenAI didn't accept this key.")
  if (res.status === 404) return new AiError(`This key can't use ${model}.`)
  if (res.status === 429) return new AiError(detail || 'OpenAI says slow down, or the account is out of credit.')
  return new AiError(detail || `OpenAI answered ${res.status}.`)
}

// A free call that proves the key works and can see the model.
export async function checkKey(key: string, model: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API}/models/${encodeURIComponent(model)}`, { headers: headers(key) })
  } catch {
    throw new AiError("Couldn't reach OpenAI. Check your connection.")
  }
  if (!res.ok) throw await failure(res, model)
}

export type StreamOptions = {
  send: Send
  // False when `send` goes through our server, which words its own errors.
  direct?: boolean
  model: string
  instructions: string
  turns: InputItem[]
  signal: AbortSignal
  onDelta: (text: string) => void
  // Function tools the model may call (D-074); a call arrives whole, with its JSON arguments, in the result.
  tools?: object[]
  // 'none' keeps the tools visible (earlier steps used them) but has the model answer in text: the agent's last step.
  // 'required': it must call one (a research plan, D-088).
  toolChoice?: 'auto' | 'none' | 'required'
  // OpenAI's own web search tool (D-076): every search is billed, so it's opt-in per message.
  webSearch?: boolean
  onSearch?: (e: SearchEvent) => void
  onCitation?: (c: Citation) => void
  onUsage?: (u: Usage) => void
}

// Streams one step of an answer; resolves with its output when complete. Aborting rejects with an AbortError.
export async function streamReply({
  send,
  direct = true,
  model,
  instructions,
  turns,
  signal,
  onDelta,
  tools = [],
  toolChoice = 'auto',
  webSearch,
  onSearch,
  onCitation,
  onUsage,
}: StreamOptions): Promise<StepResult> {
  let res: Response
  try {
    res = await send(
      {
        model,
        instructions,
        input: turns,
        stream: true,
        // Nothing kept on OpenAI's side beyond what their policy requires.
        store: false,
        reasoning: { effort: 'low' },
        // With store: false, the model's reasoning only carries over to the next step in this encrypted form (D-084).
        include: ['reasoning.encrypted_content'],
        ...(webSearch || tools.length
          ? {
              tools: [...tools, ...(webSearch ? [{ type: 'web_search', search_context_size: 'medium' }] : [])],
              tool_choice: toolChoice,
              parallel_tool_calls: false,
            }
          : {}),
      },
      signal,
    )
  } catch (e) {
    if (signal.aborted) throw e
    throw new AiError(direct ? "Couldn't reach OpenAI. Check your connection." : "Couldn't reach the workspace key's server.")
  }
  if (!res.ok || !res.body) throw await failure(res, model, direct)

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  const output: Record<string, unknown>[] = []
  const calls: ToolCall[] = []
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    // Server-sent events: blank-line separated, each with a `data:` line.
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const data = block
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('')
      if (!data || data === '[DONE]') continue
      const event = JSON.parse(data) as {
        type: string
        delta?: string
        message?: string
        item?: { type?: string; name?: string; arguments?: string; call_id?: string; action?: { query?: string; queries?: string[] } }
        annotation?: { type?: string; url?: string; title?: string }
        response?: {
          error?: { message?: string }
          incomplete_details?: { reason?: string }
          usage?: {
            input_tokens?: number
            output_tokens?: number
            input_tokens_details?: { cached_tokens?: number }
            output_tokens_details?: { reasoning_tokens?: number }
          }
        }
      }
      // A finished or cut-short answer reports what it used.
      if ((event.type === 'response.completed' || event.type === 'response.incomplete') && event.response?.usage) {
        const u = event.response.usage
        onUsage?.({
          inputTokens: u.input_tokens ?? 0,
          cachedTokens: u.input_tokens_details?.cached_tokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          reasoningTokens: u.output_tokens_details?.reasoning_tokens ?? 0,
        })
      }
      if (event.type === 'response.output_item.done' && event.item) output.push(event.item)
      if (event.type === 'response.output_text.delta' && event.delta) onDelta(event.delta)
      else if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') {
        calls.push({ callId: event.item.call_id ?? '', name: event.item.name ?? '', args: event.item.arguments ?? '{}' })
      } else if (event.type === 'response.output_item.added' && event.item?.type === 'web_search_call') {
        onSearch?.({ status: 'searching' })
      } else if (event.type === 'response.output_item.done' && event.item?.type === 'web_search_call') {
        const a = event.item.action
        onSearch?.({ status: 'done', queries: a?.queries ?? (a?.query ? [a.query] : []) })
      } else if (event.type === 'response.output_text.annotation.added' && event.annotation?.type === 'url_citation' && event.annotation.url) {
        onCitation?.({ url: event.annotation.url, title: event.annotation.title || event.annotation.url })
      } else if (event.type === 'response.completed') return { output, calls }
      else if (event.type === 'response.failed') throw new AiError(event.response?.error?.message ?? 'OpenAI stopped with an error.')
      else if (event.type === 'response.incomplete') {
        throw new AiError(`The answer was cut short (${event.response?.incomplete_details?.reason ?? 'incomplete'}).`)
      } else if (event.type === 'error') throw new AiError(event.message ?? 'OpenAI stopped with an error.')
    }
  }
  // The stream closed without a final event: keep what arrived.
  return { output, calls }
}
