// The board on a plane (D-139): which plane is open, and the workspace as that plane shows it. Cards keep their docs; on a
// plane other than All only the placed ones show, at their placements, with that plane's text and sections.
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { WithId } from '../../data/hooks'
import { FOR, type Placement } from '../../data/model'
import { ALL } from '../../data/planes'
import { usePlaneView } from '../../state/plane'
import { useWsView } from '../../state/workspaceView'
import type { WorkspaceCtx } from '../workspace/context'
import { CARD_W, findFreeSpot } from './cardLayout'
import type { BoardItem } from './boardKinds'

// `?plane=<id>`, else the plane last open in this workspace (D-143), if it exists; else All. The focus view (D-127) is
// always on All. Whatever opens is remembered, and the other views filter by it.
export function useOpenPlane(ws: WorkspaceCtx, focusMode: boolean): string {
  const [params] = useSearchParams()
  const stored = useWsView((s) => s.plane)
  const asked = params.get('plane') ?? stored
  const plane = !focusMode && asked && ws.planes.some((p) => p.id === asked) ? asked : ALL
  useEffect(() => {
    usePlaneView.setState({ plane })
    if (!focusMode) useWsView.getState().setPlane(plane)
  }, [plane, focusMode])
  // Leaving the board: moves and new things anywhere else go to All.
  useEffect(() => () => usePlaneView.setState({ plane: ALL }), [])
  return plane
}

// Where each card sits on a plane, by card id.
export function placesOn(placements: WithId<Placement>[], plane: string) {
  return new Map(placements.filter((p) => p.planeId === plane).map((p) => [p.itemId, p]))
}

// The board's cards on a plane: only the placed ones, at their placements. Their meta line starts with how many planes
// they're on (`on 3 planes`) and, off All, how many of their links lead to cards not on this plane (`+4 off-plane`).
export function usePlaneItems(all: BoardItem[], ws: WorkspaceCtx, plane: string): BoardItem[] {
  return useMemo(() => {
    const planes = new Map<string, number>()
    for (const p of ws.placements) planes.set(p.itemId, (planes.get(p.itemId) ?? 1) + 1)
    const at = plane === ALL ? null : placesOn(ws.placements, plane)
    const off = new Map<string, number>()
    if (at) {
      // A competitor's feature counts as its competitor (it sits behind it, D-058).
      const owner = new Map(ws.competitorFeatures.map((f) => [f.id, f.competitorId]))
      const end = (id: string) => owner.get(id) ?? id
      for (const e of ws.edges) {
        const [a, b] = [end(e.fromId), end(e.toId)]
        if (e.kind === FOR || a === b) continue
        if (at.has(a) && !at.has(b)) off.set(a, (off.get(a) ?? 0) + 1)
        if (at.has(b) && !at.has(a)) off.set(b, (off.get(b) ?? 0) + 1)
      }
    }
    const meta = (i: BoardItem) => {
      const bits = [planes.get(i.id) && `on ${planes.get(i.id)} planes`, off.get(i.id) && `+${off.get(i.id)} off-plane`, i.meta]
      return bits.filter(Boolean).join('   ')
    }
    return all.flatMap((i) => {
      if (!at) return [planes.has(i.id) ? { ...i, meta: meta(i) } : i]
      const p = at.get(i.id)
      return p ? [{ ...i, x: p.x, y: p.y, folded: p.folded, meta: meta(i) }] : []
    })
  }, [all, ws.placements, ws.edges, ws.competitorFeatures, plane])
}

// The workspace as the plane shows it, for what works from positions (copy, zoom to, the right-click menu): placed
// cards at their placements, the plane's own text. `plane.allSpots` are every card's places on All, so cards made here can
// land on All clear of the rest.
export function usePlaneWs(ws: WorkspaceCtx, plane: string): WorkspaceCtx {
  return useMemo(() => {
    const own = ws.labels.filter((l) => (l.planeId ?? ALL) === plane)
    if (plane === ALL) return { ...ws, labels: own }
    const at = placesOn(ws.placements, plane)
    const moved = <T extends { id: string; x?: number; y?: number }>(list: T[]) =>
      list.map((d) => {
        const p = at.get(d.id)
        return p ? { ...d, x: p.x, y: p.y } : d
      })
    const allSpots = [...ws.customers, ...ws.problems, ...ws.ideas, ...ws.features, ...ws.competitors].flatMap((d) =>
      d.x !== undefined && d.y !== undefined ? [{ x: d.x, y: d.y }] : [],
    )
    return {
      ...ws,
      customers: moved(ws.customers),
      problems: moved(ws.problems),
      ideas: moved(ws.ideas),
      features: moved(ws.features),
      competitors: moved(ws.competitors),
      labels: own,
      plane: { id: plane, allSpots },
    }
  }, [ws, plane])
}

// Where cards made on another plane land on All (D-139): a column just right of everything there, top first.
export function allSpot(spots: { x: number; y: number }[]): [number, number] {
  if (!spots.length) return [0, 0]
  const right = Math.max(...spots.map((s) => s.x)) + CARD_W + 1
  return findFreeSpot([right, Math.max(...spots.map((s) => s.y))], spots)
}

// The workspace laid out as a plane has it (D-139), for planning a layout there (the assistant, D-142): only the cards
// placed on it, at their places there; its own text and sections. Edges, criteria and the rest stay whole. All: as is.
export function layoutWs(ws: WorkspaceCtx, plane: string): WorkspaceCtx {
  if (plane === ALL) return { ...ws, labels: ws.labels.filter((l) => !l.planeId) }
  const at = placesOn(ws.placements, plane)
  const on = <T extends { id: string; x?: number; y?: number }>(list: T[]) =>
    list.flatMap((d) => {
      const p = at.get(d.id)
      return p ? [{ ...d, x: p.x, y: p.y }] : []
    })
  return {
    ...ws,
    customers: on(ws.customers),
    problems: on(ws.problems),
    ideas: on(ws.ideas),
    features: on(ws.features),
    competitors: on(ws.competitors),
    packages: on(ws.packages),
    labels: ws.labels.filter((l) => l.planeId === plane),
  }
}

// Every card's place on All, so cards made on another plane land clear of them there.
export const allSpotsOf = (ws: WorkspaceCtx) =>
  [...ws.customers, ...ws.problems, ...ws.ideas, ...ws.features, ...ws.competitors, ...ws.packages].flatMap((d) =>
    d.x !== undefined && d.y !== undefined ? [{ x: d.x, y: d.y }] : [],
  )

// The cards a plane shows (D-143): those placed on it and the packages at home there; null for All (every card).
export function planeIds(ws: Pick<WorkspaceCtx, 'placements' | 'packages'>, plane: string): Set<string> | null {
  if (plane === ALL) return null
  return new Set([...ws.placements.filter((p) => p.planeId === plane).map((p) => p.itemId), ...ws.packages.filter((k) => k.homePlaneId === plane).map((k) => k.id)])
}

// The plane the views filter by (D-143): the remembered one if it still exists, else All.
export function useViewPlane(ws: Pick<WorkspaceCtx, 'planes'>): string {
  const plane = useWsView((s) => s.plane)
  return ws.planes.some((p) => p.id === plane) ? plane : ALL
}
