// What differs between the item types on the board (D-040). Everything else is shared.
import { useMemo } from 'react'
import type { WithId } from '../../data/hooks'
import { mismatch, tally } from '../../data/evidence'
import { BOARD_TYPES, FOR, type BoardType, type Edge, type EdgeKind, type Evidence, type Validation } from '../../data/model'
import { useWsView } from '../../state/workspaceView'
import type { Palette } from '../../styles/tokens'
import { planeIds, useViewPlane } from './planes'
import { inRegions, regionText } from '../competitors/regions'
import { useWs } from '../workspace/context'

type Kind = {
  label: string
  plural: string
  addLabel: string
  placeholder: string
}

export const BOARD_KINDS: Record<BoardType, Kind> = {
  customer: {
    label: 'customer',
    plural: 'customers',
    addLabel: '+ Customer',
    placeholder: 'Who are they? What do they do all day?',
  },
  problem: {
    label: 'problem',
    plural: 'problems',
    addLabel: '+ Problem',
    placeholder: 'What hurts, how often, and what does it cost them?',
  },
  competitor: {
    label: 'competitor',
    plural: 'competitors',
    addLabel: '+ Competitor',
    placeholder: '',
  },
  idea: {
    label: 'idea',
    plural: 'ideas',
    addLabel: '+ Idea',
    placeholder: "What's the thought?",
  },
  feature: {
    label: 'feature',
    plural: 'features',
    addLabel: '+ Feature',
    placeholder: 'What does it do, and for whom?',
  },
  // A piece of the chain as one card (D-141); made from a selection, not from +.
  package: {
    label: 'package',
    plural: 'packages',
    addLabel: '',
    placeholder: 'What this piece delivers, and what it bets on.',
  },
}

// Everything the board needs to draw one card, whatever its type.
export type BoardItem = {
  id: string
  type: BoardType
  title: string
  body?: string
  // The user's own grouping within a type (D-056), shown as #chips.
  tags: string[]
  x: number
  y: number
  createdAt: number
  // Customers this item is `for` (D-044).
  forIds: string[]
  // Competitors only: where they operate (D-145).
  regions?: string[]
  // The card's header, right of its type (D-152): a status, a competitor's regions, a feature's priority, a package's
  // rating.
  head?: string
  // Evidence on a customer, problem or idea (D-137), drawn as cells beside the head; `clash` when it and the status
  // disagree.
  proof?: { supports: number; contradicts: number; clash: boolean }
  // The card's facts line: who it's for, plus type-specific facts.
  meta: string
}

// Each item → the customers it's tagged for.
export function forTags(edges: WithId<Edge>[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const e of edges) {
    if (e.kind !== FOR || e.toType !== 'customer') continue
    map.set(e.fromId, [...(map.get(e.fromId) ?? []), e.toId])
  }
  return map
}

// Default link kind when you shift+drag one card onto another; changeable in the panel.
export function defaultKind(from: BoardType, to: BoardType): EdgeKind {
  if (to === 'customer' && from !== 'customer') return FOR
  if (from === 'idea' && to === 'problem') return 'solves'
  if (from === 'competitor' && (to === 'problem' || to === 'idea')) return 'competes-with'
  if (from === 'feature' && to === 'idea') return 'inspired-by'
  return 'relates'
}

