// The models the person can pick (S12, D-312; docs/specs/agent.md §4.2, §4.8): what we know about each (how well it
// does the agent's job, from the evals: `works well`, `may struggle with big changes`, or not tried yet), how hard it
// reasons (medium by default), and a price table for the eval report only: the chat shows tokens, never prices (D-079).
//
// The person picks; nothing here chooses for them. `SUGGESTED` is only the row pre-selected in the picker when they
// have picked nothing yet, and it is never the cheapest model (1.0 ran the cheapest on low reasoning: §1 cause 1).
//
// Two providers (D-329): OpenAI's ids bare (`gpt-5.6-terra`), Anthropic's with their provider in
// front (`anthropic:claude-opus-5-5`), so a saved pick, a chat's model and the eval's `--model` say whose key it needs.
//
// `makeModel` builds the model the loop talks to: the OpenAI or the Anthropic adapter (lazily, its SDK a chunk of its
// own) with the person's key for that provider, or, in dev with
// `?agentStub=1` (or localStorage `northstar.agentStub` = '1'), the dev stub (devStub.ts) that plays scripted answers
// on the real tools without a key. The stub is behind `import.meta.env.DEV`, so a production build drops it
// (tests/unit/devStub.test.ts builds this file for production and checks).
import type { AgentEnv, AgentModel, Usage } from './contract'
import { openaiModel, type Effort, type OpenAIOptions } from './openai'
import { SEARCH_PRICE } from './web'
import { readLocal } from '../state/local'
import { claudeModern } from './provider'

// `well`: passes the eval suite; `struggles`: answers well, may struggle with big changes; `unknown`: not measured.
export type Fit = 'well' | 'struggles' | 'unknown'
export const FIT_WORDS: Record<Fit, string> = { well: 'works well', struggles: 'may struggle with big changes', unknown: 'not tried yet' }

// USD per million tokens. Cached input is billed at `cachedInput`, input written to the cache at `cacheWrite` (left out:
// as plain input); reasoning tokens are part of output. One request's tiers (OpenAI past 272k input, Haiku 5.5 past
// 100k) aren't here: the agent's requests stay well under them.
export type Price = { input: number; cachedInput: number; cacheWrite?: number; output: number }

export type KnownModel = {
  id: string
  provider: 'openai' | 'anthropic'
  // How it did in the evals (all `unknown` until a run with a key: evals/README.md, `--model openai:<id>`).
  fit: Fit
  // Reasoning effort to send; null: the model doesn't reason (no reasoning block).
  effort: Effort | null
  price?: Price
}

// Prices from OpenAI's page on 2026-11-25 (gpt-5.6-sol's is promotional until 2026-11-30). Check the page when a model is
// added.
export const KNOWN_MODELS: KnownModel[] = [
  { id: 'gpt-6.2-sol', provider: 'openai', fit: 'unknown', effort: 'medium', price: { input: 2, cachedInput: 0.1, cacheWrite: 2.5, output: 10 } },
  { id: 'gpt-6.1-terra', provider: 'openai', fit: 'unknown', effort: 'medium', price: { input: 1, cachedInput: 0.05, cacheWrite: 1.25, output: 5 } },
  { id: 'gpt-6-luna', provider: 'openai', fit: 'unknown', effort: 'medium', price: { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 } },
  { id: 'gpt-5.6-sol', provider: 'openai', fit: 'unknown', effort: 'medium', price: { input: 4, cachedInput: 0.4, cacheWrite: 5, output: 20 } },
  { id: 'gpt-5.6-terra', provider: 'openai', fit: 'unknown', effort: 'medium', price: { input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 12 } },
  { id: 'gpt-5.4-mini', provider: 'openai', fit: 'unknown', effort: 'medium', price: { input: 0.75, cachedInput: 0.075, output: 4.5 } },
  // Anthropic's (D-329), prices per million from Anthropic's table on 2026-11-25 (5-minute cache writes; Haiku 5.5's up to
  // 100k a prompt). Check the page when a model is added.
  { id: 'anthropic:claude-opus-5-5', provider: 'anthropic', fit: 'unknown', effort: 'medium', price: { input: 4, cachedInput: 0.2, cacheWrite: 5, output: 20 } },
  { id: 'anthropic:claude-sonnet-5-5', provider: 'anthropic', fit: 'unknown', effort: 'medium', price: { input: 2, cachedInput: 0.1, cacheWrite: 2.5, output: 10 } },
  { id: 'anthropic:claude-haiku-5-5', provider: 'anthropic', fit: 'unknown', effort: 'medium', price: { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 } },
  { id: 'anthropic:claude-fable-5-2', provider: 'anthropic', fit: 'unknown', effort: 'medium', price: { input: 8, cachedInput: 0.2, cacheWrite: 10, output: 40 } },
  { id: 'anthropic:claude-fable-5-1', provider: 'anthropic', fit: 'unknown', effort: 'medium', price: { input: 10, cachedInput: 0.25, cacheWrite: 12.5, output: 50 } },
]

export type ProviderId = KnownModel['provider']
const ANTHROPIC = 'anthropic:'
// Whose key a model id needs, and the id that provider knows it by.
export const providerOf = (id: string): ProviderId => (id.startsWith(ANTHROPIC) ? 'anthropic' : 'openai')
const bareId = (id: string) => id.replace(/^(anthropic|openai):/, '')
// Claude's own ids (from its model list) as ours.
export const claudeId = (id: string) => (id.startsWith(ANTHROPIC) ? id : `${ANTHROPIC}${id}`)


