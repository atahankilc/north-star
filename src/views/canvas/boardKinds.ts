// What differs between the item types on the board (D-040). Everything else is shared.
import { useMemo } from 'react'
import type { WithId } from '../../data/hooks'
import { FOR, type BoardType, type Edge, type EdgeKind, type Feature } from '../../data/model'
import { ALL, useWsView } from '../../state/workspaceView'
import { colors } from '../../styles/tokens'
import { useWs } from '../workspace/context'

type Kind = {
  label: string
  plural: string
  addLabel: string
  placeholder: string
  // Mark before the title on the card (docs/specs/domains.md §4).
  mark: string
  // Single-domain items keep `domainId`, the rest `domainIds` (D-039).
  oneDomain: boolean
}

export const BOARD_KINDS: Record<BoardType, Kind> = {
  customer: {
    label: 'customer',
    plural: 'customers',
    addLabel: '+ Customer',
    placeholder: 'Who are they? What do they do all day?',
    mark: '@ ',
    oneDomain: false,
  },
  problem: {
    label: 'problem',
    plural: 'problems',
    addLabel: '+ Problem',
    placeholder: 'What hurts, how often, and what does it cost them?',
    mark: '! ',
    oneDomain: true,
  },
  competitor: {
    label: 'competitor',
    plural: 'competitors',
    addLabel: '+ Competitor',
    placeholder: '',
    mark: '',
    oneDomain: false,
  },
  idea: {
    label: 'idea',
    plural: 'ideas',
    addLabel: '+ Idea',
    placeholder: "What's the thought?",
    mark: '',
    oneDomain: true,
  },
  feature: {
    label: 'feature',
    plural: 'features',
    addLabel: '+ Feature',
    placeholder: 'What does it do, and for whom?',
    mark: '◆ ',
    oneDomain: false,
  },
}

// Everything the board needs to draw one card, whatever its type.
export type BoardItem = {
  id: string
  type: BoardType
  title: string
  body?: string
  color?: string
  x: number
  y: number
  createdAt: number
  domainIds: string[]
  // Customers this item is `for` (D-044).
  forIds: string[]
  // Bottom line of the card.
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

const domainsOf = (n: { domainId?: string; domainIds?: string[] }) => n.domainIds ?? (n.domainId ? [n.domainId] : [])

// Every board item in the workspace (unfiltered). Competitors without a position yet sit at the origin
// until the board places them.
export function useBoardItems(): BoardItem[] {
  const { customers, problems, ideas, competitors, features, competitorFeatures, edges } = useWs()
  return useMemo(() => {
    const tags = forTags(edges)
    const names = new Map(customers.map((c) => [c.id, c.title || 'Untitled']))
    const labels = (id: string) => (tags.get(id) ?? []).map((c) => `[${names.get(c) ?? '?'}]`).join(' ')
    const line = (...parts: (string | undefined)[]) => parts.filter(Boolean).join('   ')
    const hashtags = (t?: string[]) => (t ?? []).map((s) => `#${s}`).join('  ')
    const counts = new Map<string, number>()
    for (const f of competitorFeatures) counts.set(f.competitorId, (counts.get(f.competitorId) ?? 0) + 1)

    const items: BoardItem[] = []
    for (const c of customers) {
      const tagged = edges.filter((e) => e.kind === FOR && e.toId === c.id).length
      items.push({ ...c, type: 'customer', domainIds: domainsOf(c), forIds: [], meta: tagged ? `${tagged} tagged` : '' })
    }
    for (const p of problems) items.push({ ...p, type: 'problem', domainIds: domainsOf(p), forIds: tags.get(p.id) ?? [], meta: line(labels(p.id), hashtags(p.tags)) })
    for (const i of ideas) items.push({ ...i, type: 'idea', domainIds: domainsOf(i), forIds: tags.get(i.id) ?? [], meta: line(labels(i.id), hashtags(i.tags)) })
    for (const c of competitors) {
      const n = counts.get(c.id) ?? 0
      items.push({
        id: c.id,
        type: 'competitor',
        title: c.name,
        body: c.url,
        color: c.color,
        x: c.x ?? 0,
        y: c.y ?? 0,
        createdAt: c.createdAt,
        domainIds: domainsOf(c),
        forIds: tags.get(c.id) ?? [],
        meta: line(labels(c.id), `${n} feature${n === 1 ? '' : 's'}`),
      })
    }
    for (const f of features) {
      const fields = [f.priority, f.status, f.effort].filter(Boolean).join(' · ')
      items.push({ ...f, type: 'feature', domainIds: domainsOf(f), forIds: tags.get(f.id) ?? [], meta: line(labels(f.id), fields, hashtags((f as Feature).tags)) })
    }
    return items
  }, [customers, problems, ideas, competitors, features, competitorFeatures, edges])
}

// What the domain tab and filters let through (customer cards stay visible under a `for:` filter).
export function useVisibleItems(items: BoardItem[]): BoardItem[] {
  const { domains } = useWs()
  const domain = useWsView((s) => s.domain)
  const types = useWsView((s) => s.types)
  const forIds = useWsView((s) => s.forIds)
  return useMemo(() => {
    const inDomain = domain !== ALL && domains.some((d) => d.id === domain) ? domain : ALL
    return items.filter(
      (i) =>
        types.includes(i.type) &&
        (inDomain === ALL || i.domainIds.includes(inDomain)) &&
        (forIds.length === 0 || i.type === 'customer' || i.forIds.some((f) => forIds.includes(f))),
    )
  }, [items, domains, domain, types, forIds])
}

// Accent per type where the card has no colour of its own.
export const TYPE_ACCENT: Record<BoardType, string> = {
  customer: colors.green,
  problem: colors.magenta,
  competitor: colors.yellow,
  idea: colors.fg,
  feature: colors.cyan,
}
