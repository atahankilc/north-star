// A skill's checks (agent-bugs 21): what its guide asks for that code can see in the proposal. When a skill's turn ends
// with changes waiting, the loop runs that skill's checks once; what they find goes back to the model for one more
// step (fix it, or say why not in the answer), and what's still there after it goes into the preview's warnings, so
// the person sees it too. Facts about the proposal, never a reading of the person's words beyond the names of things
// in the workspace (a card's short id or title, a plane's name) that the ask points at.
// Pure: no React, no Firebase.
import { FOR } from '../../model/edges'
import { isOnPlane, type Card } from '../../model/cards'
import { heldCards, isPriorities, rowFieldOf } from '../../model/kanbanCards'
import type { Changeset, Warning } from '../changeset'
import type { AgentWs } from '../contract'
import type { Ids } from '../read'

export type CheckCtx = {
  // The workspace without the pending changes, and with them.
  before: AgentWs
  after: AgentWs
  cs: Changeset
  ids: Ids
  // What came after `/name` in the ask.
  rest: string
}
// Each finding in two voices (agent-bugs 42): the model's with short ids and the fix, the person's in names only.
type Check = (c: CheckCtx) => Warning[]

const madeOf = (cs: Changeset) => new Set(cs.items.flatMap((i) => i.made))
const q = (s: string | undefined, n = 40) => `"${(s ?? '').length > n ? `${(s ?? '').slice(0, n - 1)}…` : (s ?? '')}"`
const cardName = (c: CheckCtx, card: Card) => `${c.ids.short('card', card.id)} ${q(card.title)}`
const names = (cards: Card[]) => `${cards.slice(0, 5).map((x) => q(x.title)).join(', ')}${cards.length > 5 ? ', …' : ''}`
const low = (s: string) => s.toLowerCase().replace(/\s+/g, ' ')

// The cards the ask points at: by short id (`c12`) or by a title written out (at least 3 letters, whole).
function named(c: CheckCtx, cards: Card[]): Card[] {
  const words = new Set(c.rest.match(/\b[a-z]\d+\b/gi)?.map((w) => w.toLowerCase()) ?? [])
  const text = low(c.rest)
  return cards.filter((card) => {
    if (words.has(c.ids.short('card', card.id).toLowerCase())) return true
    const t = low(card.title.trim())
    if (t.length < 3) return false
    const at = text.indexOf(t)
    return at >= 0 && !/\w/.test(text[at - 1] ?? '') && !/\w/.test(text[at + t.length] ?? '')
  })
}

// The planes the ask names, by name or short id.
function namedPlanes(c: CheckCtx) {
  const words = new Set(c.rest.match(/\b[a-z]\d+\b/gi)?.map((w) => w.toLowerCase()) ?? [])
  const text = low(c.rest)
  return c.after.pieces.filter((p) => {
    if (p.kind !== 'plane') return false
    if (words.has(c.ids.short('piece', p.id).toLowerCase())) return true
    const n = low((p.name ?? '').trim())
    if (n.length < 3) return false
    const at = text.indexOf(n)
    return at >= 0 && !/\w/.test(text[at - 1] ?? '') && !/\w/.test(text[at + n.length] ?? '')
  })
}

