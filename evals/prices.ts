// What a run cost (S11): USD per million tokens by model, for the report's cost column. The stub costs nothing.
// Prices change: check the provider's page when a model is added (S12 brings the real adapters); unknown models cost 0
// and the report says so.
import type { Usage } from '../src/agent/contract'

export type Price = { input: number; cachedInput: number; output: number }

// Filled in by S12 with the models the person can pick; until then only the stub runs.
export const PRICES: Record<string, Price> = {
  stub: { input: 0, cachedInput: 0, output: 0 },
  'stub (wrong)': { input: 0, cachedInput: 0, output: 0 },
}

export const priced = (model: string) => model in PRICES

// Cached input is billed at the cached rate; reasoning tokens are part of output.
export function costOf(model: string, u: Usage): number {
  const p = PRICES[model]
  if (!p) return 0
  const cached = u.cached ?? 0
  return ((u.input - cached) * p.input + cached * p.cachedInput + u.output * p.output) / 1_000_000
}
