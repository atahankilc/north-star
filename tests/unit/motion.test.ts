// Motion's foundation (D-326): src/ui/motion.ts says what tokens.css says. Every `--dur-*` token has its DUR entry with
// the same milliseconds; the easings use the tokens' control points; the closed-form in-out is the token's curve; and
// tween() ends where it should, at once under reduced motion.
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// src/state/motion.ts reads the browser's media query and storage as it loads: a stand-in of both, reduced or not.
let reduced = false
vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: () => {} }) })
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
vi.stubGlobal('document', { documentElement: { dataset: {}, setAttribute: () => {}, removeAttribute: () => {} } })

type Motion = typeof import('../../src/ui/motion')
let m: Motion
beforeAll(async () => {
  const state = await import('../../src/state/motion')
  state.useMotion.subscribe((s) => void (reduced = s.reduced))
  m = await import('../../src/ui/motion')
})

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8')
const ms = (v: string) => (v.endsWith('ms') ? Number(v.slice(0, -2)) : Number(v.slice(0, -1)) * 1000)
const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

describe('motion.ts and tokens.css', () => {
  it('every --dur-* token is a DUR entry of the same length', () => {
    const tokens = [...css.matchAll(/--dur-([a-z-]+):\s*([\d.]+m?s)/g)].map(([, name, v]) => [camel(name), ms(v)] as const)
    expect(tokens.length).toBeGreaterThan(8)
    for (const [name, v] of tokens) expect(m.DUR[name as keyof Motion['DUR']], `--dur-${name}`).toBe(v)
  })

  it('the easings use the tokens’ control points', () => {
    const points = (name: string) => css.match(new RegExp(`--ease-${name}:\\s*cubic-bezier\\(([^)]+)\\)`))![1].split(',').map(Number)
    expect([...m.EASE_POINTS.out]).toEqual(points('out'))
    expect([...m.EASE_POINTS.inOut]).toEqual(points('in-out'))
  })

  it('the closed-form in-out is the --ease-in-out curve', () => {
    const exact = m.cubicBezier(...m.EASE_POINTS.inOut)
    for (let i = 0; i <= 20; i++) expect(Math.abs(m.easeInOut(i / 20) - exact(i / 20))).toBeLessThan(0.01)
  })

  it('cubicBezier starts at 0, ends at 1 and climbs', () => {
    let last = -1
    for (let i = 0; i <= 50; i++) {
      const y = m.easeOut(i / 50)
      expect(y).toBeGreaterThanOrEqual(last - 1e-9)
      last = y
    }
    expect([m.easeOut(0), m.easeOut(1)]).toEqual([0, 1])
  })

  it('tween under reduced motion lands at once and says it is done', async () => {
    const state = await import('../../src/state/motion')
    state.useMotion.setState({ reduced: true })
    expect(reduced).toBe(true)
    const seen: number[] = []
    let done = false
    m.tween(400, (k) => seen.push(k), { onDone: () => (done = true) })
    expect([seen, done]).toEqual([[1], true])
    const out: { x: number }[] = []
    m.glideValues({ x: 0 }, { x: 10 }, 400, (v) => out.push(v))
    expect(out).toEqual([{ x: 10 }])
  })
})
