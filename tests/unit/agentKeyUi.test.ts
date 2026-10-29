// S14 (D-312; CLAUDE.md's hard rule on keys): the agent's UI keeps the person's own key in this browser only. The key is
// written and read under one localStorage name (settings.ts), never logged (no console call in src/agent/ui), never
// put in the chat's store or entries (only `readKey()` at a turn's start, handed to makeModel / listModels), shown
// only as `sk-…abcd`, and never in the usage log (counts only, even when a message or answer contains it).
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

const UI = resolve(__dirname, '../../src/agent/ui')
const files = readdirSync(UI).filter((f) => /\.tsx?$/.test(f))
const src = (f: string) => readFileSync(join(UI, f), 'utf8')

// A localStorage for node.
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

const KEY = 'sk-proj-THISISAFAKEKEY0123456789abcd'

describe('the key in the agent UI', () => {
  beforeEach(() => mem.clear())

  it('no console call anywhere in src/agent/ui', () => {
    for (const f of files) expect(src(f), f).not.toMatch(/\bconsole\.(log|info|warn|error|debug|trace)\b/)
  })

  it('only settings.ts touches the key\'s storage name; the store reads it through readKey at a turn\'s start', () => {
    for (const f of files.filter((x) => x !== 'settings.ts')) expect(src(f), f).not.toMatch(/KEY_STORE|northstar\.agent\.openaiKey/)
    const store = src('agentStore.ts')
    expect(store.match(/readKey\(\)/g)?.length).toBe(1)
    // Never into the zustand state or an entry.
    expect(store).not.toMatch(/setState\(\{[^}]*key/i)
  })

  it('saved under one clearly named key, shown only as sk-…abcd, removed with [remove]', async () => {
    const { useAgentSettings, readKey, keyHint, KEY_STORE } = await import('../../src/agent/ui/settings')
    useAgentSettings.getState().saveKey(`  ${KEY}\n`)
    expect(KEY_STORE).toBe('northstar.agent.openaiKey')
    expect(mem.get(KEY_STORE)).toBe(KEY)
    expect(readKey()).toBe(KEY)
    const s = useAgentSettings.getState()
    expect(s.hint).toBe(keyHint(KEY))
    expect(s.hint).toBe('sk-…abcd')
    expect(JSON.stringify(s)).not.toContain(KEY)
    s.removeKey()
    expect(mem.has(KEY_STORE)).toBe(false)
    expect(useAgentSettings.getState().hasKey).toBe(false)
  })

  it('the usage log keeps counts only, even when the ask and the answer contain the key', async () => {
    const { recordTurn, readUsage, USAGE_KEY } = await import('../../src/agent/usage')
    recordTurn({ ask: `my key is ${KEY}`, answer: `ok ${KEY}`, steps: [{ n: 1, text: KEY, toolCalls: [{ id: 'c', name: 'search', args: { query: KEY } }], results: [], usage: { input: 10, output: 2 }, ms: 5, stop: 'end' }], end: 'answered', usage: { input: 10, output: 2 }, ms: 5 }, 'gpt-5.6-terra')
    expect(mem.get(USAGE_KEY)).not.toContain(KEY)
    expect(mem.get(USAGE_KEY)).not.toContain('sk-')
    expect(readUsage()[0]).toMatchObject({ input: 10, output: 2, tools: ['search'] })
  })

  it('errors are said in plain words, a refused key pointing at Settings → the agent', async () => {
    const { plainError, KEY_REFUSED } = await import('../../src/agent/ui/errors')
    expect(plainError("the model failed: OpenAI didn't accept this key. Check the key in Settings → the agent")).toEqual({ text: KEY_REFUSED, settings: true })
    expect(KEY_REFUSED).toBe('your key was refused — check it in Settings → the agent')
  })
})
