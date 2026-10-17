// Every assistant call goes through here (D-079): it picks the route (your key straight to OpenAI, or the workspace
// key through our server), measures what the call used (tokens, searches, tools, time) and logs own-key calls.
// Workspace-key calls are logged by the server, so nobody can skip or fake them.
import { logOwnUsage, workspaceKeyFetch, type AiUsage, type KeySource } from '../data/ai'
import { directSend, streamReply, type StepResult, type StreamOptions, type Usage } from './openai'

export type CallOptions = Omit<StreamOptions, 'send' | 'direct' | 'onUsage'> & {
  wid: string
  task: AiUsage['task']
  source: KeySource
  // Your own key; unused for the workspace key.
  apiKey: string
}

// One call to OpenAI, so one log entry; an agent answer (D-084) is several of these.
export async function callAi({ wid, task, source, apiKey, ...stream }: CallOptions): Promise<StepResult> {
  const started = Date.now()
  let usage: Usage | null = null
  let webSearches = 0
  const tools = new Set<string>()
  let status: AiUsage['status'] = 'failed'

  try {
    const result = await streamReply({
      ...stream,
      send: source === 'workspace' ? (body, signal) => workspaceKeyFetch(wid, task, body, signal) : directSend(apiKey),
      direct: source === 'own',
      onUsage: (u) => (usage = u),
      onSearch: (e) => {
        if (e.status === 'done') webSearches++
        stream.onSearch?.(e)
      },
    })
    for (const c of result.calls) tools.add(c.name)
    status = 'done'
    return result
  } catch (e) {
    status = stream.signal.aborted ? 'stopped' : 'failed'
    throw e
  } finally {
    // A call refused before it ran cost nothing and isn't logged.
    const ran = usage !== null || status !== 'failed'
    if (source === 'own' && ran) {
      const u: Usage = usage ?? { inputTokens: 0, cachedTokens: 0, outputTokens: 0, reasoningTokens: 0 }
      if (webSearches) tools.add('web_search')
      logOwnUsage(wid, { task, model: stream.model, ...u, webSearches, tools: [...tools], status, ms: Date.now() - started, at: Date.now() }).catch(() => {
        // The log is best effort; the answer already arrived.
      })
    }
  }
}