// Every board item in the workspace (unfiltered). Competitors without a position yet sit at the origin
// until the board places them.
export function useBoardItems(): BoardItem[] {
  const { customers, problems, ideas, competitors, features, competitorFeatures, edges, attachments, evidence, packages } = useWs()
  return useMemo(() => {
    const tags = forTags(edges)
    const names = new Map(customers.map((c) => [c.id, c.title || 'Untitled']))
    const labels = (id: string) => (tags.get(id) ?? []).map((c) => `[${names.get(c) ?? '?'}]`).join(' ')
    const line = (...parts: (string | undefined)[]) => parts.filter(Boolean).join('   ')
    const counts = new Map<string, number>()
    for (const f of competitorFeatures) counts.set(f.competitorId, (counts.get(f.competitorId) ?? 0) + 1)
    // What a competitor competes with (D-135): its lines are hidden by default, so the card says how many there are
    // (`vs 8`; the board's mono font is a Latin subset, no ⚔).
    const rivals = new Map<string, Set<string>>()
    for (const e of edges) {
      if (e.kind !== 'competes-with') continue
      for (const [c, other] of [[e.fromId, e.toId], [e.toId, e.fromId]]) {
        if (!rivals.has(c)) rivals.set(c, new Set())
        rivals.get(c)!.add(other)
      }
    }
    // Attachments (D-083): a count at the end of the card's meta line.
    const fileCounts = new Map<string, number>()
    for (const a of attachments) fileCounts.set(a.nodeId, (fileCounts.get(a.nodeId) ?? 0) + 1)
    const files = (id: string) => {
      const n = fileCounts.get(id)
      return n ? `${n} file${n === 1 ? '' : 's'}` : undefined
    }

    // Status and its evidence (D-137): the status in the head, `!` when the evidence doesn't back it, and the evidence as
    // cells beside it (D-152).
    const learned = new Map<string, Evidence[]>()
    for (const e of evidence) learned.set(e.nodeId, [...(learned.get(e.nodeId) ?? []), e])
    const status = (n: { id: string; validation?: Validation }) => {
      const list = learned.get(n.id) ?? []
      const t = tally(list)
      const clash = !!n.validation && !!mismatch(n.validation, list)
      return {
        head: n.validation ? `${n.validation}${clash ? ' !' : ''}` : undefined,
        proof: list.length ? { supports: t.supports, contradicts: t.contradicts, clash } : undefined,
      }
    }
    // How many links of a kind leave or reach a card, and how many cards of a type it's linked to at all (D-152).
    const count = (id: string, kind: string, dir: 'from' | 'to') => edges.filter((e) => e.kind === kind && (dir === 'from' ? e.fromId : e.toId) === id).length
    const linkedTo = (id: string, other: BoardType) =>
      edges.filter((e) => e.kind !== FOR && ((e.fromId === id && e.toType === other) || (e.toId === id && e.fromType === other))).length
    const n = (k: number, one: string) => (k ? `${k} ${one}${k === 1 ? '' : 's'}` : undefined)

    const items: BoardItem[] = []
    for (const c of customers) {
      const tagged = edges.filter((e) => e.kind === FOR && e.toId === c.id).length
      items.push({ ...c, type: 'customer', tags: c.tags ?? [], forIds: [], ...status(c), meta: line(tagged ? `${tagged} tagged for them` : '', files(c.id)) })
    }
    for (const p of problems) {
      const solved = count(p.id, 'solves', 'to')
      const rivals = count(p.id, 'competes-with', 'to') + count(p.id, 'competes-with', 'from')
      const facts = [solved ? `${solved} solve it` : undefined, rivals ? `vs ${rivals}` : undefined].filter(Boolean).join(' · ')
      items.push({ ...p, type: 'problem', tags: p.tags ?? [], forIds: tags.get(p.id) ?? [], ...status(p), meta: line(facts, labels(p.id), files(p.id)) })
    }
    for (const i of ideas) {
      const solves = count(i.id, 'solves', 'from')
      const facts = [solves ? `solves ${solves}` : undefined, n(linkedTo(i.id, 'feature'), 'feature')].filter(Boolean).join(' · ')
      items.push({ ...i, type: 'idea', tags: i.tags ?? [], forIds: tags.get(i.id) ?? [], ...status(i), meta: line(facts, labels(i.id), files(i.id)) })
    }
    for (const c of competitors) {
      const k = counts.get(c.id) ?? 0
      items.push({
        id: c.id,
        type: 'competitor',
        title: c.name,
        body: c.url,
        tags: c.tags ?? [],
        x: c.x ?? 0,
        y: c.y ?? 0,
        createdAt: c.createdAt,
        forIds: tags.get(c.id) ?? [],
        regions: c.regions,
        // Where it operates heads the card (D-145, D-152): `US · Germany +1`; then `vs 3 · 4 features`.
        head: regionText(c.regions) || undefined,
        meta: line([rivals.get(c.id)?.size ? `vs ${rivals.get(c.id)!.size}` : undefined, `${k} feature${k === 1 ? '' : 's'}`].filter(Boolean).join(' · '), labels(c.id), files(c.id)),
      })
    }
    for (const f of features) {
      const fields = [f.status, f.impact && `impact ${f.impact}`, f.effort && `effort ${f.effort}`].filter(Boolean).join(' · ')
      items.push({ ...f, type: 'feature', tags: f.tags ?? [], forIds: tags.get(f.id) ?? [], head: f.priority, meta: line(fields, labels(f.id), files(f.id)) })
    }
    // Packages (D-141): what they hold, by type (`1 problem · 1 idea · 3 features`), and their rating.
    const typeOf = new Map(items.map((i) => [i.id, i.type]))
    for (const k of packages) {
      const held = new Map<BoardType, number>()
      for (const id of k.memberIds) {
        const t = typeOf.get(id)
        if (t) held.set(t, (held.get(t) ?? 0) + 1)
      }
      const holds = BOARD_TYPES.flatMap((t) => (held.get(t) ? [`${held.get(t)} ${held.get(t) === 1 ? BOARD_KINDS[t].label : BOARD_KINDS[t].plural}`] : [])).join(' · ')
      const rating = [k.impact && `impact ${k.impact}`, k.effort].filter(Boolean).join(' · ')
      items.push({ ...k, type: 'package', tags: k.tags ?? [], forIds: [], head: rating || undefined, meta: line(holds || 'empty', files(k.id)) })
    }
    return items
  }, [customers, problems, ideas, competitors, features, competitorFeatures, edges, attachments, evidence, packages])
}

