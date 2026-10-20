// What the overview says (D-144): the workspace read as a whole, from what's in it, no model. Where the evidence is
// strong or missing (D-137), the matrix's white space (D-133), the riskiest bets (D-138), what to do next and what looks
// off. Pure, so it can be read the same anywhere.
import { mismatch, tally } from '../../data/evidence'
import type { Validation } from '../../data/model'
import { openCriteria, relevant } from '../matrix/reading'
import { confidenceOf, ranked, type Level } from '../priorities/reading'
import type { WorkspaceCtx } from '../workspace/context'

export type Card = { id: string; type: 'customer' | 'problem' | 'idea'; title: string; validation?: Validation; supports: number; contradicts: number; warn?: string }
export type Gap = { id: string; title: string; open: string[] }
export type Bet = { id: string; title: string; pkg?: boolean; impact?: string; level: Level; guesses: string[] }
// A next step: what, why, and where to go to do it (a view, or an assistant mode to start).
export type Step = { text: string; why: string; view?: 'board' | 'matrix' | 'priorities' | 'table'; mode?: string }
export type Warning = { text: string; view?: 'board' | 'matrix' | 'priorities' | 'table' }

export type Overview = {
  counts: { customers: number; problems: number; ideas: number; features: number; competitors: number; evidence: number }
  strongest: Card[]
  weakest: Card[]
  gaps: Gap[]
  // Features with criteria, and how many of them have scored cells (for "score the matrix").
  criteria: { features: number; scored: number }
  bets: Bet[]
  steps: Step[]
  warnings: Warning[]
}

