// What a model call may cost, before and after (D-434, docs/specs/agent-server.md §9), for the server's ledger and the
// owners' page. Pure: whole micro-dollars (OpenAI and Anthropic bill in dollars), the price table the app and the evals
// use (models.ts). A limit is set in euros and turned into dollars at the month's fixed rate, so it never moves within a
// month.
import { costOf, priceOf } from './models'
import { SEARCH_PRICE } from './web'
import type { Usage } from './contract'

const MICRO = 1_000_000
// The most one response may write, and the least worth starting with (under it the call isn't made).
export const OUTPUT_CAP = 32_000
export const OUTPUT_MIN = 1_500
// When nothing has set a month's rate yet (ECB, 24 Nov 2026).
export const USD_PER_EUR = 1.0963

const micro = (usd: number) => Math.round(usd * MICRO)
export const costMicro = (model: string, u: Usage) => micro(costOf(model, u))
export const centsToMicro = (eurCents: number, usdPerEur: number) => Math.round((eurCents / 100) * usdPerEur * MICRO)
// Money as people read it: euros, two places.
export const eurText = (cents: number) => `€${(cents / 100).toFixed(2)}`
// An amount typed in euros: `3`, `3.50`, `€3,5`; empty: none (null); anything else: not an amount (undefined).
export function centsTyped(typed: string): number | null | undefined {
  const t = typed.replace(/[€\s]/g, '').replace(',', '.')
  if (!t) return null
  return /^\d{1,7}(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : undefined
}

export const microToCents = (m: number, usdPerEur: number) => Math.round((m / MICRO / usdPerEur) * 100)

// What a call could cost at worst: its whole input written to the cache, `output` tokens written, `searches` run.
export function worstCase(model: string, o: { input: number; output: number; searches: number }): number {
  const p = priceOf(model)
  if (!p) return 0
  return micro((o.input * (p.cacheWrite ?? p.input) + o.output * p.output) / MICRO + o.searches * SEARCH_PRICE)
}

// How much a call may write with `left` micro-dollars: OUTPUT_CAP, cut to what's left after its input and searches; null
// when that's under OUTPUT_MIN (the call isn't made).
export function outputFor(model: string, left: number, o: { input: number; searches: number; asked?: number }): number | null {
  const p = priceOf(model)
  if (!p) return null
  const room = left - worstCase(model, { input: o.input, output: 0, searches: o.searches })
  const n = Math.min(o.asked ?? OUTPUT_CAP, OUTPUT_CAP, Math.floor((room / MICRO / p.output) * MICRO))
  return n >= OUTPUT_MIN ? n : null
}

// How many web searches a call may run with `left` micro-dollars, after its input and the least output worth having: as many
// as asked, else fewer, else none (the web off for that call, the answer still given).
export function searchesFor(model: string, left: number, o: { input: number; searches: number }): number {
  const p = priceOf(model)
  if (!p || !o.searches) return 0
  const room = left - worstCase(model, { input: o.input, output: OUTPUT_MIN, searches: 0 })
  return Math.max(0, Math.min(o.searches, Math.floor(room / (SEARCH_PRICE * MICRO))))
}

// A call whose usage never came (stopped, cut, its worker gone): what we know of it, never more than was held for it.
// Output counted by what streamed and by time (hidden reasoning streams nothing), so stopping just before the end is
// never free.
const TOKENS_A_SECOND = 60
export function guessed(model: string, o: { input: number; streamedChars: number; ms: number; held: number }): { usage: Usage; cost: number } {
  const output = Math.max(Math.ceil(o.streamedChars / 3), Math.ceil((o.ms / 1000) * TOKENS_A_SECOND))
  const usage: Usage = { input: o.input, output, cacheWrite: o.input }
  return { usage, cost: Math.min(o.held, costMicro(model, usage)) }
}

export const monthOf = (t: number) => new Date(t).toISOString().slice(0, 7)
// The first of next month, in words, for "it starts again on 1 December".
export const resetsOn = (t: number) => {
  const d = new Date(t)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}
