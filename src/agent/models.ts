// The models the person can pick (S12, D-312; docs/specs/agent.md §4.2, §4.8): what we know about each (how well it
// does the agent's job, from the evals: `works well`, `may struggle with big changes`, or not tried yet), how hard it
// reasons (medium by default), and a price table for the eval report only: the chat shows tokens, never prices (D-079).
//
// The person picks; nothing here chooses for them. `SUGGESTED` is only the row pre-selected in the picker when they
// have picked nothing yet, and it is never the cheapest model (1.0 ran the cheapest on low reasoning: §1 cause 1).
//
// `makeModel` builds the model the loop talks to: the OpenAI adapter with the person's key, or, in dev with
// `?agentStub=1` (or localStorage `northstar.agentStub` = '1'), the dev stub (devStub.ts) that plays scripted answers
// on the real tools without a key. The stub is behind `import.meta.env.DEV`, so a production build drops it
// (tests/unit/devStub.test.ts builds this file for production and checks).
import type { AgentEnv, AgentModel, Usage } from './contract'
import { openaiModel, type Effort } from './openai'

// `well`: passes the eval suite; `struggles`: answers well, may struggle with big changes; `unknown`: not measured.
export type Fit = 'well' | 'struggles' | 'unknown'
export const FIT_WORDS: Record<Fit, string> = { well: 'works well', struggles: 'may struggle with big changes', unknown: 'not tried yet' }

// USD per million tokens. Cached input is billed at `cachedInput`; reasoning tokens are part of output.
export type Price = { input: number; cachedInput: number; output: number }

export type KnownModel = {
  id: string
  provider: 'openai'
  // How it did in the evals (all `unknown` until a run with a key: evals/README.md, `--model openai:<id>`).
  fit: Fit
  // Reasoning effort to send; null: the model doesn't reason (no reasoning block).
  effort: Effort | null
  price?: Price
}

// Prices from OpenAI's page on 2026-10-29 (agent.md §4.8; cached input assumed at 10 % where the page didn't say).
// Check the page when a model is added.
export const KNOWN_MODELS: KnownModel[] = [
  { id: 'gpt-5.6-sol', provider: 'openai', fit: 'unknown', effort: 'medium', price: { input: 4, cachedInput: 0.4, output: 20 } },
  { id: 'gpt-5.6-terra', provider: 'openai', fit: 'unknown', effort: 'medium', price: { input: 2, cachedInput: 0.2, output: 12 } },
  { id: 'gpt-5.4-mini', provider: 'openai', fit: 'unknown', effort: 'medium', price: { input: 0.75, cachedInput: 0.075, output: 4.5 } },
]

// Pre-selected in the picker when the person has chosen nothing (they still choose: nothing runs until they save).
export const SUGGESTED = 'gpt-5.6-terra'
export const DEFAULT_EFFORT: Effort = 'medium'

const known = (id: string) => KNOWN_MODELS.find((m) => m.id === id)

// OpenAI's reasoning models: the gpt-5 family and the o-series. Others (gpt-4.1, gpt-4o) get no reasoning block.
// The `*-chat-latest` models (what ChatGPT runs) take no reasoning block.
export const reasons = (id: string) => /^(gpt-5|o\d)/.test(id) && !/-chat(-latest)?$/.test(id)

// The effort to send for a model: what we know, else medium for a reasoning model, else none.
export function effortFor(id: string): Effort | null {
  const k = known(id)
  if (k) return k.effort
  return reasons(id) ? DEFAULT_EFFORT : null
}

// Models from GET /v1/models that can run the agent (chat models that call tools): not embeddings, audio, images,
// moderation, realtime or search-only models, and not `chatgpt-*-latest` (no tool calls). Codex models call tools: in.
export function canChat(id: string): boolean {
  if (!/^(gpt-|o\d)/.test(id)) return false
  return !/(embedding|tts|whisper|transcribe|audio|realtime|image|dall-e|moderation|search|instruct)/.test(id)
}

export type PickerRow = { id: string; fit: Fit; fitWords: string; known: boolean; suggested: boolean; effort: Effort | null }

// The picker's rows from the models a key can use: known ones first (in KNOWN_MODELS' order), then the rest by name.
// `chosen` (the person's saved pick) is never moved or dropped, even if the key no longer lists it.
export function pickerRows(available: string[], chosen?: string): PickerRow[] {
  const ids = new Set(available.filter(canChat))
  if (chosen) ids.add(chosen)
  const row = (id: string): PickerRow => {
    const k = known(id)
    const fit = k?.fit ?? 'unknown'
    return { id, fit, fitWords: FIT_WORDS[fit], known: !!k, suggested: !chosen && id === SUGGESTED, effort: effortFor(id) }
  }
  const first = KNOWN_MODELS.filter((m) => ids.has(m.id)).map((m) => row(m.id))
  const rest = [...ids].filter((id) => !known(id)).sort().map(row)
  return [...first, ...rest]
}

// ---- Prices (the eval report's cost column only)

export const PRICES: Record<string, Price> = {
  stub: { input: 0, cachedInput: 0, output: 0 },
  'stub (wrong)': { input: 0, cachedInput: 0, output: 0 },
  'dev stub': { input: 0, cachedInput: 0, output: 0 },
  ...Object.fromEntries(KNOWN_MODELS.filter((m) => m.price).map((m) => [m.id, m.price!])),
}

const bare = (model: string) => model.replace(/^openai:/, '')
export const priced = (model: string) => bare(model) in PRICES

export function costOf(model: string, u: Usage): number {
  const p = PRICES[bare(model)]
  if (!p) return 0
  const cached = u.cached ?? 0
  return ((u.input - cached) * p.input + cached * p.cachedInput + u.output * p.output) / 1_000_000
}

// ---- Building the model

// OpenAI's prompt_cache_key for a workspace: a hash of its id (FNV-1a), never the id itself.
export function cacheKeyOf(wid: string): string {
  let h = 0x811c9dc5
  for (const ch of `north-star:${wid}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `ns-${h.toString(16).padStart(8, '0')}`
}

// The dev stub is asked for: dev builds only, by the address or a dev switch in this browser.
export function devStubWanted(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('agentStub') === '1') return true
    return typeof localStorage !== 'undefined' && localStorage.getItem('northstar.agentStub') === '1'
  } catch {
    return false
  }
}

// The model a chat talks to. `key`: the person's own key, read by the caller from their browser's storage and passed
// here; it goes into the adapter's closure and nowhere else. `env`: the dev stub reads the current workspace through it.
export async function makeModel(o: { model: string; key?: string; env: Pick<AgentEnv, 'getWs' | 'ids'>; stub?: boolean }): Promise<AgentModel> {
  if (import.meta.env.DEV && (o.stub ?? devStubWanted())) {
    const { devStubModel } = await import('./devStub')
    return devStubModel(o.env)
  }
  const wid = o.env.getWs().wid
  return openaiModel({ key: o.key ?? '', model: o.model, reasoning: effortFor(o.model), ...(wid ? { cacheKey: cacheKeyOf(wid) } : {}) })
}
