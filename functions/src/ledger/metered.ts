// A model whose every call is held for and settled on the ledger (D-434). Wraps any adapter; the loop and the tools (the
// researchers too: they call the turn's model) never see it. A limit reached is the call's error, in words.
import type { AgentModel, ModelEvent, ModelRequest, ModelResponse, Usage } from '../../../src/agent/contract'
import { estimateTokens } from '../../../src/agent/read/text'
import { respondFrom } from '../../../src/agent/provider'
import { WEB_SEARCHES } from '../../../src/agent/web'
import { hold, settle, type Limits, type Who } from './ledger'
import { guessed } from '../../../src/agent/money'
import type { Firestore } from 'firebase-admin/firestore'

// A request's input, roughly: every message, the tools, a picture as ~2k tokens.
export function inputOf(req: ModelRequest): number {
  let n = estimateTokens(JSON.stringify(req.tools))
  for (const m of req.messages) {
    n += estimateTokens(m.content)
    if ('providerItems' in m && m.providerItems) n += estimateTokens(JSON.stringify(m.providerItems))
    if ('image' in m && m.image) n += 2000
    if ('images' in m && m.images) n += 2000 * m.images.length
  }
  return n
}

export function metered(model: AgentModel, db: Firestore, who: () => Omit<Who, 'model'>, o: { limits?: () => Limits | undefined; log?: (what: string, more: Record<string, unknown>) => void } = {}): AgentModel {
  async function* stream(req: ModelRequest): AsyncGenerator<ModelEvent> {
    const input = inputOf(req)
    const searches = req.web ? (req.searches ?? WEB_SEARCHES) : 0
    const h = await hold(db, { ...who(), model: model.name }, { input, searches, ...(req.maxOutput ? { asked: req.maxOutput } : {}), ...(o.limits?.() ? { limits: o.limits()! } : {}) })
    const t0 = Date.now()
    let streamed = 0
    let closed = false
    const close = async (s: Parameters<typeof settle>[2]) => {
      closed = true
      await settle(db, h.call, s).catch((e) => o.log?.('a call was not settled', { call: h.call, error: (e as Error).name }))
    }
    try {
      const inner = model.stream ? model.stream({ ...req, maxOutput: h.maxOutput }) : once(model, { ...req, maxOutput: h.maxOutput })
      for await (const ev of inner) {
        if (ev.type === 'text') streamed += ev.delta.length
        if (ev.type === 'done') {
          const r = ev.response
          const usage: Usage = { ...r.usage, ...(r.usage.searches ? {} : r.web?.queries.length ? { searches: r.web.queries.length } : {}) }
          const used = usage.input > 0 || usage.output > 0
          if (used) await close({ usage, status: r.stop === 'error' ? 'failed' : 'done', ms: Date.now() - t0, ...(r.responseId ? { responseId: r.responseId } : {}) })
        }
        yield ev
      }
    } finally {
      // Stopped, cut, failed with no usage: what we know of it, never more than was held.
      if (!closed) {
        const g = guessed(model.name, { input, streamedChars: streamed, ms: Date.now() - t0, held: h.reserved })
        await close({ usage: g.usage, cost: h.reserved ? g.cost : undefined, status: req.signal?.aborted ? 'stopped' : 'failed', ms: Date.now() - t0, estimated: true })
      }
    }
  }
  return {
    name: model.name,
    ...(model.provider ? { provider: model.provider } : {}),
    ...(model.appendOnly ? { appendOnly: true } : {}),
    stream,
    respond: (req) => respondFrom(stream(req), (m) => new Error(m)),
  }
}

async function* once(model: AgentModel, req: ModelRequest): AsyncGenerator<ModelEvent> {
  const response: ModelResponse = await model.respond(req)
  yield { type: 'done', response }
}
