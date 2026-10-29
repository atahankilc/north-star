// What a focused plane shows (D-233; the old board's SHOW / FOR / TAG / REGION / LINKS filters, D-053, D-056, D-108,
// D-145, D-146): kept only while its focus is open (D-308), in this tab; leaving it or a reload starts it over. SHOW hides card types; FOR keeps the chosen customers and what's
// tagged for them; TAG keeps cards with one of the tags; REGION narrows competitors only (a place counts inside the
// bigger ones); LINKS hides kinds of link, `for`, `relates` and `competes` hidden to start with (D-128, D-135), a hidden
// kind still showing on the hovered or selected card.
import { useEffect } from 'react'
import { create } from 'zustand'
import type { AnyType, Card } from '../../data/cards'
import { FOR, type Edge } from '../../data/edges'
import { inRegions } from '../../data/regions'

export type LinkGroup = 'solves' | 'part' | 'competes' | 'clashes' | 'draws' | 'depends' | 'plain' | 'for'

export const LINK_GROUPS: { key: LinkGroup; label: string; kind: string }[] = [
  { key: 'solves', label: 'solves', kind: 'solves' },
  { key: 'part', label: 'part of', kind: 'part-of' },
  { key: 'competes', label: 'competes', kind: 'competes-with' },
  { key: 'clashes', label: 'contradicts', kind: 'contradicts' },
  { key: 'draws', label: 'inspired by', kind: 'inspired-by' },
  { key: 'depends', label: 'depends on', kind: 'depends-on' },
  { key: 'plain', label: 'relates', kind: 'relates' },
  { key: 'for', label: 'for', kind: FOR },
]
const GROUP_OF: Record<string, LinkGroup> = Object.fromEntries(LINK_GROUPS.map((g) => [g.kind, g.key]))
export const groupOf = (kind: string): LinkGroup => GROUP_OF[kind] ?? 'plain'

export type Filter = { hide: AnyType[]; for: string[]; tags: string[]; regions: string[]; links: LinkGroup[] }
// Links hidden to start with (D-128, D-135).
export const START: Filter = { hide: [], for: [], tags: [], regions: [], links: ['competes', 'plain', 'for'] }

type State = { byPlane: Record<string, Filter> }
export const usePlaneFilter = create<State>(() => ({ byPlane: {} }))

// Filters were once kept in the browser (D-233): what's left of them goes.
try {
  for (const k of Object.keys(localStorage)) if (k.startsWith('north-star:filter:')) localStorage.removeItem(k)
} catch {
  // Private windows: nothing kept.
}

// A plane's filter, as set in this focus.
export function useFilter(plane: string | null): Filter {
  return usePlaneFilter((s) => (plane ? s.byPlane[plane] : undefined)) ?? START
}

// The same, read outside React (fit, the box round a plane's contents).
export const filterOf = (plane: string): Filter => usePlaneFilter.getState().byPlane[plane] ?? START

export function setFilter(plane: string, next: Filter) {
  usePlaneFilter.setState((s) => ({ byPlane: { ...s.byPlane, [plane]: next } }))
}

// Held while the plane's dock is there (its focus); once nothing holds it, the filter goes (D-308). Let go a moment
// later, so a remount (dev's double mount) keeps it.
const held = new Map<string, number>()
export function useHoldFilter(plane: string) {
  useEffect(() => {
    held.set(plane, (held.get(plane) ?? 0) + 1)
    return () => {
      held.set(plane, (held.get(plane) ?? 1) - 1)
      setTimeout(() => {
        if (held.get(plane)) return
        held.delete(plane)
        usePlaneFilter.setState((s) => {
          const { [plane]: _, ...rest } = s.byPlane
          return { byPlane: rest }
        })
      })
    }
  }, [plane])
}

// How many filters narrow what's shown (the dock's count): links count once they differ from the start.
export function narrowing(f: Filter) {
  const links = f.links.length !== START.links.length || f.links.some((l) => !START.links.includes(l))
  return (f.hide.length ? 1 : 0) + (f.for.length ? 1 : 0) + (f.tags.length ? 1 : 0) + (f.regions.length ? 1 : 0) + (links ? 1 : 0)
}

// The cards the filter keeps.
export function keep(cards: Card[], edges: Edge[], f: Filter): Set<string> {
  const forOf = new Map<string, Set<string>>()
  for (const e of edges) if (e.kind === FOR) forOf.set(e.fromId, new Set([...(forOf.get(e.fromId) ?? []), e.toId]))
  const out = new Set<string>()
  for (const c of cards) {
    if (f.hide.includes(c.type)) continue
    if (f.for.length && !(c.type === 'customer' ? f.for.includes(c.id) : [...(forOf.get(c.id) ?? [])].some((id) => f.for.includes(id)))) continue
    if (f.tags.length && !(c.tags ?? []).some((t) => f.tags.includes(t))) continue
    if (f.regions.length && c.type === 'competitor' && !inRegions(c.regions, f.regions)) continue
    out.add(c.id)
  }
  return out
}