// Pre-selected in the picker when the person has chosen nothing (they still choose: nothing runs until they save).
export const SUGGESTED = 'gpt-5.6-terra'
// Pre-selected when only an Anthropic key is saved (Anthropic's own default, never its cheapest).
const SUGGESTED_CLAUDE = 'anthropic:claude-opus-5-5'
// The suggestion for the keys saved: OpenAI's when there's an OpenAI key (or none), else Claude's.
export const suggestedFor = (keys: { openai: boolean; anthropic: boolean }) => (!keys.openai && keys.anthropic ? SUGGESTED_CLAUDE : SUGGESTED)
export const DEFAULT_EFFORT: Effort = 'medium'

const known = (id: string) => KNOWN_MODELS.find((m) => m.id === id)

// OpenAI's reasoning models: gpt-5 and every generation after it, and the o-series. Others (gpt-4.1, gpt-4o) get no reasoning block.
// The `*-chat-latest` models (what ChatGPT runs) take no reasoning block.
// Claude's 4.6+ models always think (adaptive; provider.ts' `claudeModern`), so they take an effort too.
export const reasons = (id: string) =>
  providerOf(id) === 'anthropic' ? claudeModern(bareId(id)) : /^(gpt-([5-9]|\d{2})|o\d)/.test(id) && !/-chat(-latest)?$/.test(id)

// The effort to send for a model: what we know, else medium for a reasoning model, else none.
export function effortFor(id: string): Effort | null {
  const k = known(id)
  if (k) return k.effort
  return reasons(id) ? DEFAULT_EFFORT : null
}

// Models from GET /v1/models that can run the agent (chat models that call tools): not embeddings, audio, images,
// moderation, realtime or search-only models, and not `chatgpt-*-latest` (no tool calls). Codex models call tools: in.
export function canChat(id: string): boolean {
  // Claude's: every chat model it lists calls tools.
  if (id.startsWith(ANTHROPIC)) return /^claude-/.test(bareId(id))
  if (!/^(gpt-|o\d)/.test(id)) return false
  return !/(embedding|tts|whisper|transcribe|audio|realtime|image|dall-e|moderation|search|instruct)/.test(id)
}

export type PickerRow = { id: string; fit: Fit; fitWords: string; known: boolean; suggested: boolean; effort: Effort | null }

// The picker's rows from the models a key can use: known ones first (in KNOWN_MODELS' order), then the rest by name.
// `chosen` (the person's saved pick) is never moved or dropped, even if the key no longer lists it.
export function pickerRows(available: string[], chosen?: string, suggest = SUGGESTED): PickerRow[] {
  const ids = new Set(available.filter(canChat))
  if (chosen) ids.add(chosen)
  const row = (id: string): PickerRow => {
    const k = known(id)
    const fit = k?.fit ?? 'unknown'
    return { id, fit, fitWords: FIT_WORDS[fit], known: !!k, suggested: !chosen && id === suggest, effort: effortFor(id) }
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

// A model's price by any of its names: `openai:gpt-…` or bare, `anthropic:claude-…` or the bare name its adapter
// reports (an eval's attempts are priced by the adapter's name: Claude's runs showed $0).
const priceOf = (model: string): Price | undefined => PRICES[model.replace(/^openai:/, '')] ?? PRICES[claudeId(model)]
export const priced = (model: string) => !!priceOf(model)

export function costOf(model: string, u: Usage): number {
  const p = priceOf(model)
  if (!p) return 0
  const cached = u.cached ?? 0
  const written = u.cacheWrite ?? 0
  // Web searches (D-360) cost the same on either provider, apart from tokens; a model that costs nothing (the stubs)
  // searched nothing real.
  const searches = p.input || p.output ? (u.searches ?? 0) * SEARCH_PRICE : 0
  return ((u.input - cached - written) * p.input + cached * p.cachedInput + written * (p.cacheWrite ?? p.input) + u.output * p.output) / 1_000_000 + searches
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
    return readLocal('northstar.agentStub') === '1'
  } catch {
    return false
  }
}

// The model a chat talks to. `key`: the person's own key, read by the caller from their browser's storage and passed
// here; it goes into the adapter's closure and nowhere else. `env`: the dev stub reads the current workspace through it.
// `effort`: the person's reasoning effort (Settings → the agent), sent only to a model that reasons; left out, effortFor.
// `via`: no key of their own, the workspace's (D-427): an OpenAI model only, through the `ai` function.
export async function makeModel(o: { model: string; key?: string; via?: OpenAIOptions['via']; env: Pick<AgentEnv, 'getWs' | 'ids'>; stub?: boolean; effort?: Effort }): Promise<AgentModel> {
  if (import.meta.env.DEV && (o.stub ?? devStubWanted())) {
    const { devStubModel } = await import('./devStub')
    return devStubModel(o.env)
  }
  const wid = o.env.getWs().wid
  const reasoning = effortFor(o.model) && o.effort ? o.effort : effortFor(o.model)
  if (providerOf(o.model) === 'anthropic') {
    const { anthropicModel } = await import('./anthropic')
    return anthropicModel({ key: o.key ?? '', model: bareId(o.model), effort: reasoning })
  }
  return openaiModel({ key: o.key ?? '', ...(o.key ? {} : o.via ? { via: o.via } : {}), model: o.model, reasoning, ...(wid ? { cacheKey: cacheKeyOf(wid) } : {}) })
}
