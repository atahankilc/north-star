// Lists kept by hand in two places agree (D-391, docs/specs/shared-code.md R4.2). firestore.rules can't import, CSS
// can't be read by WebGL, and an export has its own list of collections: where a copy can't be merged, a test holds the
// copies equal, as limits.test.ts does for the numbers. A change to one side fails here until the other follows.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ALL_TYPES, FEATURE_EFFORTS, FEATURE_IMPACTS, FEATURE_STATUSES, PRIORITIES, VALIDATIONS } from '../../src/model/cards'
import { AVAILABILITIES, CELL_KINDS, CONFIDENCES, DOC_COLS, DOC_KINDS, EVIDENCE_KINDS, TOTALS_AS, TOTALS_AT } from '../../src/model/shapes'
import { TYPE_OF_COLLECTION, WS_COLLECTIONS } from '../../src/model/fromDocs'
import { cleanCanvas, cleanCard, cleanCell, cleanComparison, cleanCompetitorFeature, cleanEdge, cleanEvidence, cleanLabel, cleanPiece, cleanPlace, cleanSpot, cleanTask, type Ids, type Raw } from '../../src/model/clean'
import { KEPT } from '../../src/ops/validate'
import { BUNDLE_COLLECTIONS } from '../../src/io/bundle'
import { colors, fonts, palettes } from '../../src/styles/tokens'
import { LINK_KINDS, PICK_ORDER, READ_ORDER } from '../../src/model/edges'
import { PIECE_TONE } from '../../src/ui/foundation/pieceTone'
import { fixtureDocs, lensDocs, taskDocs } from './fixtures/ws'

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
const rules = read('firestore.rules')
const words = (list: string) => [...list.matchAll(/'([^']*)'/g)].map((m) => m[1])
const sorted = (a: readonly string[]) => [...a].sort()

// ---- Values: every place the rules list a field's values, against the model's list.
// `optIn(d, 'field', [...])`, every time it's written.
const optIn = (field: string) => [...rules.matchAll(new RegExp(`optIn\\(\\w+, '${field}', \\[([^\\]]*)\\]\\)`, 'g'))].map((m) => words(m[1]))
// `expr in [...]`, every time.
const isIn = (expr: string) => [...rules.matchAll(new RegExp(`${expr.replace(/\./g, '\\.')} in \\[([^\\]]*)\\]`, 'g'))].map((m) => words(m[1]))

const VALUES: [string, readonly string[], string[][]][] = [
  ['VALIDATIONS', VALIDATIONS, optIn('validation')],
  ['PRIORITIES', PRIORITIES, optIn('priority')],
  ['FEATURE_STATUSES', FEATURE_STATUSES, optIn('status')],
  ['FEATURE_IMPACTS', FEATURE_IMPACTS, optIn('impact')],
  ['FEATURE_EFFORTS', FEATURE_EFFORTS, optIn('effort')],
  ['AVAILABILITIES', AVAILABILITIES, optIn('availability')],
  ['CONFIDENCES', CONFIDENCES, optIn('confidence')],
  ['TOTALS_AT', TOTALS_AT, optIn('totalsAt')],
  ['TOTALS_AS', TOTALS_AS, optIn('totalsAs')],
  ['CELL_KINDS', CELL_KINDS, isIn('m.cell')],
  ['EVIDENCE_KINDS', EVIDENCE_KINDS, [words(rules.match(/d\.nodeType in \[[^\]]*\]\s*&& d\.kind in \[([^\]]*)\]/)?.[1] ?? '')]],
  ['DOC_KINDS', DOC_KINDS, [words(rules.match(/d\.kind in \[([^\]]*)\]\s*&& isText\(d\.title/)?.[1] ?? ''), words(rules.match(/t\.kinds\.toSet\(\)\.hasOnly\(\[([^\]]*)\]/)?.[1] ?? '')]],
  ['DOC_COLS', DOC_COLS, isIn('t.sort.col')],
  ['ALL_TYPES', ALL_TYPES, isIn('d.type')],
]

describe('value lists match firestore.rules', () => {
  for (const [name, model, found] of VALUES)
    it(name, () => {
      expect(found.length, `no list for ${name} found in firestore.rules`).toBeGreaterThan(0)
      for (const list of found) expect(sorted(list)).toEqual(sorted(model))
    })
})

