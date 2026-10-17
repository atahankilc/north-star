// /w/:wid: the main view (D-040). Every item type on one board, plus text written on it (D-050), filtered by the filter bar.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { WithId } from '../../data/hooks'
import { createLabel } from '../../data/labels'
import { BOARD_TYPES, type Label } from '../../data/model'
import { createBoardNode, moveNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { useWsView, type NewThing } from '../../state/workspaceView'
import { DecodeText } from '../../ui/DecodeText'
import { Menu } from '../../ui/Menu'
import { useWs } from '../workspace/context'
import { FilterBar } from '../workspace/FilterBar'
import { Board } from './Board'
import { BOARD_KINDS, TYPE_ACCENT, useBoardItems, useVisibleItems } from './boardKinds'
import { findFreeSpot } from './cardLayout'
import { DetailPanel } from './DetailPanel'
import styles from './BoardView.module.css'

// A jump lands with the label near the top of the view, so the area under it is in sight.
const LAND_BELOW = 2.5

export function BoardView() {
  const { wid, edges, competitors, competitorFeatures, labels } = useWs()
  const all = useBoardItems()
  const nodes = useVisibleItems(all)
  const select = useCanvas((s) => s.select)
  const [params, setParams] = useSearchParams()

  // `?n=<id>` (from a link in another view) selects that card, unhides it, and starts the camera on it.
  const [focus] = useState(() => {
    const n = all.find((c) => c.id === params.get('n'))
    return n ? ([n.x, n.y] as [number, number]) : undefined
  })
  useEffect(() => {
    const id = params.get('n')
    if (!id) return
    const n = all.find((c) => c.id === id)
    if (n) {
      useWsView.getState().reveal(n)
      select(id)
      useCanvas.getState().focusOn([n.x, n.y])
    }
    // Keep `?f=` (a competitor feature to open in the panel).
    setParams(
      (p) => {
        p.delete('n')
        return p
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // Dev-only handle for automation: the board's items with their ids.
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __boardItems: typeof all }).__boardItems = all
  }, [all])

  // Competitors made before the board (D-040) have no position yet: give each a free spot once.
  const placed = useRef(new Set<string>())
  useEffect(() => {
    const taken = all.filter((i) => i.type !== 'competitor' || competitors.find((c) => c.id === i.id)?.x !== undefined)
    for (const c of competitors) {
      if (c.x !== undefined || placed.current.has(c.id)) continue
      placed.current.add(c.id)
      const [x, y] = findFreeSpot([0, -4], taken)
      taken.push({ ...all.find((i) => i.id === c.id)!, x, y })
      void moveNode(wid, 'competitor', c.id, x, y)
    }
  }, [all, competitors, wid])

  // The jump list (D-050), in reading order: top to bottom, then left to right.
  const places = useMemo(() => labels.filter((l) => l.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x), [labels])
  const jump = (l: WithId<Label>) => useCanvas.getState().flyTo([l.x, l.y - LAND_BELOW])

  // Escape deselects; 1–9 jump to the places in the list; leaving the board clears selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, dialog') || t.isContentEditable) return
      if (e.key === 'Escape') select(null)
      if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const place = places[Number(e.key) - 1]
        if (place) jump(place)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select, places])
  useEffect(() => () => select(null), [select])

  const create = async (type: NewThing, at: [number, number]) => {
    if (type === 'text') {
      const id = await createLabel(wid, { text: '', x: at[0], y: at[1] })
      select(id)
      useCanvas.getState().setEditingLabel(id)
      return
    }
    const id = await createBoardNode(wid, type, { x: at[0], y: at[1] })
    const { types, toggleType } = useWsView.getState()
    if (!types.includes(type)) toggleType(type)
    select(id)
  }

  const add = (type: NewThing) => {
    const center = useCanvas.getState().viewCenter()
    // Clear of every card, including filtered-out ones.
    void create(type, findFreeSpot(center, all))
  }

  return (
    <main className={styles.page}>
      <Board wid={wid} nodes={nodes} edges={edges} labels={labels} competitorFeatures={competitorFeatures} focus={focus} />

      <FilterBar goTo={places.map((l) => ({ key: l.id, label: l.text.trim(), onSelect: () => jump(l) }))} />

      {/* One create button for everything (D-053). */}
      <footer className={styles.tools}>
        <Menu
          primary
          up
          label="+"
          ariaLabel="Create"
          items={[
            { key: 'cards', heading: 'card' },
            ...BOARD_TYPES.map((t) => ({
              key: t,
              label: BOARD_KINDS[t].label,
              // The card's left border, in its type colour (D-055).
              glyph: '▌',
              tone: TYPE_ACCENT[t],
              onSelect: () => add(t),
            })),
            { key: 'board', heading: 'on the board' },
            { key: 'text', label: 'text', glyph: 'T', hint: 'jump point', onSelect: () => add('text') },
          ]}
        />
        <span className={styles.hints}>
          drag: move · shift+drag: link · scroll: zoom
          {places.length > 0 && ' · 1–9: go to'}
        </span>
      </footer>

      {all.length === 0 && labels.length === 0 && (
        <div className={styles.empty}>
          <DecodeText text="Add your first card with the + button" />
        </div>
      )}
      {all.length > 0 && nodes.length === 0 && labels.length === 0 && (
        <div className={styles.empty}>
          <DecodeText text="Nothing here with these filters" />
        </div>
      )}

      <DetailPanel items={all} />
    </main>
  )
}
