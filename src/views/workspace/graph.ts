// Who links to whom, for the views the app draws itself (Table, Flow).
import { useEffect, useMemo } from 'react'
import type { WithId } from '../../data/hooks'
import { FOR, type Edge } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { BOARD_KINDS, type BoardItem } from '../canvas/boardKinds'

// Each node → every node it shares an edge with, any kind, either direction.
export function useNeighbours(edges: WithId<Edge>[]): Map<string, Set<string>> {
  return useMemo(() => {
    const map = new Map<string, Set<string>>()
    const add = (a: string, b: string) => map.set(a, (map.get(a) ?? new Set()).add(b))
    for (const e of edges) {
      add(e.fromId, e.toId)
      add(e.toId, e.fromId)
    }
    return map
  }, [edges])
}

const SHORT_KIND: Record<string, string> = { 'competes-with': 'competes', 'inspired-by': 'inspired by', 'depends-on': 'depends on', 'part-of': 'part of' }

// "solves: builds take 40 min · 2 ideas · 1 competitor": outgoing links by kind with names, incoming ones counted by type.
export function linkSummary(item: BoardItem, edges: WithId<Edge>[], byId: Map<string, BoardItem>, extra?: string): string {
  const out = new Map<string, string[]>()
  const incoming = new Map<string, number>()
  for (const e of edges) {
    if (e.fromId === item.id && e.kind !== FOR) {
      const other = byId.get(e.toId)
      if (!other) continue
      const kind = SHORT_KIND[e.kind] ?? e.kind
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
