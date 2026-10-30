// The dev stub's skills (S17, D-312): one realistic script per `/` command, played against the CURRENT workspace (found
// by names and fields, never by fixed ids), so each command's result (its answer, or its preview) can be shown and
// screenshotted without a key. Dev only: imported by devStub.ts, which models.ts loads only in a dev build.
// A big job answers a plan first whose first line carries `(/name)`; the "go" (or "yes") after it runs that skill's
// change (devStub.ts' pickScript sends it here).
import type { AgentEnv, ModelMessage } from './contract'
import { clean, derive } from './read/derive'
import { kindOfPiece } from '../model/pieces'
import { canvasOf } from '../model/canvases'
import { viewOf } from './changeset'
import { parseSkill } from './skills'
import type { Card } from '../model/cards'

type Env = Pick<AgentEnv, 'getWs' | 'ids'> & { changes?: AgentEnv['changes'] }
type Call = { name: string; args: Record<string, unknown> }
export type SkillStep = { calls: Call[]; text?: string } | { answer: string }
type Result = Pick<Extract<ModelMessage, { role: 'tool' }>, 'name' | 'content'>
type Op = { op: string; args: Record<string, unknown>; why?: string }

export const SKILL_PLAN_MARK = 'Say go, or tell me what to change in the plan.'
const ASK_MARK = 'Merge them?'

const q = (s: string | undefined, n = 60) => {
  const flat = (s ?? '').replace(/\s+/g, ' ').trim()
  return `"${flat.length > n ? `${flat.slice(0, n - 1)}…` : flat}"`
}
const today = () => new Date().toISOString().slice(0, 10)
const dayPlus = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

