// The board's planes (D-139): `PLANE │ All ▾` first in the filter bar. Lists the planes with their card counts, makes a
// new one, renames or deletes the open one. And on a plane other than All, the picker that brings existing cards in.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHistory } from '../../data/history'
import { BOARD_TYPES } from '../../data/model'
import { ALL, createPlane, deletePlane, place, renamePlane } from '../../data/planes'
import { useCanvas } from '../../state/canvasStore'
import { useWsView } from '../../state/workspaceView'
import { InlineEdit } from '../../ui/InlineEdit'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { useWs, type WorkspaceCtx } from '../workspace/context'
import { useViewPlane } from './planes'
import { UNDO_HINT } from '../workspace/useEditKeys'
import { BOARD_KINDS, TYPE_ACCENT, type BoardItem } from './boardKinds'
import { findFreeSpot } from './cardLayout'
import styles from './PlaneSwitcher.module.css'

export function PlaneSwitcher({ ws, plane, cards, locked }: { ws: WorkspaceCtx; plane: string; cards: number; locked: boolean }) {
  const [, setParams] = useSearchParams()
  const [renaming, setRenaming] = useState(false)
  const planes = [...ws.planes].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
  const open = planes.find((p) => p.id === plane)
  const counts = new Map<string, number>()
  for (const p of ws.placements) counts.set(p.planeId, (counts.get(p.planeId) ?? 0) + 1)
  const total = ws.customers.length + ws.problems.length + ws.ideas.length + ws.features.length + ws.competitors.length

  const go = (id: string) => {
    useWsView.getState().setPlane(id)
    setParams(
      (p) => {
        if (id === ALL) p.delete('plane')
        else p.set('plane', id)
        return p
      },
      { replace: false },
    )
  }

  const add = async () => {
    const order = Math.max(0, ...planes.map((p) => p.order)) + 1
    const id = await createPlane(ws.wid, `Plane ${planes.length + 1}`, order)
    go(id)
    setRenaming(true)
  }

  const remove = () => {
    if (!open) return
    void deletePlane(ws.wid, open.id)
    go(ALL)
    useHistory.getState().say(`Deleted plane "${open.name}"; its cards are still on All · ${UNDO_HINT} to undo`)
  }

  const items: MenuEntry[] = [
    { key: ALL, label: 'All', glyph: plane === ALL ? '›' : undefined, hint: `${total}`, onSelect: () => go(ALL) },
    ...planes.map((p) => ({ key: p.id, label: p.name, glyph: plane === p.id ? '›' : undefined, hint: `${counts.get(p.id) ?? 0}`, onSelect: () => go(p.id) })),
    ...(locked
      ? []
      : [
          { key: 'h', heading: 'planes' },
          { key: 'new', label: 'new plane', glyph: '+', onSelect: () => void add() },
          ...(open
            ? [
                { key: 'rename', label: `rename "${open.name}"`, glyph: '✎', onSelect: () => setRenaming(true) },
                { key: 'delete', label: `delete "${open.name}"`, glyph: '×', hint: 'cards stay', onSelect: remove },
              ]
            : []),
        ]),
  ]

  return (
    <span className={styles.switcher}>
      {open && renaming ? (
        <span className={styles.rename}>
          <span className={styles.label}>plane</span>
          <InlineEdit
            className={styles.name}
            label="Plane name"
            value={open.name}
            editing
            onEditingChange={(v) => !v && setRenaming(false)}
            onSave={(name) => (name.trim() ? renamePlane(ws.wid, open.id, name) : undefined)}
          />
        </span>
      ) : (
        <Menu label="plane" summary={open?.name ?? 'All'} active={plane !== ALL} items={items} ariaLabel={`Plane: ${open?.name ?? 'All'} (${cards} cards)`} />
      )}
    </span>
  )
}

// On a plane other than All: every card not on it yet, by type, to bring in at the view's centre (clear of the plane's
// cards).
export function ExistingCards({ wid, plane, all, here }: { wid: string; plane: string; all: BoardItem[]; here: BoardItem[] }) {
  const on = new Set(here.map((c) => c.id))
  const items: MenuEntry[] = BOARD_TYPES.flatMap((t) => {
    const off = all.filter((c) => c.type === t && !on.has(c.id)).sort((a, b) => a.title.localeCompare(b.title))
    return off.length
      ? [
          { key: `h-${t}`, heading: BOARD_KINDS[t].plural },
          ...off.map((c) => ({
            key: c.id,
            label: c.title || 'Untitled',
            glyph: '▌',
            tone: TYPE_ACCENT[t],
            onSelect: () => {
              const [x, y] = findFreeSpot(useCanvas.getState().viewCenter(), here)
              void place(wid, plane, [{ id: c.id, type: c.type, x, y }]).then(() => useCanvas.getState().select(c.id))
            },
          })),
        ]
      : []
  })
  return (
    <Menu
      up
      label="existing"
      items={items}
      ariaLabel="Bring an existing card onto this plane"
      search="find a card"
      empty="Every card is on this plane already"
    />
  )
}

// The plane filter of Flow, Table, Matrix and Priorities (D-143): only the cards on one plane. The same choice as the
// board's open plane, so moving between views keeps it.
export function PlaneFilter({ up }: { up?: boolean }) {
  const ws = useWs()
  const plane = useViewPlane(ws)
  if (!ws.planes.length) return null
  const planes = [...ws.planes].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
  const counts = new Map<string, number>()
  for (const p of ws.placements) counts.set(p.planeId, (counts.get(p.planeId) ?? 0) + 1)
  const name = planes.find((p) => p.id === plane)?.name ?? 'All'
  const set = (id: string) => useWsView.getState().setPlane(id)
  return (
    <Menu
      up={up}
      label="plane"
      summary={name}
      active={plane !== ALL}
      ariaLabel="Only the cards on one plane"
      items={[
        { key: ALL, label: 'All', checked: plane === ALL, onSelect: () => set(ALL) },
        ...planes.map((p) => ({ key: p.id, label: p.name, hint: `${counts.get(p.id) ?? 0}`, checked: plane === p.id, onSelect: () => set(p.id) })),
      ]}
    />
  )
}