const CHECKS: Record<string, Check> = {
  // /test: the idea under test is `testing` once its tasks are made (test-01).
  test: (c) => {
    const made = madeOf(c.cs)
    const ideas = new Set(c.after.tasks.filter((t) => made.has(t.id) && t.cardId).map((t) => t.cardId!))
    return c.after.cards
      .filter((card) => ideas.has(card.id) && card.type === 'idea' && card.validation !== 'testing' && (c.before.cards.find((x) => x.id === card.id)?.validation ?? 'hypothesis') === 'hypothesis')
      .map((card) => ({
        model: `the idea ${cardName(c, card)} gets test tasks but is still ${card.validation ?? 'without a status'}: the guide sets it to testing (update_card validation: testing)`,
        person: `the idea ${q(card.title)} gets test tasks, but its status is ${card.validation ?? 'not set'}, not testing`,
      }))
  },

  // /import: the customer the ask names is the `for` of every card made for it (import-01).
  import: (c) => {
    const made = madeOf(c.cs)
    const customers = named(c, c.before.cards.filter((x) => x.type === 'customer'))
    const fresh = c.after.cards.filter((x) => made.has(x.id) && x.type !== 'customer')
    const out: Warning[] = []
    for (const who of customers) {
      const missing = fresh.filter((x) => !c.after.edges.some((e) => e.kind === FOR && e.fromId === x.id && e.toId === who.id))
      if (missing.length && fresh.length)
        out.push({
          model: `the ask names the customer ${cardName(c, who)}, but ${missing.length} of the ${fresh.length} new cards have no for link to it (${missing.slice(0, 5).map((x) => cardName(c, x)).join(', ')}${missing.length > 5 ? ', …' : ''}): link each (link kind: for), or say why one isn't theirs`,
          person: `${missing.length} of the ${fresh.length} new cards are not marked for the customer ${q(who.title)}: ${names(missing)}`,
        })
    }
    return out
  },

  // /prioritize: a deck it makes or changes has effort across and impact down, and every feature asked about has both
  // (prioritize-01/03): the features on the planes the ask names, else those the priorities deck holds.
  prioritize: (c) => {
    const touched = new Set([...madeOf(c.cs), ...c.cs.items.flatMap((i) => i.ids)])
    const out: Warning[] = []
    const deckName = (p: { id: string; name?: string }) => `${c.ids.short('piece', p.id)} ${q(p.name)}`
    for (const p of c.after.pieces.filter((x) => x.kind === 'kanban' && x.kanban?.holds === 'cards' && touched.has(x.id))) {
      const col = p.kanban!.colField ?? 'status'
      const row = rowFieldOf(p.kanban)
      const axes = [col, row]
      if (!axes.includes('impact') && !axes.includes('effort')) continue
      if (col === 'impact' && row === 'effort') out.push({ model: `the deck ${deckName(p)} has impact across and effort down: the priorities deck is effort across (colField effort), impact down (rowField impact)`, person: `the deck ${q(p.name)} has impact across and effort down, the other way round from a priorities deck` })
      else if (!isPriorities(p.kanban)) out.push({ model: `the deck ${deckName(p)} doesn't have both axes: effort across (colField effort) and impact down (rowField impact)`, person: `the deck ${q(p.name)} doesn't have effort across and impact down` })
    }
    const planes = namedPlanes(c)
    const deck = c.after.pieces.find((x) => x.kind === 'kanban' && isPriorities(x.kanban))
    const asked = planes.length
      ? c.after.cards.filter((x) => x.type === 'feature' && planes.some((pl) => isOnPlane(x, pl.id)))
      : deck
        ? heldCards(deck, c.after.cards).filter((x) => x.type === 'feature')
        : []
    const where = planes.length ? planes.map(deckName).join(', ') : deck ? deckName(deck) : ''
    const whereNamed = planes.length ? planes.map((pl) => q(pl.name)).join(', ') : deck ? q(deck.name) : ''
    const lacking = asked.filter((x) => !x.impact || !x.effort)
    const lack = `${lacking.length} feature${lacking.length === 1 ? '' : 's'} on`
    const lacks = `still lack${lacking.length === 1 ? 's' : ''} impact or effort`
    if (lacking.length)
      out.push({
        model: `${lack} ${where} ${lacks} (${lacking.slice(0, 5).map((x) => `${cardName(c, x)}${!x.impact ? ' no impact' : ''}${!x.effort ? ' no effort' : ''}`).join(', ')}${lacking.length > 5 ? ', …' : ''}): estimate each from what its card says, or say why not`,
        person: `${lack} ${whereNamed} ${lacks}: ${names(lacking)}`,
      })
    return out
  },

  // /compare: the matrix's rows and columns are what the ask named (compare-01/02).
  compare: (c) => {
    const made = madeOf(c.cs)
    const out: Warning[] = []
    const planes = namedPlanes(c)
    const rivals = named(c, c.before.cards.filter((x) => x.type === 'competitor'))
    for (const p of c.after.pieces.filter((x) => x.kind === 'matrix' && made.has(x.id) && x.matrix)) {
      const m = p.matrix!
      const name = `${c.ids.short('piece', p.id)} ${q(p.name)}`
      const featurePlanes = planes.filter((pl) => c.after.cards.some((x) => x.type === 'feature' && isOnPlane(x, pl.id)))
      if (featurePlanes.length && m.rows.type === 'feature' && !m.rows.plane)
        out.push({ model: `the matrix ${name} takes every feature, but the ask names ${featurePlanes.map((pl) => `${c.ids.short('piece', pl.id)} ${q(pl.name)}`).join(', ')}: set rows.plane to it`, person: `the matrix ${q(p.name)} takes every feature, not only those on ${featurePlanes.map((pl) => q(pl.name)).join(', ')}` })
      if (rivals.length) {
        const shown = new Set(m.cols.items.map((i) => i.cardId).filter(Boolean))
        const left = rivals.filter((r) => !shown.has(r.id))
        if (m.cols.type === 'competitor' && !m.cols.items.length) out.push({ model: `the matrix ${name} takes every competitor, but the ask names ${rivals.map((r) => cardName(c, r)).join(', ')}: put those in cols.items (and no type), so only they are columns`, person: `the matrix ${q(p.name)} takes every competitor, not only ${names(rivals)}` })
        else if (left.length && m.cols.type !== 'competitor') out.push({ model: `the matrix ${name} leaves out ${left.map((r) => cardName(c, r)).join(', ')}, which the ask names: add them to cols.items`, person: `the matrix ${q(p.name)} leaves out ${names(left)}, which the ask names` })
      }
    }
    return out
  },
  // /research (D-360 step 2): the findings written up as a document, its facts linked to the pages.
  research: (c) => {
    const made = madeOf(c.cs)
    const docs = c.after.documents.filter((d) => made.has(d.id))
    if (!docs.length) return [{ model: 'the research is not written up: create_document "Research: <topic>" with the findings, each fact linked', person: 'the research has no document' }]
    const out: Warning[] = []
    for (const d of docs) {
      const text = c.after.bodies?.[d.id]?.text ?? ''
      if (!/\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)/.test(text)) out.push({ model: `the document ${q(d.title)} links no web page: put each fact's page after it as [title](url), from the findings`, person: `the document ${q(d.title)} names no sources` })
    }
    return out
  },
}

export const hasChecks = (name: string) => name in CHECKS

// What a skill's checks find in the proposal; a check that throws finds nothing (it never stops a turn).
export function skillChecks(name: string, c: CheckCtx): Warning[] {
  const check = CHECKS[name]
  if (!check || !c.cs.items.length) return []
  try {
    return check(c)
  } catch {
    return []
  }
}