function kit(env: Env) {
  const ws = clean(viewOf(env.changes, env.getWs()))
  const d = derive(ws)
  const C = (c: { id: string }) => env.ids.short('card', c.id)
  const P = (p: { id: string }) => env.ids.short('piece', p.id)
  const T = (t: { id: string }) => env.ids.short('task', t.id)
  const cite = (c: Card) => `${C(c)} ${q(c.title)}`
  const planes = ws.pieces.filter((p) => kindOfPiece(p) === 'plane')
  const decks = ws.pieces.filter((p) => p.kind === 'kanban')
  const backed = new Set(ws.evidence.map((e) => e.nodeId))
  const named = (words: string) => {
    const w = words.toLowerCase()
    return ws.pieces.find((p) => p.name && w.includes(p.name.toLowerCase()))
  }
  const onPlane = (p: { id: string }) => ws.cards.filter((c) => c.pieceId === p.id || c.planes?.includes(p.id))
  const card = (title: string) => ws.cards.find((c) => c.title.toLowerCase() === title.toLowerCase().trim())
  const linksOf = (c: Card) => ws.edges.filter((e) => e.fromId === c.id || e.toId === c.id)
  const canvasShort = (p: { id: string } & object) => env.ids.short('canvas', canvasOf(p as never))
  return { ws, d, C, P, T, cite, planes, decks, backed, named, onPlane, card, linksOf, canvasShort }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const change = (ops: Op[], summary: string, text: string): SkillStep => ({ calls: [{ name: 'change', args: { ops, summary } }], text })
const proposed = (results: Result[]) => results.length > 0 && results[results.length - 1].name === 'change' && /^Proposed/.test(results[results.length - 1].content)
const refusedWhy = (results: Result[]) => (results[results.length - 1]?.content ?? '').split('\n')[0].replace(/[.\s]+$/, '')
// A plan's first line names the command as the person gave it (`for /test "Pre-order bread":`), so "go" finds it again.
const head = (name: string, rest: string) => `/${name}${rest ? ` ${rest.split('\n')[0].slice(0, 80)}` : ''}`
const plan = (name: string, rest: string, lines: string[]) => ({ answer: [`Here's my plan for ${head(name, rest)}:`, ...lines.map((l, i) => `${i + 1}. ${l}`), SKILL_PLAN_MARK].join('\n') })

// The skill (and what followed it) a plan, or a "merge them?", just before this message was for.
export function planOf(before: string): { name: string; rest: string } | null {
  if (!before.includes(SKILL_PLAN_MARK) && !before.includes(ASK_MARK)) return null
  const m = /\bfor \/([a-z-]+)(?: ([^\n]*?))?:\n/.exec(before)
  return m ? { name: m[1], rest: m[2] ?? '' } : null
}
export const skillOfPlan = (before: string) => planOf(before)?.name ?? null

// The step of a skill's script: `go` = the person said go after its plan.
export function skillStep(env: Env, ask: string, step: number, results: Result[], before = '', canWrite = true): SkillStep {
  const was = planOf(before)
  const parsed = parseSkill(ask)
  const go = !!was && !(parsed && 'skill' in parsed) && /^\s*(go|yes|ok|okay|do it|go ahead|sure)\b/i.test(ask)
  const name = go ? was!.name : parsed && 'skill' in parsed ? parsed.skill.name : 'ask'
  const rest = go ? was!.rest : parsed && 'skill' in parsed ? parsed.rest : ''
  const k = kit(env)
  const done = (what: string) => (proposed(results) ? { answer: what } : { answer: `It was refused: ${refusedWhy(results)}. Nothing changed.` })
  if (!canWrite && (go || ['test', 'compare', 'prioritize', 'organize', 'sort-stickies', 'learn', 'dedupe', 'import', 'interview', 'swot', 'one-pager', 'pitch', 'lean-canvas'].includes(name)) && step > 0)
    return { answer: "You're a viewer here, so I can read and suggest but not change anything; an editor can run this." }

  switch (name) {
    case 'gaps': {
      if (step === 0) return { calls: [{ name: 'query', args: { kind: 'card', contradicting: true, limit: 20 } }, { name: 'query', args: { kind: 'card', type: 'problem', status: 'hypothesis', no_evidence: true, limit: 20 } }] }
      const unbacked = k.ws.cards.filter((c) => c.validation === 'validated' && !k.backed.has(c.id)).slice(0, 3)
      const untested = k.ws.cards.filter((c) => c.type === 'problem' && c.validation === 'hypothesis' && !k.backed.has(c.id)).slice(0, 3)
      const forCust = new Set(k.ws.edges.filter((e) => e.kind === 'for').map((e) => e.fromId))
      const unlinked = k.ws.cards.filter((c) => c.type === 'problem' && !forCust.has(c.id)).slice(0, 2)
      const late = k.ws.tasks.filter((t) => t.due && t.due < today() && t.cardId).slice(0, 2)
      return {
        answer: [
          `**Unbacked** (validated, nothing behind it): ${unbacked.map(k.cite).join(', ')}. Fix: find the interview behind each, or set them back to testing.`,
          `**Untested** problems: ${untested.map(k.cite).join(', ')}. Fix: a "test it" task each.`,
          `**Unlinked**: ${unlinked.map(k.cite).join(', ')} name no customer. Fix: a for link each.`,
          late.length ? `**Stale**: ${late.map((t) => `${k.T(t)} ${q(t.title)}`).join(', ')} are late on their cards. Fix: move or split them.` : '',
          "Say which to fix and I'll propose the changes.",
        ].filter(Boolean).join('\n'),
      }
    }
    case 'next': {
      const deck = k.decks.find((p) => p.kanban?.holds !== 'cards')
      const a = k.ws.cards.find((c) => c.validation === 'validated' && !k.backed.has(c.id))
      const t = k.ws.tasks.filter((x) => x.due && x.due < today()).sort((x, y) => (x.due! < y.due! ? -1 : 1))[0]
      const idea = k.ws.cards.filter((c) => c.type === 'idea' && c.validation === 'hypothesis').sort((x, y) => k.linksOf(y).length - k.linksOf(x).length)[0]
      if (step === 0) return { calls: [{ name: 'query', args: { kind: 'card', contradicting: true, limit: 10 } }, { name: 'query', args: { kind: 'task', overdue: true, limit: 10 } }] }
      if (/\btasks?\b/i.test(rest) && deck && step === 1)
        return change(
          [
            ...(a ? [{ op: 'create_task', args: { deck: k.P(deck), title: `Find the evidence behind "${a.title.slice(0, 40)}"`, card: k.C(a), due: dayPlus(4) } }] : []),
            ...(idea ? [{ op: 'create_task', args: { deck: k.P(deck), title: 'One-week pilot at one stall', card: k.C(idea), due: dayPlus(11) } }] : []),
            { op: 'create_task', args: { deck: k.P(deck), title: 'Interview two customers we have not met', due: dayPlus(7) } },
          ],
          'the next three, as tasks',
          `Adding them to ${k.P(deck)}.`,
        )
      if (step === 2) return done(`Three tasks wait in the preview on ${k.P(deck!)} ${q(deck!.name)}, each with a due day. Apply them as one undo step.`)
      return {
        answer: [
          'The next three:',
          a ? `1. Back or drop ${k.cite(a)}: validated with nothing behind it; one interview this week settles it.` : '1. Write down the evidence behind your validated cards.',
          t ? `2. Finish ${k.T(t)} ${q(t.title)}: due ${t.due}, it's holding up what comes after.` : '2. Clear the late tasks.',
          idea ? `3. Test ${k.cite(idea)}: a hypothesis with ${plural(k.linksOf(idea).length, 'link')} leaning on it; a one-week pilot.` : '3. Test your riskiest idea.',
          deck ? `Want these as tasks on ${k.P(deck)} ${q(deck.name)}?` : '',
        ].filter(Boolean).join('\n'),
      }
    }
    case 'digest': {
      if (step === 0) return { calls: [{ name: 'whats_new', args: { since: dayPlus(-1) } }] }
      const text = results[results.length - 1]?.content ?? ''
      const groups: string[] = []
      for (const line of text.split('\n')) {
        if (line.startsWith('## ')) groups.push(`**${line.slice(3)}**`)
        else if (/^- (changed|made|moved)/.test(line)) groups.push(`- ${line.replace(/^- /, '').replace(/ · /g, ' ').slice(0, 110)}`)
      }
      return { answer: groups.length ? ['Since yesterday:', ...groups.slice(0, 12), 'Nothing waits on you except the comments above, if any.'].join('\n') : 'Nothing changed since yesterday.' }
    }
    case 'review-deck': {
      const deck = (rest && k.named(rest)) || k.decks.filter((p) => p.kanban?.holds !== 'cards').sort((a, b) => k.ws.tasks.filter((t) => t.pieceId === b.id).length - k.ws.tasks.filter((t) => t.pieceId === a.id).length)[0]
      if (!deck) return { answer: 'There is no deck of tasks here yet.' }
      if (step === 0) return { calls: [{ name: 'view', args: { piece: k.P(deck) } }] }
      const cols = deck.kanban?.cols ?? []
      const doneCol = new Set(cols.filter((c) => c.done).map((c) => c.id))
      const tasks = k.ws.tasks.filter((t) => t.pieceId === deck.id && !doneCol.has(t.col))
      const late = tasks.filter((t) => t.due && t.due < today())
      const nobody = late.filter((t) => !t.assignee)
      const over = cols.filter((c) => c.limit && tasks.filter((t) => t.col === c.id).length > c.limit)
      return {
        answer: [
          `${k.P(deck)} ${q(deck.name)}:`,
          over.length ? `- Stuck: ${over.map((c) => `${c.name} holds ${tasks.filter((t) => t.col === c.id).length}/${c.limit}`).join(', ')}, over its limit.` : '- No column over its limit.',
          `- Late (${late.length}): ${late.slice(0, 6).map((t) => `${k.T(t)} ${q(t.title, 34)}`).join(', ')}.`,
          nobody.length ? `- Late and given to no one: ${nobody.map((t) => k.T(t)).join(', ')}. Suggest: give each an owner this week, or drop it.` : '',
          'Want me to propose those moves?',
        ].filter(Boolean).join('\n'),
      }
    }
    case 'test': {
      const sel = rest.replace(/["“”]/g, '').trim()
      const idea = (sel && (k.card(sel) ?? (/^c\d+$/.test(sel) ? k.ws.cards.find((c) => c.id === env.ids.real(sel)?.id) : undefined))) || k.ws.cards.find((c) => c.type === 'idea' && c.validation === 'hypothesis')
      if (!idea) return { answer: 'Which idea? Name it after /test.' }
      const home = k.ws.pieces.find((p) => p.id === idea.pieceId)
      if (!go) {
        if (step === 0) return { calls: [{ name: 'get', args: { ids: [k.C(idea)] } }] }
        return plan('test', rest, [
          `Hypothesis: the people ${k.cite(idea)} is for will use it within a week if it's on their way home.`,
          'Signal: 15 pre-orders in one week at one stall; under 5, we stop.',
          `A deck "Test: ${idea.title.slice(0, 40)}" with four dated tasks for ${k.C(idea)}, over the next two weeks.`,
          `${k.C(idea)} goes to testing.`,
        ])
      }
      if (step === 0)
        return change(
          [
            { op: 'create_piece', args: { kind: 'deck', canvas: home ? k.canvasShort(home) : 'main', name: `Test: ${idea.title.slice(0, 50)}`, handle: '$d' } },
            { op: 'create_task', args: { deck: '$d', title: 'Pick one stall and agree the pilot', card: k.C(idea), start: dayPlus(1), due: dayPlus(2) } },
            { op: 'create_task', args: { deck: '$d', title: 'Put up the sign and the WhatsApp link', card: k.C(idea), start: dayPlus(2), due: dayPlus(3) } },
            { op: 'create_task', args: { deck: '$d', title: 'Run the test week', card: k.C(idea), start: dayPlus(4), due: dayPlus(10) } },
            { op: 'create_task', args: { deck: '$d', title: 'Count and write down what we learned', card: k.C(idea), due: dayPlus(11) } },
            ...(idea.validation === 'hypothesis' ? [{ op: 'update_card', args: { card: k.C(idea), fields: { validation: 'testing' } } }] : []),
          ],
          `test ${idea.title.slice(0, 30)}`,
          'Making the test.',
        )
      return done(`The test waits in the preview: a deck with four dated tasks for ${k.cite(idea)}${idea.validation === 'hypothesis' ? `, and ${k.C(idea)} set to testing` : ''}. Apply it as one undo step.`)
    }
    case 'compare': {
      const plane = (rest && k.named(rest)) || k.planes.sort((a, b) => k.onPlane(b).filter((c) => c.type === 'feature').length - k.onPlane(a).filter((c) => c.type === 'feature').length)[0]
      if (!plane) return { answer: 'There is no plane with features yet.' }
      const feats = new Set(k.onPlane(plane).filter((c) => c.type === 'feature').map((c) => c.id))
      const matches = k.ws.comparisons.filter((c) => c.competitorFeatureId && feats.has(c.featureId))
      if (!go) {
        if (step === 0) return { calls: [{ name: 'view', args: { piece: k.P(plane) } }, { name: 'query', args: { kind: 'card', type: 'competitor', limit: 20 } }] }
        return plan('compare', rest, [`A matrix on ${k.canvasShort(plane)}: the features on ${k.P(plane)} ${q(plane.name)} as rows, every competitor as columns (none / partial / full / better).`, `Fill only the ${plural(matches.length, 'cell')} where a competitor feature matches ours; every other cell stays ? (unknown).`])
      }
      if (step === 0) {
        const C = (id: string) => env.ids.short('card', id)
        return change(
          [
            { op: 'create_piece', args: { kind: 'matrix', canvas: k.canvasShort(plane), name: `${plane.name ?? 'Features'} vs competitors`, matrix: { template: 'compare', rows: { type: 'feature', plane: k.P(plane) }, cols: { type: 'competitor' } }, handle: '$m' } },
            ...matches.map((m) => ({ op: 'update_cell', args: { id: '$m', row: C(m.featureId), col: C(m.competitorId), value: 'full', note: 'a feature of theirs matches ours' } })),
          ],
          `${plane.name} vs competitors`,
          'Making the matrix.',
        )
      }
      return done(`The matrix waits in the preview with ${plural(matches.length, 'cell')} filled from matched competitor features; every other cell is a ?: the workspace says nothing about it yet.`)
    }
    case 'prioritize': {
      const plane = (rest && k.named(rest)) || k.planes.find((p) => /pricing/i.test(p.name ?? '')) || k.planes[0]
      const gaps = plane ? k.onPlane(plane).filter((c) => c.type === 'feature' && (!c.impact || !c.effort)) : []
      if (!go) {
        if (step === 0) return { calls: [{ name: 'view', args: { piece: k.P(plane!) } }] }
        return plan('prioritize', rest, [`Fill impact or effort on ${plural(gaps.length, 'feature')} of ${k.P(plane!)} ${q(plane!.name)}: ${gaps.slice(0, 4).map(k.cite).join(', ')}.`, 'Then explain the order: impact × confidence ÷ effort.'])
      }
      if (step === 0) return change(gaps.map((c) => ({ op: 'update_card', args: { card: k.C(c), fields: { ...(c.impact ? {} : { impact: 'medium' }), ...(c.effort ? {} : { effort: 'M' }) } } })), `impact and effort on ${plane!.name}`, 'Filling them in.')
      const ranked = k.onPlane(plane!).filter((c) => c.type === 'feature' && c.impact && c.effort).sort((a, b) => score(b) - score(a))
      const n = env.changes?.items.filter((i) => i.op === 'update_card').length ?? 0
      return done(`In the preview: impact or effort on ${plural(n, 'feature')}.\nOrder (impact × confidence ÷ effort): first ${ranked.slice(0, 2).map(k.cite).join(' and ')}; last ${ranked.slice(-1).map(k.cite).join('')}.`)
    }
    case 'organize': {
      const plane = (rest && k.named(rest)) || k.planes[0]
      if (!plane) return { answer: 'There is no plane to organise.' }
      const type = (['competitor', 'idea', 'problem', 'customer', 'feature'] as const).find((t) => new RegExp(`\\b${t}`, 'i').test(rest))
      const items = k.onPlane(plane).filter((c) => c.pieceId === plane.id && c.type !== 'package' && (!type || c.type === type))
      const byRegion = /region/i.test(rest)
      const by = /status/i.test(rest) ? 'status' : 'type'
      const region = (c: Card) => (c.regions?.[0] === 'Turkey' ? 'Turkey' : ['Germany', 'DACH'].includes(c.regions?.[0] ?? '') ? 'Germany and DACH' : 'Europe and global')
      const groups = byRegion ? ['Turkey', 'Germany and DACH', 'Europe and global'].map((n) => ({ name: n, items: items.filter((c) => region(c) === n).map(k.C) })).filter((g) => g.items.length) : null
      if (!go) {
        if (step === 0) return { calls: [{ name: 'view', args: { piece: k.P(plane) } }] }
        return plan('organize', rest, [`${plural(items.length, type ?? 'card')} on ${k.P(plane)} ${q(plane.name)} in groups ${byRegion ? 'by where they work' : `by ${by}`}, a heading over each.`, 'Sections, notes and everything else stay where they are; nothing is deleted.'])
      }
      if (step === 0) return change([{ op: 'arrange', args: { items: items.map(k.C), layout: 'cluster', group_by: groups ?? by, headings: true } }], `${plane.name} by ${byRegion ? 'region' : by}`, 'Arranging.')
      return done(`In the preview: ${plural(items.length, 'card')} on ${k.P(plane)} ${q(plane.name)} grouped ${byRegion ? 'by region' : `by ${by}`}, each group under a heading. The moves are drawn as ghosts with lines.`)
    }
    case 'sort-stickies': {
      const plane = (rest && k.named(rest)) || k.planes.find((p) => k.ws.labels.some((l) => l.pieceId === p.id && l.kind === 'sticky'))
      const notes = plane ? k.ws.labels.filter((l) => l.pieceId === plane.id && l.kind === 'sticky') : []
      const typeOf = (t: string) => (/cash|rain|queue|price|card/i.test(t) && !/\?$/.test(t) ? 'problem' : 'idea')
      const fresh = notes.filter((n, i) => notes.findIndex((m) => m.text === n.text) === i && !k.card(n.text))
      if (!go) {
        if (step === 0) return { calls: [{ name: 'query', args: { kind: 'text', type: 'sticky', plane: k.P(plane!) } }] }
        return plan('sort-stickies', rest, [...fresh.map((n) => `${env.ids.short('text', n.id)} ${q(n.text)} → ${typeOf(n.text) === 'idea' ? 'an idea' : 'a problem'} in its words.`), 'A section "From the sticky notes" around them; the notes stay.'])
      }
      if (step === 0)
        return change(
          [...fresh.map((n, i) => ({ op: 'create_card', args: { type: typeOf(n.text), plane: k.P(plane!), title: n.text, handle: `$s${i}` } })), { op: 'create_text', args: { kind: 'section', plane: k.P(plane!), text: 'From the sticky notes', around: fresh.map((_, i) => `$s${i}`) } }],
          `stickies on ${plane!.name} → cards`,
          'Turning them into cards.',
        )
      return done(`In the preview: ${plural(fresh.length, 'card')} from the sticky notes, in a section "From the sticky notes"; the notes stay (say if they should go).`)
    }
    case 'learn': {
      // The notes as facts: a quote, then each sentence after the opening "Talked to …:" (which only says who).
      const quote = /["“]([^"”]+)["”]/.exec(rest)?.[1]?.trim()
      const intro = rest.split(/[:"“]/)[0]
      const facts = [...(quote ? [quote] : []), ...rest.replace(/["“][^"”]*["”]/g, ' ').split(/(?<=[.!?:])\s+/).map((x) => x.trim()).filter((x) => x && !x.startsWith(intro.trim()) && x.length > 8)].slice(0, 3)
      const words = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).map((w) => w.replace(/s$/, '')).filter((w) => w.length > 3))
      const context = words(intro)
      const norm = (t: string) => t.toLowerCase().replace(/\((early|core)\)/g, '').replace(/[^\p{L} ]/gu, '').trim()
      const used = new Set<string>()
      const picks = facts.flatMap((f) => {
        const want = new Set([...context, ...words(f), ...(/cash/i.test(f) ? ['card', 'payment'] : [])])
        const best = k.ws.cards
          .filter((c) => (c.type === 'problem' || c.type === 'customer') && !used.has(norm(c.title)))
          .map((c) => ({ c, n: [...words(c.title)].filter((w) => want.has(w)).length }))
          .sort((a, b) => b.n - a.n)[0]
        if (!best || best.n < 2) return []
        // One card per meaning: its near-duplicate (same title but "(early)") isn't picked too.
        used.add(norm(best.c.title))
        return [{ card: best.c, fact: f }]
      })
      if (step === 0) return { calls: [{ name: 'search', args: { query: [...context].slice(0, 4).join(' ') || 'interview', limit: 8 } }] }
      const who = intro.replace(/^\s*(talked|spoke) (to|with)\s*/i, '').trim().slice(0, 80) || 'interview notes'
      if (step === 1) {
        if (!picks.length) return { answer: "I couldn't match those notes to a customer or problem here; tell me which card they are about." }
        return change(picks.map(({ card, fact }) => ({ op: 'create_evidence', args: { card: k.C(card), kind: fact === quote ? 'quote' : 'interview', text: fact.slice(0, 300), stance: /doesn'?t|don'?t|never|no one/i.test(fact) ? 'contradicts' : 'supports', source: who } })), 'evidence from the notes', 'Adding the evidence.')
      }
      const first = picks[0]?.card
      return done(`In the preview: ${picks.map(({ card, fact }) => `"${fact.slice(0, 50)}" on ${k.cite(card)}`).join('; ')}. ${first && first.validation === 'hypothesis' ? `${k.C(first)} is still a hypothesis: with this it could move to testing; say if you want the status changed.` : 'Say if a status should change.'}`)
    }
    case 'dedupe': {
      const norm = (t: string) => t.toLowerCase().replace(/\((early|core)\)/g, '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim()
      const type = (['customer', 'problem', 'competitor', 'idea', 'feature'] as const).find((t) => new RegExp(`\\b${t}`, 'i').test(rest))
      const list = k.ws.cards.filter((c) => c.type !== 'package' && (!type || c.type === type))
      const pairs: [Card, Card][] = []
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].type === list[j].type && norm(list[i].title) === norm(list[j].title)) pairs.push([list[i], list[j]])
      const keepOf = ([a, b]: [Card, Card]): [Card, Card] => (k.linksOf(a).length + (a.tags?.length ?? 0) >= k.linksOf(b).length + (b.tags?.length ?? 0) ? [a, b] : [b, a])
      if (!go) {
        if (step === 0) return { calls: [{ name: 'query', args: { kind: 'card', ...(type ? { type } : {}), limit: 60 } }] }
        if (!pairs.length) return { answer: `No near-duplicates among the ${plural(list.length, type ?? 'card')}: nothing to merge.` }
        return { answer: [`Near-duplicates for ${head('dedupe', rest)}:`, ...pairs.slice(0, 3).map((p) => { const [keep, gone] = keepOf(p); return `- ${k.cite(gone)} repeats ${k.cite(keep)}: keep ${k.C(keep)} (more links), fold ${k.C(gone)} into it.` }), 'Its links, evidence, tasks and planes move to the one kept. ' + ASK_MARK].join('\n') }
      }
      if (step === 0 && pairs.length)
        return change(
          pairs.slice(0, 3).map((p) => { const [keep, gone] = keepOf(p); return { op: 'merge_cards', args: { keep: k.C(keep), merge: [k.C(gone)] }, why: 'the same thing written twice' } }),
          'merge near-duplicates',
          'Merging them.',
        )
      return done(`In the preview: ${plural(env.changes?.items.filter((i) => i.op === 'merge_cards').length ?? 0, 'merge')}; each folded card's links, evidence, tasks and planes move to the one kept, then it goes.`)
    }
    case 'import': {
      const lines = rest.split('\n').map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean)
      const head = lines[0] ?? ''
      const type = (['customer', 'problem', 'competitor', 'idea', 'feature'] as const).find((t) => new RegExp(`\\b${t}`, 'i').test(head)) ?? 'idea'
      const items = (lines.length > 1 ? lines.slice(1) : (head.split(':')[1] ?? '').split(',')).map((x) => x.trim()).filter(Boolean)
      const plane = k.named(head) ?? k.planes.find((p) => k.onPlane(p).some((c) => c.type === type)) ?? k.planes[0]
      const known = items.filter((t) => k.card(t))
      const fresh = items.filter((t) => !k.card(t))
      if (step === 0) return { calls: [{ name: 'search', args: { query: items.slice(0, 3).join(' ') || 'import', limit: 8 } }] }
      if (step === 1) return change(fresh.map((title) => ({ op: 'create_card', args: { type, plane: k.P(plane!), title } })), `import ${plural(fresh.length, type)}`, 'Importing.')
      return done(`In the preview: ${plural(fresh.length, type)} on ${k.P(plane!)} ${q(plane!.name)}.${known.length ? ` Skipped ${known.map((t) => k.cite(k.card(t)!)).join(', ')}: already here.` : ''}`)
    }
    case 'interview':
    case 'swot':
    case 'one-pager':
    case 'pitch':
    case 'lean-canvas': {
      if (step === 0) return { calls: [{ name: 'query', args: { kind: 'card', status: 'validated', limit: 30 } }, { name: 'query', args: { kind: 'card', type: 'competitor', limit: 20 } }] }
      if (step === 1) {
        const d = documentFor(name, rest, k)
        return change([{ op: 'create_document', args: { title: d.title, text: d.lines.join('\n') } }], d.title, 'Writing the document.')
      }
      return done(`I wrote ${name === 'interview' ? 'an interview script' : name === 'swot' ? 'a SWOT' : name === 'one-pager' ? 'a one-pager' : name === 'pitch' ? 'a pitch outline' : 'a lean canvas'} from the workspace, every point tied to its card. It's private to you and waits in the preview: apply it to keep it, or tell me what to change.`)
    }
    default:
      return { answer: '' }
  }
}

const IMPACT: Record<string, number> = { low: 1, medium: 2, high: 3 }
const EFFORT: Record<string, number> = { S: 1, M: 2, L: 3 }
const score = (c: Card) => (IMPACT[c.impact ?? ''] ?? 1) / (EFFORT[c.effort ?? ''] ?? 2)

function documentFor(name: string, rest: string, k: ReturnType<typeof kit>): { title: string; lines: string[] } {
  const startup = k.ws.workspace?.name?.trim() || 'the startup'
  const top = (pred: (c: Card) => boolean, n = 3) => k.ws.cards.filter(pred).sort((a, b) => k.linksOf(b).length - k.linksOf(a).length).slice(0, n)
  const ev = (c: Card) => {
    const e = k.ws.evidence.filter((x) => x.nodeId === c.id)
    const plus = e.filter((x) => x.stance === 'supports').length
    const minus = e.length - plus
    return e.length ? ` (+${plus} −${minus})` : ''
  }
  const line = (c: Card, tail = '') => `- ${k.cite(c)}${ev(c)}${tail}`
  const strong = top((c) => c.type !== 'problem' && c.validation === 'validated' && k.backed.has(c.id))
  const weak = top((c) => c.validation === 'invalidated' || (c.validation === 'validated' && !k.backed.has(c.id)))
  const probs = top((c) => c.type === 'problem' && c.validation === 'validated')
  const rivals = top((c) => c.type === 'competitor', 2)
  const custs = top((c) => c.type === 'customer' && c.validation === 'validated', 2)
  const ideas = top((c) => c.type === 'idea' && c.validation !== 'invalidated', 2)
  switch (name) {
    case 'swot':
      return { title: `SWOT: ${startup}`, lines: [`# SWOT: ${startup}`, '', '## Strengths', ...strong.map((c) => line(c, ': validated, with evidence.')), '', '## Weaknesses', ...weak.map((c) => line(c, c.validation === 'invalidated' ? ': invalidated.' : ': validated with nothing behind it.')), '', '## Opportunities', ...probs.map((c) => line(c, ': a validated problem.')), '', '## Threats', ...rivals.map((c) => line(c, `: ${c.regions?.join(', ') || 'region unknown'}.`)), '', '## So what', `- Lead with ${strong[0] ? k.cite(strong[0]) : 'what is proven'}; back or drop ${weak[0] ? k.cite(weak[0]) : 'the unbacked cards'}.`] }
    case 'interview': {
      const who = (rest && k.card(rest.replace(/["“”]/g, ''))) || custs[0] || k.ws.cards.find((c) => c.type === 'customer')!
      const linked = k.ws.edges.filter((e) => e.toId === who.id && e.kind === 'for').map((e) => k.ws.cards.find((c) => c.id === e.fromId)).filter((c): c is Card => !!c).slice(0, 3)
      return { title: `Interview script: ${who.title.slice(0, 60)}`, lines: [`# Interview script: ${who.title}`, '', '## Who and why', line(who, ': we test whether their pain is real enough to pay for.'), '', '## Warm-up', '- What does a normal Saturday look like for you?', '', '## The past, specifically', ...linked.map((c) => `- Tell me about the last time this happened: ${k.cite(c)}. What did you do? What did it cost you?`), '- What do you use today instead?', '', '## Listen for', '- Money or time lost, workarounds, things they already pay for.', '', '## Ask for', '- A one-week pre-order pilot.'] }
    }
    case 'one-pager':
      return { title: `${startup} in one page`, lines: [`# ${startup} in one page`, k.ws.workspace?.description ?? '', '', '## For whom', ...custs.map((c) => line(c)), '', '## The problem', ...probs.slice(0, 2).map((c) => line(c)), '', '## Our approach', ...ideas.map((c) => line(c)), '', '## Competitors', ...rivals.map((c) => line(c)), '', '## Next steps', `- Pilot ${ideas[0] ? k.cite(ideas[0]) : 'our main idea'} at one stall for a week.`] }
    case 'pitch':
      return { title: `Pitch: ${startup}`, lines: [`# Pitch: ${startup}`, custs[0] && probs[0] ? `For ${custs[0].title.toLowerCase()} who ${probs[0].title.toLowerCase().replace(/^[^ ]+ [^ ]+ /, '')}, ${startup} is a pre-order service; unlike ${rivals[0]?.title ?? 'the supermarket'}, it runs on what stalls already use.` : '', '', '## Problem', ...probs.slice(0, 2).map((c) => line(c)), '', '## Solution', ...ideas.map((c) => line(c)), '', '## Traction', ...strong.map((c) => line(c)), '', '## Competition', ...rivals.map((c) => line(c)), '', '## The ask', '- A pilot partner market.'] }
    default:
      return { title: `Lean canvas: ${startup}`, lines: [`# Lean canvas: ${startup}`, '', '## 1. Problem', ...probs.slice(0, 2).map((c) => line(c)), '', '## 2. Customer segments', ...custs.map((c) => line(c)), '', '## 3. Unique value proposition', '- Your market order, held until you pass by.', '', '## 4. Solution', ...ideas.map((c) => line(c)), '', '## 5. Channels', '- unknown: how do stalls reach regulars today?', '', '## 6. Revenue streams', '- unknown: no pricing card yet.', '', '## 7. Cost structure', '- unknown.', '', '## 8. Key metrics', '- Pre-orders a week per stall.', '', '## 9. Unfair advantage', '- unknown.'] }
  }
}