// ---- Collections: what a workspace holds (fromDocs.ts), what an export carries (io/bundle.ts) and what the rules
// take as content are one list; threads are the listeners' only (never exported, their own rule).
describe('collections', () => {
  const content = WS_COLLECTIONS.filter((c) => c !== 'threads')
  it('an export carries every content collection', () => expect(sorted(BUNDLE_COLLECTIONS)).toEqual(sorted(content)))
  it("the rules' content shapes cover every content collection", () => {
    const at = rules.indexOf("collection == 'labels'")
    const block = rules.slice(at, rules.indexOf('}', at))
    const named = [...block.matchAll(/collection == '(\w+)'/g)].map((m) => m[1]).concat(words(block.match(/collection in \[([^\]]*)\]/)?.[1] ?? ''))
    expect(sorted(named)).toEqual(sorted(content))
  })
})

// ---- Fields: a cleaner (src/model/clean.ts: import, and the ops' validate) never gives a doc a field the rules
// refuse, and every field the rules take is one a cleaner gives, one the writer adds itself (validate.ts' KEPT), or
// named in the cleaner's own text. The cleaners run over the unit fixtures' docs.
const cardKeys = words(rules.match(/function cardKeys\(\) \{\s*return \[([^\]]*)\]/)?.[1] ?? '')
function allowed(coll: string): string[] {
  const at = rules.search(new RegExp(`collection (?:== '${coll}'|in \\[[^\\]]*'${coll}'[^\\]]*\\])`))
  if (at < 0) throw new Error(`no shape for ${coll} in firestore.rules`)
  // Up to the next collection's line: its own `onlyKeys(...)`, or its valid function's `d.keys().hasOnly([...])`.
  const line = rules.slice(at, rules.indexOf('\n        ||', at + 1) > 0 ? rules.indexOf('\n        ||', at + 1) : rules.indexOf(';', at))
  const m = line.match(/onlyKeys\(d, (cardKeys\(\)(?:\.concat\(\[([^\]]*)\]\))?|\[([^\]]*)\])\)/)
  if (m) return m[1].startsWith('cardKeys') ? [...cardKeys, ...words(m[2] ?? '')] : words(m[3] ?? '')
  const fn = line.match(/(valid\w+)\(/)?.[1]
  const body = fn ? rules.slice(rules.indexOf(`function ${fn}(`)) : ''
  const own = body.match(/d\.keys\(\)\.hasOnly\(\[([^\]]*)\]\)/)
  if (!own) throw new Error(`no field list for ${coll}`)
  return words(own[1])
}
const ids: Ids = {
  card: (old) => (typeof old === 'string' ? { id: old, type: 'idea' } : undefined),
  piece: (old) => (typeof old === 'string' ? old : undefined),
  doc: (old) => (typeof old === 'string' ? old : undefined),
}
const clean = (coll: string, raw: Raw): Record<string, unknown> | null | undefined => {
  const type = TYPE_OF_COLLECTION[coll]
  if (type) return cleanCard(type, raw, 0)
  if (coll === 'labels') return cleanLabel(raw, 0)
  if (coll === 'pieces') return cleanPiece(raw, 0, ids)
  if (coll === 'edges') return cleanEdge(raw)
  if (coll === 'evidence') return cleanEvidence(raw, 0)
  if (coll === 'competitorFeatures') return cleanCompetitorFeature(raw, 0)
  if (coll === 'comparisons') return cleanComparison(raw, 0)
  if (coll === 'places') return cleanPlace(raw, 0)
  if (coll === 'tasks') return cleanTask(raw, 0)
  if (coll === 'cells') return cleanCell(raw, 0)
  if (coll === 'canvases') return cleanCanvas(raw, 0)
  if (coll === 'pieceSpots') return cleanSpot(raw, 0)
  return undefined
}
const keptFor = (coll: string) => Object.keys(KEPT[TYPE_OF_COLLECTION[coll] ? 'card' : coll] ?? {})

