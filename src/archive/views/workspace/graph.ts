// Who links to whom, for the views the app draws itself (Table, Flow).
import { useEffect, useMemo } from 'react'
import type { WithId } from '../../data/hooks'
import { FOR, type Edge } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { BOARD_KINDS, type BoardItem } from '../canvas/boardKinds'
import { linkStyle } from '../canvas/linkKinds'

// Each node → every node it shares an edge with, any kind, either direction.
// `alias` stands one id in for another (e.g. a competitor for each of its features).
export function useNeighbours(edges: WithId<Edge>[], alias?: Map<string, string>): Map<string, Set<string>> {
  return useMemo(() => {
    const map = new Map<string, Set<string>>()
    const add = (a: string, b: string) => map.set(a, (map.get(a) ?? new Set()).add(b))
    for (const e of edges) {
      const from = alias?.get(e.fromId) ?? e.fromId
      const to = alias?.get(e.toId) ?? e.toId
      if (from === to) continue
      add(from, to)
      add(to, from)
    }
    return map
  }, [edges, alias])
}

// "solves: builds take 40 min · 2 ideas · 1 competitor": outgoing links by kind with names, incoming ones counted by type.
export function linkSummary(item: BoardItem, edges: WithId<Edge>[], byId: Map<string, BoardItem>, extra?: string): string {
  const out = new Map<string, string[]>()
  const incoming = new Map<string, number>()
  for (const e of edges) {
    if (e.fromId === item.id && e.kind !== FOR) {
      const other = byId.get(e.toId)
      if (!other) continue
      const kind = linkStyle(e.kind).label
      out.set(kind, [...(out.get(kind) ?? []), other.title || 'Untitled'])
    } else if (e.toId === item.id) {
      const other = byId.get(e.fromId)
      if (other) incoming.set(other.type, (incoming.get(other.type) ?? 0) + 1)
    }
  }
  const parts = [
    ...(extra ? [extra] : []),
    ...[...out].map(([kind, names]) => `${kind}: ${names.join(', ')}`),
    ...[...incoming].map(([type, n]) => `${n} ${n === 1 ? BOARD_KINDS[type as BoardItem['type']].label : BOARD_KINDS[type as BoardItem['type']].plural}`),
  ]
  return parts.join(' · ')
}

// Views without the board still select items into the shared side panel: Escape or leaving clears it.
export function useSelectionScope() {
  const select = useCanvas((s) => s.select)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      select(null)
    }
  }, [select])
}