// What the filters let through; under a `for:` filter only the chosen customers' cards stay (D-119); with a plane
// filter, only the cards on that plane (D-143; `byPlane` false for the focus view, which is always on All).
export function useVisibleItems(items: BoardItem[], byPlane = true): BoardItem[] {
  const types = useWsView((s) => s.types)
  const forIds = useWsView((s) => s.forIds)
  const tagFilter = useWsView((s) => s.tags)
  const regionFilter = useWsView((s) => s.regions)
  const ws = useWs()
  const plane = useViewPlane(ws)
  const on = useMemo(() => (byPlane ? planeIds(ws, plane) : null), [byPlane, ws, plane])
  return useMemo(
    () =>
      items.filter(
        (i) =>
          (!on || on.has(i.id)) &&
          types.includes(i.type) &&
          (forIds.length === 0 || (i.type === 'customer' ? forIds.includes(i.id) : i.forIds.some((f) => forIds.includes(f)))) &&
          (tagFilter.length === 0 || i.tags.some((t) => tagFilter.includes(t))) &&
          // The region filter narrows competitors only (D-145).
          (i.type !== 'competitor' || inRegions(i.regions, regionFilter)),
      ),
    [items, types, forIds, tagFilter, regionFilter, on],
  )
}

// Every tag in use, most used first (D-056).
export function useAllTags(items: BoardItem[]): { tag: string; count: number }[] {
  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of items) for (const t of i.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }, [items])
}

// Accent per type, as CSS for the DOM (follows the theme by itself, D-069).
export const TYPE_ACCENT: Record<BoardType, string> = {
  customer: 'var(--accent-green)',
  problem: 'var(--accent-magenta)',
  competitor: 'var(--accent-yellow)',
  idea: 'var(--fg)',
  feature: 'var(--accent-cyan)',
  package: 'var(--accent-blue)',
}

const TYPE_KEY = { customer: 'green', problem: 'magenta', competitor: 'yellow', idea: 'fg', feature: 'cyan', package: 'blue' } as const

// The same accent as a hex for WebGL, from the current theme's palette (usePalette()).
export function typeAccent(type: BoardType, palette: Palette): string {
  return palette[TYPE_KEY[type]]
}
