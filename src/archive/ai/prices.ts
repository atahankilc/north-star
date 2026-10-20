// Only for the usage log's cost estimates (D-079). Tokens are the record; prices change, so every estimate is shown
// as approximate next to this table's date. $ per 1M tokens in / out, from OpenAI's pricing page.
export const PRICES_AS_OF = '2026-10-17'

const PER_MILLION: Record<string, [number, number]> = {
  'gpt-6-astra': [10, 50],
  'gpt-6.1-sol': [2, 10],
  'gpt-6-sol': [2, 10],
  'gpt-6-luna': [0.1, 0.5],
  'gpt-5.6-sol': [4, 20],
  'gpt-5.6-terra': [2, 12],
  'gpt-5.6-luna': [0.2, 1.2],
  'gpt-5.5': [5, 30],
  'gpt-5.4': [2.5, 15],
  'gpt-5.4-mini': [0.75, 4.5],
  'gpt-5.4-nano': [0.2, 1.25],
  'gpt-5': [1.25, 10],
  'gpt-5-mini': [0.25, 2],
  'gpt-5-nano': [0.05, 0.4],
  'gpt-4.1': [2, 8],
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4o-mini': [0.15, 0.6],
}
const PER_WEB_SEARCH = 0.01

// Dollars, or null for a model not in the table. Cached input is counted at the full input price (an upper bound).
export function estimateCost(e: { model: string; inputTokens: number; outputTokens: number; webSearches: number }): number | null {
  const p = PER_MILLION[e.model]
  if (!p) return null
  return (e.inputTokens * p[0] + e.outputTokens * p[1]) / 1_000_000 + e.webSearches * PER_WEB_SEARCH
}
