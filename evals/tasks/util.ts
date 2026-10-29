// Helpers for writing tasks: real ids behind the short ids a fixture's map gives (tests/unit/golden/medium.map.md), for
// a task's starting view (selection, focus, panel), which holds real ids as the browser's does.
import { makeIds, type Ids } from '../../src/agent/read'
import { loadFixture, type FixtureName } from '../fixtures'
import type { Script } from '../../src/agent/stubModel'

const registries = new Map<FixtureName, Ids>()

export function realOf(fixture: FixtureName, short: string): string {
  let ids = registries.get(fixture)
  if (!ids) {
    ids = makeIds()
    ids.sync(loadFixture(fixture))
    registries.set(fixture, ids)
  }
  const r = ids.real(short)
  if (!r) throw new Error(`no ${short} in ${fixture}`)
  return r.id
}

// Script steps, short.
export const call = (name: string, args: Record<string, unknown> = {}) => ({ calls: [{ name, args }] })
export const calls = (...list: [string, Record<string, unknown>][]) => ({ calls: list.map(([name, args]) => ({ name, args })) })
export const change = (ops: [string, Record<string, unknown>][], summary?: string) => call('change', { ops: ops.map(([op, args]) => ({ op, args })), ...(summary ? { summary } : {}) })
export const answer = (text: string) => ({ answer: text })
export type { Script }
