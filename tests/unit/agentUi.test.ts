// The UI facade's queue (S9 review): back-to-back calls run one at a time, in order; a failure doesn't stop the next;
// agentDriving() stays true across the queue. The views' modules are mocked (the facade only calls into them); the
// address is a stub, the workspace the fixture's.
import { afterAll, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => {
  const url = { search: '' }
  const g = globalThis as unknown as Record<string, unknown>
  g.window = globalThis
  g.location = { get search() { return url.search }, pathname: '/workspaces/w' }
  g.history = { state: null, pushState: (_: unknown, __: string, to: string) => void (url.search = to.includes('?') ? to.slice(to.indexOf('?')) : '') }
  g.PopStateEvent = class { constructor(public type: string) {} }
  g.dispatchEvent = () => true
  return { url, log: [] as string[] }
})

vi.mock('../../src/state/canvasView', async () => {
  const { create } = await import('zustand')
  return { useCanvasView: create(() => ({ focusArrived: false, focusLeaving: false, size: { w: 1000, h: 800 }, cardSelected: null, panelShut: null, selected: null, beside: 0 })) }
})
vi.mock('../../src/views/workspace/find', async () => {
  const { useCanvasView } = await import('../../src/state/canvasView')
  return {
    clearFound: () => {},
    // As CanvasView answers a pick: the focus changes in the address, then arrives a moment later.
    findGo: (t: { focus?: string }) => {
      env.log.push(`go ${t.focus}`)
      useCanvasView.setState({ focusArrived: false })
      setTimeout(() => {
        env.url.search = `?focus=${t.focus}`
        useCanvasView.setState({ focusArrived: true })
        env.log.push(`arrived ${t.focus}`)
      }, 40)
    },
  }
})
vi.mock('../../src/views/workspace/CardPanel', () => ({ goToCard: () => {} }))
vi.mock('../../src/views/workspace/Kanban', () => ({ goToTask: () => {}, selectTask: () => {}, selectTasks: () => {}, useKanbanUi: { getState: () => ({ selected: null, many: null }) } }))
vi.mock('../../src/views/workspace/selection', () => ({ selectedIds: () => [], setSelection: (ids: string[]) => env.log.push(`select ${ids.join(',')}`) }))
vi.mock('../../src/views/workspace/sideState', () => ({ useTasksSide: { getState: () => ({ open: false }), setState: () => {} } }))

import { makeStore, registerStore } from '../../src/state/wsStore'
import { fixtureWs, ID } from './fixtures/ws'
import { agentDriving, focus, select } from '../../src/agent/ui'

const off = registerStore(makeStore(fixtureWs()))
afterAll(off)

describe('the facade queue', () => {
  it('back-to-back calls run one after the other; a failure in between does not stop the next; driving throughout', async () => {
    const a = focus(ID.planeA)
    const bad = focus('nothing-here')
    const b = select([ID.qr, ID.loyalty])
    const c = focus(ID.planeA)
    expect(agentDriving()).toBe(true)
    await new Promise((r) => setTimeout(r, 10))
    // Nothing of b has started while a is on its way.
    expect(env.log).toEqual(['go ' + ID.planeA])
    await a
    expect(agentDriving()).toBe(true)
    await expect(bad).rejects.toThrow(/no piece nothing-here/)
    await b
    await c
    // a arrived before b went into plane B's focus and picked; c went back to A after b was done.
    expect(env.log).toEqual([`go ${ID.planeA}`, `arrived ${ID.planeA}`, `go ${ID.planeB}`, `arrived ${ID.planeB}`, `select ${ID.qr},${ID.loyalty}`, `go ${ID.planeA}`, `arrived ${ID.planeA}`])
    expect(agentDriving()).toBe(true)
    await new Promise((r) => setTimeout(r, 520))
    expect(agentDriving()).toBe(false)
  })
})
