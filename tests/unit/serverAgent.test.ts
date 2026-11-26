// The agent on the server (D-434, functions/src/agent): what its code may pull in (no React, no store, nothing of the
// page), that its env never writes, and that who it works for is read again: not a member, or another role, ends it.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'


import { serverEnv } from '../../functions/src/agent/env'
import { NotAMember, roleNow } from '../../functions/src/agent/membership'
import { loadFixture } from '../../evals/fixtures'
import { EMPTY_VIEW } from '../../evals/env'
import { runTurn } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { AGENT_TOOLS } from '../../src/agent/tools'
import type { UiFacade } from '../../src/agent/contract'

const ROOT = resolve(__dirname, '../..')
const ENTRY = resolve(ROOT, 'functions/src/agent/turn.ts')

// Every value import reached from a file, with the packages it needs.
function reach(entry: string) {
  const files = new Set<string>()
  const packages = new Set<string>()
  const walk = (file: string) => {
    if (files.has(file)) return
    files.add(file)
    const src = readFileSync(file, 'utf8')
    const re = /^\s*(?:import|export)\s+(type\s+)?([^'"]*?)\s*from\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm
    for (const m of src.matchAll(re)) {
      const spec = m[3] ?? m[4]
      if (m[1] || /^\{\s*(type\s+[^,}]+,?\s*)+\}$/.test(m[2] ?? '')) continue
      // A type position (`typeof import('x')`) loads nothing.
      if (m[4] && /typeof\s+$/.test(src.slice(0, m.index))) continue
      if (!spec.startsWith('.')) {
        packages.add(spec)
        continue
      }
      const base = resolve(dirname(file), spec)
      const hit = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((p) => existsSync(p) && /\.tsx?$/.test(p))
      if (!hit) throw new Error(`${relative(ROOT, file)} imports ${spec}: not found`)
      walk(hit)
    }
  }
  walk(entry)
  return { files: [...files].map((f) => relative(ROOT, f)).sort(), packages: [...packages].sort() }
}

describe("what the server's agent is made of", () => {
  const { files, packages } = reach(ENTRY)
  it('only the agent, the ops, the model and the palette: no component, store, listener or page', () => {
    const ok = /^(functions\/src\/agent\/|src\/agent\/(?!ui\/|ui\.ts|browser\.ts|preview\.ts|driving\.ts|devStub)|src\/ops\/(?!firestore\.ts|index\.ts)|src\/model\/|src\/styles\/tokens\.ts$)/
    expect(files.filter((f) => !ok.test(f))).toEqual([])
    expect(files).toContain('src/agent/loop.ts')
    expect(files.length).toBeGreaterThan(40)
  })
  it('only the packages the functions list', () => {
    const listed = Object.keys((JSON.parse(readFileSync(resolve(ROOT, 'functions/package.json'), 'utf8')) as { dependencies: Record<string, string> }).dependencies)
    expect(packages.filter((p) => !p.startsWith('node:') && !listed.some((l) => p === l || p.startsWith(`${l}/`)))).toEqual([])
    expect(packages).toContain('firebase/firestore')
  })
})

const ui = (): UiFacade => ({ goTo: async () => {}, focus: async () => {}, select: async () => {}, openPanel: async () => {}, showBeside: async () => {}, currentView: () => EMPTY_VIEW })
const fixture = loadFixture('medium')
const env = (o: Partial<Parameters<typeof serverEnv>[0]> = {}) =>
  serverEnv({ ws: { get: () => fixture, loadBody: async () => null, close: () => {} }, uid: fixture.workspace.ownerId, role: 'owner', chatId: 'c1', ui: ui(), now: () => fixture.now!, ...o })

describe("the server's env", () => {
  it('proposes and never writes: apply refuses, a change is only pending', async () => {
    const e = env()
    expect(await e.apply([], { actor: 'agent' })).toMatchObject({ ok: false })
    const m = stubModel([{ calls: [{ name: 'change', args: { summary: 'a problem', ops: [{ op: 'create_card', args: { plane: 'p1', type: 'problem', title: 'Rain soaks the stalls', handle: '$a' } }] } }] }, { answer: 'In the preview.' }])
    const { turn } = await runTurn(m, e, AGENT_TOOLS, [], 'add a problem')
    expect([turn.end, e.state().changes.items.length]).toEqual(['answered', 1])
  })
  it('no auto-apply there, whatever the person set in their tab', () => {
    expect(env().settings).toBeUndefined()
  })
  it("its state is plain data a later env goes on from: the same changes and short ids", async () => {
    const e = env()
    const m = stubModel([{ calls: [{ name: 'change', args: { summary: 'a problem', ops: [{ op: 'create_card', args: { plane: 'p1', type: 'problem', title: 'Rain soaks the stalls', handle: '$a' } }] } }] }, { answer: 'ok' }])
    await runTurn(m, e, AGENT_TOOLS, [], 'add a problem')
    const kept = JSON.parse(JSON.stringify(e.state())) as ReturnType<typeof e.state>
    const later = env({ was: kept })
    expect(JSON.parse(JSON.stringify(later.state()))).toEqual(kept)
  })
  it("a viewer's agent gets no write tool", async () => {
    const m = stubModel([{ answer: 'ok' }])
    await runTurn(m, env({ role: 'viewer' }), AGENT_TOOLS, [], 'add a problem')
    expect(m.seen[0].tools.map((t) => t.name)).not.toContain('change')
  })
})

describe('who a run works for', () => {
  const db = (doc: unknown) => ({ doc: (path: string) => ({ get: async () => ({ data: () => (path === 'workspaces/w1' ? doc : undefined) }) }) }) as never
  it('the role now; a member without one, or with one it does not know, only reads', async () => {
    const w = { memberIds: ['a', 'b', 'c', 'd'], roles: { a: 'owner', b: 'editor', c: 'viewer', d: 'admin', gone: 'owner' } }
    expect(await Promise.all(['a', 'b', 'c', 'd'].map((u) => roleNow(db(w), 'w1', u)))).toEqual(['owner', 'editor', 'viewer', 'viewer'])
  })
  it('not a member (whatever the roles still say), or the workspace gone: refused', async () => {
    await expect(roleNow(db({ memberIds: ['a'], roles: { a: 'owner', gone: 'owner' } }), 'w1', 'gone')).rejects.toThrow(NotAMember)
    await expect(roleNow(db(undefined), 'w1', 'a')).rejects.toThrow(NotAMember)
  })
})
