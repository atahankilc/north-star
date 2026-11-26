// The ledger's sums (D-434, src/agent/money.ts) and the owners' settings as the function reads them
// (functions/src/ledger/wsAi.ts): what a call may cost at worst, what it may write with what's left, what a call whose
// answer never came is charged, and a limit typed by an owner.
import { describe, expect, it } from 'vitest'
import { centsToMicro, costMicro, guessed, microToCents, OUTPUT_CAP, OUTPUT_MIN, outputFor, resetsOn, searchesFor, worstCase } from '../../src/agent/money'
import { BadSetting, readPatch } from '../../functions/src/ledger/wsAi'

const M = 'gpt-6.1-terra' // $1 in, $0.05 cached, $1.25 a cache write, $5 out, per million

describe('what a call costs', () => {
  it('settled at its price, a cache write above plain input', () => {
    expect(costMicro(M, { input: 1000, cached: 600, cacheWrite: 100, output: 50 })).toBe(705)
    expect(costMicro(M, { input: 0, output: 0, searches: 2 })).toBe(20_000)
  })
  it('at worst: all input written to the cache, the whole output, every search', () => {
    expect(worstCase(M, { input: 10_000, output: 1000, searches: 1 })).toBe(12_500 + 5_000 + 10_000)
    expect(worstCase('no-such-model', { input: 1, output: 1, searches: 0 })).toBe(0)
  })
  it("what it may write: the cap, cut to what's left; nothing under the least worth starting", () => {
    expect(outputFor(M, 1_000_000, { input: 1000, searches: 0 })).toBe(OUTPUT_CAP)
    expect(outputFor(M, 20_000 + 1250, { input: 1000, searches: 0 })).toBe(4000)
    expect(outputFor(M, 1250 + OUTPUT_MIN * 5 - 1, { input: 1000, searches: 0 })).toBeNull()
    expect(outputFor(M, 1_000_000, { input: 1000, searches: 0, asked: 2000 })).toBe(2000)
    expect(outputFor('no-such-model', 1_000_000, { input: 1, searches: 0 })).toBeNull()
  })
  it('a short budget runs fewer web searches, then none, before it refuses the call', () => {
    expect(searchesFor(M, 1_000_000, { input: 1000, searches: 5 })).toBe(5)
    expect(searchesFor(M, 1250 + 7500 + 25_000, { input: 1000, searches: 5 })).toBe(2)
    expect(searchesFor(M, 1250 + 7500 + 9_999, { input: 1000, searches: 5 })).toBe(0)
    expect(searchesFor(M, 1_000_000, { input: 1000, searches: 0 })).toBe(0)
  })
  it('an answer that never came: input and what streamed or the time it took, never more than was held', () => {
    expect(guessed(M, { input: 1000, streamedChars: 3000, ms: 1000, held: 1_000_000 }).usage.output).toBe(1000)
    expect(guessed(M, { input: 1000, streamedChars: 0, ms: 10_000, held: 1_000_000 }).usage.output).toBe(600)
    expect(guessed(M, { input: 1_000_000, streamedChars: 0, ms: 0, held: 5 }).cost).toBe(5)
  })
  it('euros and dollars at the month\'s rate; when it starts again', () => {
    expect(centsToMicro(300, 1.1)).toBe(3_300_000)
    expect(microToCents(3_300_000, 1.1)).toBe(300)
    expect(resetsOn(Date.UTC(2026, 10, 26))).toBe('1 December')
    expect(resetsOn(Date.UTC(2026, 11, 31, 23))).toBe('1 January')
  })
})

describe("an owner's settings, read by the function", () => {
  const o = { allowedMax: 3, modelsMax: 2 }
  it('what it can change, and nothing else', () => {
    expect(readPatch({ wid: 'w1', access: 'chosen', allowed: ['a', 'a', 'b'], allowedModels: ['gpt-6.1-terra'], limits: { person: 300, total: null }, hasKey: true }, o)).toEqual({ wid: 'w1', patch: { access: 'chosen', allowed: ['a', 'b'], allowedModels: ['gpt-6.1-terra'], limits: { person: 300, total: null } } })
  })
  it('refuses what is not', () => {
    for (const bad of [{ wid: '../x' }, { wid: 'w1', access: 'anyone' }, { wid: 'w1', allowed: ['a', 'b', 'c', 'd'] }, { wid: 'w1', allowedModels: ['a b'] }, { wid: 'w1', limits: { person: 1.5 } }, { wid: 'w1', limits: { total: -1 } }, { wid: 'w1', limits: { person: '3' } }])
      expect(() => readPatch(bad, o), JSON.stringify(bad)).toThrow(BadSetting)
  })
})