// A cleaner's own text: a field the fixtures' docs don't hold still counts as handled when the cleaner names it.
const cleanSrc = read('src/model/clean.ts')
const CLEANER: Record<string, string> = { labels: 'cleanLabel', pieces: 'cleanPiece', edges: 'cleanEdge', evidence: 'cleanEvidence', competitorFeatures: 'cleanCompetitorFeature', comparisons: 'cleanComparison', places: 'cleanPlace', tasks: 'cleanTask', cells: 'cleanCell', canvases: 'cleanCanvas', pieceSpots: 'cleanSpot' }
function named(coll: string): Set<string> {
  const at = cleanSrc.indexOf(`export function ${TYPE_OF_COLLECTION[coll] ? 'cleanCard' : CLEANER[coll]}(`)
  const body = cleanSrc.slice(at, cleanSrc.indexOf('\nexport function ', at + 1))
  const out = new Set([...body.matchAll(/\b([A-Za-z]\w*)\s*[:,]/g)].map((m) => m[1]))
  // `...times(d, now)` gives both dates.
  if (body.includes('times(')) for (const k of ['createdAt', 'updatedAt']) out.add(k)
  return out
}

describe("a cleaner's fields are the rules' fields", () => {
  const emitted = new Map<string, Set<string>>()
  for (const docs of [fixtureDocs(), lensDocs(), taskDocs()])
    for (const [coll, list] of Object.entries(docs))
      for (const raw of list as Raw[]) for (const k of Object.keys(clean(coll, raw) ?? {})) emitted.set(coll, (emitted.get(coll) ?? new Set()).add(k))
  const colls = [...emitted.keys()].filter((c) => c !== 'threads')
  it('the fixtures reach the cleaners', () => expect(colls.length).toBeGreaterThan(8))
  for (const coll of colls) {
    it(`${coll}: nothing the rules refuse`, () => {
      const ok = new Set(allowed(coll))
      expect([...emitted.get(coll)!].filter((k) => !ok.has(k))).toEqual([])
      // What the writer adds itself is allowed too.
      expect(keptFor(coll).filter((k) => !ok.has(k) && !(TYPE_OF_COLLECTION[coll] && k === 'memberIds'))).toEqual([])
    })
    it(`${coll}: every field the rules take is handled`, () => {
      const handled = new Set([...emitted.get(coll)!, ...keptFor(coll), ...named(coll)])
      expect(sorted(allowed(coll).filter((k) => !handled.has(k)))).toEqual([])
    })
  }
})

// ---- Tokens: src/styles/tokens.ts is what WebGL and the agent's picture read; tokens.css is the truth (D-325).
describe('tokens.ts mirrors tokens.css', () => {
  const css = read('src/styles/tokens.css')
  const lightAt = css.indexOf("\n:root[data-theme='light'] {")
  const dark = css.slice(0, lightAt)
  const light = css.slice(lightAt)
  const token = (block: string, name: string) => block.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'))?.[1].trim()
  const ACCENTS = ['magenta', 'cyan', 'yellow', 'blue', 'green'] as const
  it('the page, the text greys and the accents, dark', () => {
    expect(colors.bg).toBe(token(dark, 'bg'))
    expect(colors.fg).toBe(token(dark, 'fg'))
    expect(colors.fgDim).toBe(token(dark, 'fg-dim'))
    for (const a of ACCENTS) expect(colors[a], a).toBe(token(dark, `accent-${a}`))
    for (const a of ACCENTS) expect(palettes.dark[a], a).toBe(token(dark, `accent-${a}`))
  })
  it('the page and the accents, light', () => {
    expect(palettes.light.bg).toBe(token(light, 'bg'))
    for (const a of ACCENTS) expect(palettes.light[a], a).toBe(token(light, `accent-${a}`))
  })
  it('the fonts', () => {
    expect(token(dark, 'font-mono')).toContain(`'${fonts.mono}'`)
    expect(token(dark, 'font-display')).toContain(`'${fonts.display}'`)
  })
})

// ---- Link kinds: one record in model/edges.ts (D-394); its two other orders name the same kinds, each once, and every
// group and every piece kind's colour is a token that exists.
describe('link kinds and piece colours', () => {
  const css = read('src/styles/tokens.css')
  const kinds = LINK_KINDS.map((k) => k.kind)
  it('the agent picks from, and reads in the order of, the same kinds', () => {
    expect(sorted(PICK_ORDER)).toEqual(sorted(kinds))
    expect(sorted(READ_ORDER)).toEqual(sorted(kinds))
    expect(new Set(kinds).size).toBe(kinds.length)
  })
  it("a group's colour is a token", () => {
    for (const k of LINK_KINDS) expect(css, k.group).toContain(`--link-${k.group}:`)
  })
  it("a piece kind's colour is a token", () => {
    for (const [kind, tone] of Object.entries(PIECE_TONE)) expect(css, kind).toContain(`${tone.slice(4, -1)}:`)
  })
})
