// Calls straight from the browser to OpenAI with the user's own key (D-006). No SDK: one streaming Responses call
// and one cheap check. Errors carry OpenAI's message, never the key.

const API = 'https://api.openai.com/v1'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export class AiError extends Error {}

const headers = (key: string) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' })

async function failure(res: Response, model: string): Promise<AiError> {
  let detail = ''
  try {
    detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ''
  } catch {
    // Not JSON; the status says enough.
  }
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

type StreamOptions = {
  key: string
  model: string
  instructions: string
  turns: ChatTurn[]
  signal: AbortSignal
  onDelta: (text: string) => void
}

// Streams one answer; resolves when it's complete. Aborting rejects with an AbortError.
export async function streamReply({ key, model, instructions, turns, signal, onDelta }: StreamOptions): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API}/responses`, {
      method: 'POST',
      headers: headers(key),
      signal,
      body: JSON.stringify({
        model,
        instructions,
        input: turns,
        stream: true,
        // Nothing kept on OpenAI's side beyond what their policy requires.
        store: false,
        reasoning: { effort: 'low' },
      }),
    })
  } catch (e) {
    if (signal.aborted) throw e
    throw new AiError("Couldn't reach OpenAI. Check your connection.")
  }
  if (!res.ok || !res.body) throw await failure(res, model)

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
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
        response?: { error?: { message?: string }; incomplete_details?: { reason?: string } }
      }
      if (event.type === 'response.output_text.delta' && event.delta) onDelta(event.delta)
      else if (event.type === 'response.completed') return
      else if (event.type === 'response.failed') throw new AiError(event.response?.error?.message ?? 'OpenAI stopped with an error.')
      else if (event.type === 'response.incomplete') {
        throw new AiError(`The answer was cut short (${event.response?.incomplete_details?.reason ?? 'incomplete'}).`)
      } else if (event.type === 'error') throw new AiError(event.message ?? 'OpenAI stopped with an error.')
    }
  }
}