const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`

export function overviewOf(ws: WorkspaceCtx): Overview {
  // --- evidence
  const cards: Card[] = [
    ...ws.customers.map((c) => ({ ...c, type: 'customer' as const })),
    ...ws.problems.map((c) => ({ ...c, type: 'problem' as const })),
    ...ws.ideas.map((c) => ({ ...c, type: 'idea' as const })),
  ].map((c) => {
    const list = ws.evidence.filter((e) => e.nodeId === c.id)
    const t = tally(list)
    return { id: c.id, type: c.type, title: c.title || 'Untitled', validation: c.validation, ...t, warn: mismatch(c.validation, list) ?? undefined }
  })
  const strength = (c: Card) => (c.validation === 'validated' ? 4 : c.validation === 'testing' ? 2 : c.validation === 'invalidated' ? -4 : 0) + c.supports - c.contradicts
  // A status the evidence doesn't back isn't solid ground: it's flagged under the weakest instead.
  const strongest = cards.filter((c) => strength(c) > 0 && c.validation !== 'invalidated' && !c.warn).sort((a, b) => strength(b) - strength(a)).slice(0, 4)
  // Weakest: what the rest rests on most (problems first), still a guess with nothing behind it, or flagged.
  const weight = (c: Card) => (c.type === 'problem' ? 2 : c.type === 'customer' ? 1 : 0)
  const weakest = cards
    .filter((c) => c.warn || c.validation === 'invalidated' || ((!c.validation || c.validation === 'hypothesis') && c.supports === 0))
    .sort((a, b) => Number(!!b.warn) - Number(!!a.warn) || weight(b) - weight(a) || a.title.localeCompare(b.title))
    .slice(0, 5)

  // --- white space
  const cellsOf = (featureId: string) => ws.competitors.map((c) => ws.comparisons.find((x) => x.featureId === featureId && x.competitorId === c.id))
  const withCriteria = ws.features.filter((f) => f.criteria?.length)
  const gaps = withCriteria.flatMap((f) => {
    const open = openCriteria(f, cellsOf(f.id).filter(relevant))
    return open && open.length ? [{ id: f.id, title: f.title || 'Untitled', open: open.map((k) => k.text) }] : []
  })
  const scored = withCriteria.filter((f) => openCriteria(f, cellsOf(f.id)) !== null).length

  // --- bets: high impact, not well backed; or P1 on little
  const bets: Bet[] = ranked(ws)
    .filter((r) => (r.feature.impact === 'high' || r.feature.priority === 'P1') && r.confidence.level !== 'high')
    .map((r) => {
      const c = r.pkg ? r.confidence : confidenceOf(r.feature, ws)
      return {
        id: r.feature.id,
        title: r.feature.title || 'Untitled',
        pkg: r.pkg,
        impact: r.feature.impact,
        level: c.level,
        guesses: c.basis.filter((b) => !b.validation || b.validation === 'hypothesis').map((b) => b.title).slice(0, 3),
      }
    })
    .sort((a, b) => Number(a.level !== 'low') - Number(b.level !== 'low'))
    .slice(0, 4)

  // --- warnings
  const warnings: Warning[] = []
  const f = ws.features.length
  const p1 = ws.features.filter((x) => x.priority === 'P1').length
  if (f >= 4 && p1 / f > 0.5) warnings.push({ text: `${p1} of ${f} features are P1: priority isn't telling them apart.`, view: 'priorities' })
  const large = ws.features.filter((x) => x.effort === 'L').length
  if (f >= 4 && large / f > 0.6) warnings.push({ text: `${large} of ${f} features are effort L: split the big ones, or find a smaller first step.`, view: 'priorities' })
  const unrated = ws.features.filter((x) => !x.impact).length
  const rivals = new Map<string, number>()
  for (const e of ws.edges) if (e.kind === 'competes-with') for (const id of [e.fromId, e.toId]) rivals.set(id, (rivals.get(id) ?? 0) + 1)
  for (const c of ws.competitors) {
    const k = rivals.get(c.id) ?? 0
    if (k >= 6) warnings.push({ text: `${c.name || 'A competitor'} competes with ${k} of our cards: worth a closer look.`, view: 'matrix' })
  }
  const solved = new Set(ws.edges.filter((e) => e.kind === 'solves').map((e) => e.toId))
  const unsolved = ws.problems.filter((x) => !solved.has(x.id)).length
  if (unsolved) warnings.push({ text: `${n(unsolved, 'problem')} with no idea solving ${unsolved === 1 ? 'it' : 'them'}.`, view: 'board' })
  const solving = new Set(ws.edges.filter((e) => e.kind === 'solves').map((e) => e.fromId))
  const loose = ws.ideas.filter((x) => !solving.has(x.id)).length
  if (loose) warnings.push({ text: `${n(loose, 'idea')} solving no problem yet.`, view: 'board' })
  const filled = ws.comparisons.filter((c) => c.coverage || c.criteria)
  const partial = filled.filter((c) => c.coverage === 'partial' && !c.criteria).length
  if (filled.length >= 8 && partial / filled.length > 0.5) warnings.push({ text: `${partial} of ${filled.length} matrix cells say partial without saying which part.`, view: 'matrix' })
  for (const c of cards) if (c.warn) warnings.push({ text: `${c.title}: ${c.warn}`, view: 'board' })

  // --- next steps, most useful first
  const steps: Step[] = []
  const guessed = cards.filter((c) => c.type !== 'idea' && (!c.validation || c.validation === 'hypothesis') && c.supports + c.contradicts === 0)
  if (guessed.length) {
    const first = guessed.find((c) => c.type === 'problem') ?? guessed[0]
    steps.push({
      text: 'Name the riskiest assumptions and a test for this week.',
      why: `${n(guessed.length, 'customer or problem', 'customers and problems')} still a guess, e.g. ${first.title}.`,
      mode: 'validate',
    })
  }
  if (ws.customers.length) steps.push({ text: 'Prepare customer interviews.', why: 'Evidence comes from talking to the people who have the problem.', mode: 'interview' })
  if (f && withCriteria.length < f) steps.push({ text: 'Score the matrix against criteria.', why: `${n(f - withCriteria.length, 'feature')} without criteria, so "partial" says nothing.`, mode: 'criteria' })
  if (unrated) steps.push({ text: 'Rate the features’ impact.', why: `${n(unrated, 'feature')} without an impact can't be ranked.`, mode: 'prioritize' })
  if (gaps.length) steps.push({ text: `Lean into the white space: ${gaps[0].open[0]}.`, why: `No competitor meets it (${gaps[0].title}).`, view: 'matrix' })

  return {
    counts: {
      customers: ws.customers.length,
      problems: ws.problems.length,
      ideas: ws.ideas.length,
      features: f,
      competitors: ws.competitors.length,
      evidence: ws.evidence.length,
    },
    strongest,
    weakest,
    gaps: gaps.slice(0, 5),
    criteria: { features: withCriteria.length, scored },
    bets,
    steps: steps.slice(0, 4),
    warnings: warnings.slice(0, 6),
  }
}

