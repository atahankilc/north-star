// What the two provider adapters share (D-399; openai.ts and anthropic.ts each had their own copy): how a failure is
// said, how a stop is said, and the one answer read off a stream. Retrying and counting usage stay each provider's:
// they differ.
import type { AgentModel, ModelEvent, ModelRequest, ModelResponse } from './contract'

export type ProviderErrorKind = 'auth' | 'forbidden' | 'not_found' | 'bad_request' | 'rate_limit' | 'quota' | 'server' | 'network' | 'stream'

// A failure a person can read: what went wrong (never a key in it), its kind, the HTTP status when there was one.
export class ProviderError extends Error {
  constructor(
    message: string,
    public kind: ProviderErrorKind,
    public status?: number,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

// The person stopped it (`[stop]`): what the loop reads as `stopped`, never as an error.
export function abortError(): Error {
  const e = new Error('Stopped.')
  e.name = 'AbortError'
  return e
}

// A model that streams: `respond` is its stream read to the end.
export type StreamingModel = AgentModel & { stream: (req: ModelRequest) => AsyncIterable<ModelEvent>; readonly model: string }

// The whole answer of a stream; `broke` makes the provider's own error when it ends without one.
export async function respondFrom(stream: AsyncIterable<ModelEvent>, broke: (message: string) => Error): Promise<ModelResponse> {
  for await (const ev of stream) if (ev.type === 'done') return ev.response
  throw broke('The answer stopped before it finished.')
}
