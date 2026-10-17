// What differs between the item types on the board (D-040). Everything else is shared.
import { useMemo } from 'react'
import type { WithId } from '../../data/hooks'
import { FOR, type BoardType, type Edge, type EdgeKind } from '../../data/model'
import { useWsView } from '../../state/workspaceView'
import type { Palette } from '../../styles/tokens'
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
  // Bottom line of the card: who it's for, plus type-specific facts.
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
  const { customers, problems, ideas, competitors, features, competitorFeatures, edges } = useWs()
  return useMemo(() => {
    const tags = forTags(edges)
    const names = new Map(customers.map((c) => [c.id, c.title || 'Untitled']))
    const labels = (id: string) => (tags.get(id) ?? []).map((c) => `[${names.get(c) ?? '?'}]`).join(' ')
    const line = (...parts: (string | undefined)[]) => parts.filter(Boolean).join('   ')
    const counts = new Map<string, number>()
    for (const f of competitorFeatures) counts.set(f.competitorId, (counts.get(f.competitorId) ?? 0) + 1)

    const items: BoardItem[] = []
    for (const c of customers) {
      const tagged = edges.filter((e) => e.kind === FOR && e.toId === c.id).length
      items.push({ ...c, type: 'customer', tags: c.tags ?? [], forIds: [], meta: tagged ? `${tagged} tagged for them` : '' })
    }
    for (const p of problems) items.push({ ...p, type: 'problem', tags: p.tags ?? [], forIds: tags.get(p.id) ?? [], meta: labels(p.id) })
    for (const i of ideas) items.push({ ...i, type: 'idea', tags: i.tags ?? [], forIds: tags.get(i.id) ?? [], meta: labels(i.id) })
    for (const c of competitors) {
      const n = counts.get(c.id) ?? 0
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
        meta: line(labels(c.id), `${n} feature${n === 1 ? '' : 's'}`),
      })
    }
    for (const f of features) {
      const fields = [f.priority, f.status, f.effort].filter(Boolean).join(' · ')
      items.push({ ...f, type: 'feature', tags: f.tags ?? [], forIds: tags.get(f.id) ?? [], meta: line(fields, labels(f.id)) })
    }
    return items
  }, [customers, problems, ideas, competitors, features, competitorFeatures, edges])
}

// What the filters let through (customer cards stay visible under a `for:` filter).
export function useVisibleItems(items: BoardItem[]): BoardItem[] {
  const types = useWsView((s) => s.types)
  const forIds = useWsView((s) => s.forIds)
  const tagFilter = useWsView((s) => s.tags)
  return useMemo(
    () =>
      items.filter(
        (i) =>
          types.includes(i.type) &&
          (forIds.length === 0 || i.type === 'customer' || i.forIds.some((f) => forIds.includes(f))) &&
          (tagFilter.length === 0 || i.tags.some((t) => tagFilter.includes(t))),
      ),
    [items, types, forIds, tagFilter],
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
}

const TYPE_KEY = { customer: 'green', problem: 'magenta', competitor: 'yellow', idea: 'fg', feature: 'cyan' } as const

// The same accent as a hex for WebGL, from the current theme's palette (usePalette()).
export function typeAccent(type: BoardType, palette: Palette): string {
  return palette[TYPE_KEY[type]]
}
