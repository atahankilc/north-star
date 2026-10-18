// /workspaces/:wid: the main view (D-040). Every item type on one board, plus text written on it (D-050), filtered by the filter bar.
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
import { copySelection, duplicateSelection, pasteClip } from './clipboard'
import { BoardMenu } from './BoardMenu'
import { DetailPanel } from './DetailPanel'
import { useGuides } from './guides'
import { useSnap } from './snap'
import { TITLE_W, estimateTitleHalf, isTitle } from './titleBlock'
import { copied } from '../../data/selection'
import { editLocked, useViewer } from '../workspace/viewerLock'
import styles from './BoardView.module.css'

// A jump lands with the label near the top of the view, so the area under it is in sight.
const LAND_BELOW = 2.5

export function BoardView() {
  const ws = useWs()
  const { wid, edges, competitors, competitorFeatures, labels } = ws
  const viewer = useViewer((s) => s.viewer)
  const snap = useSnap((s) => s.on)
  const guides = useGuides((s) => s.on)
  const all = useBoardItems()
  const nodes = useVisibleItems(all)
  const select = useCanvas((s) => s.select)
  const [params, setParams] = useSearchParams()

  // `?item=<id>` (from a link in another view) selects that card, unhides it, and starts the camera on it.
  const [focus] = useState(() => {
    const n = all.find((c) => c.id === params.get('item'))
    return n ? ([n.x, n.y] as [number, number]) : undefined
  })
  useEffect(() => {
    const id = params.get('item')
    if (!id) return
    const n = all.find((c) => c.id === id)
    if (n) {
      useWsView.getState().reveal(n)
      select(id)
      useCanvas.getState().focusOn([n.x, n.y])
    }
    // Keep `?feature=` (a competitor feature to open in the panel).
    setParams(
      (p) => {
        p.delete('item')
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
    if (editLocked()) return
    const taken = all.filter((i) => i.type !== 'competitor' || competitors.find((c) => c.id === i.id)?.x !== undefined)
    for (const c of competitors) {
      if (c.x !== undefined || placed.current.has(c.id)) continue
      placed.current.add(c.id)
      const [x, y] = findFreeSpot([0, -4], taken)
      taken.push({ ...all.find((i) => i.id === c.id)!, x, y })
      void moveNode(wid, 'competitor', c.id, x, y)
    }
  }, [all, competitors, wid])

  // The jump list (D-050), in reading order: top to bottom, then left to right. Notes aren't places (D-116).
  // The title block (D-118) is a place too, under the workspace's name.
  const places = useMemo(
    () => labels.filter((l) => isTitle(l) || (l.text.trim() && l.size !== 'note')).sort((a, b) => b.y - a.y || a.x - b.x),
    [labels],
  )
  const jump = (l: WithId<Label>) => useCanvas.getState().flyTo(isTitle(l) ? [l.x, l.y] : [l.x, l.y - LAND_BELOW])
  const title = labels.find(isTitle)

  // Escape deselects; 0 frames the whole board; g switches snapping to the grid (D-112); 1–9 jump to the places in the list; ⌘C / ⌘V / ⌘D copy, paste, duplicate (D-108);
  // leaving the board clears selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, dialog') || t.isContentEditable) return
      if (e.key === 'Escape') select(null)
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      // Text selected on the page copies as text, as usual.
      const textSelected = !(window.getSelection()?.isCollapsed ?? true)
      if (mod && !e.shiftKey && !e.altKey && !editLocked() && !textSelected) {
        const any = useCanvas.getState().selection.length > 0
        if (key === 'c' && any) {
          e.preventDefault()
          copySelection(ws)
        } else if (key === 'v' && copied()) {
          e.preventDefault()
          void pasteClip(ws)
        } else if (key === 'd' && any) {
          e.preventDefault()
          void duplicateSelection(ws)
        }
      }
      if (e.key === '0' && !e.metaKey && !e.ctrlKey && !e.altKey) useCanvas.getState().fitAll()
      if (key === 'g' && !mod && !e.altKey && !editLocked()) useSnap.getState().toggle()
      // a switches the alignment guides (D-117).
      if (key === 'a' && !mod && !e.altKey && !editLocked()) useGuides.getState().toggle()
      if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const place = places[Number(e.key) - 1]
        if (place) jump(place)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select, places, ws])
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

  // The project's title block (D-118), one per board: over the top-left of everything on it, or mid-view on an empty board.
  const addTitle = async () => {
    const [, hh] = estimateTitleHalf(ws.workspace.name, ws.workspace.description ?? '')
    const pts = [...all, ...labels]
    const at: [number, number] = pts.length
      ? [Math.min(...pts.map((p) => p.x)) - 1.2 + TITLE_W / 2, Math.max(...pts.map((p) => p.y)) + 1.5 + hh]
      : useCanvas.getState().viewCenter()
    const id = await createLabel(wid, { text: '', kind: 'title', x: at[0], y: at[1] })
    select(id)
    useCanvas.getState().flyTo(at)
  }

  const add = (type: NewThing) => {
    const center = useCanvas.getState().viewCenter()
    // Clear of every card, including filtered-out ones.
    void create(type, findFreeSpot(center, all))
  }

  return (
    <main className={styles.page}>
      <Board wid={wid} nodes={nodes} edges={edges} labels={labels} competitorFeatures={competitorFeatures} focus={focus} />

      <FilterBar links goTo={places.map((l) => ({ key: l.id, label: isTitle(l) ? ws.workspace.name : l.text.trim(), onSelect: () => jump(l) }))} />

      {/* One create button for everything (D-053); viewers make nothing (D-098). */}
      <footer className={styles.tools} data-preview-hide>
        <span className={styles.buttons}>
          {!viewer && <Menu
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
              ...(title ? [] : [{ key: 'title', label: 'project title', glyph: '✦', hint: 'name + about', onSelect: () => void addTitle() }]),
            ]}
          />}
          {/* The whole board back in view, as when it opens (D-060). */}
          <button
            className={styles.fit}
            onClick={() => useCanvas.getState().fitAll()}
            disabled={nodes.length === 0 && labels.length === 0}
            aria-label="Fit the whole board"
            data-nav
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              <path d="M1.5 5.5v-4h4M10.5 1.5h4v4M14.5 10.5v4h-4M5.5 14.5h-4v-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="5.5" y="5.5" width="5" height="5" fill="currentColor" />
            </svg>
          </button>
          {/* Snap to the grid while dragging (D-112); lit while on. Viewers move nothing, so they don't get it. */}
          {!viewer && (
            <button
              className={`${styles.fit} ${snap ? styles.on : ''}`}
              onClick={() => useSnap.getState().toggle()}
              aria-pressed={snap}
              aria-label={snap ? 'Snap to grid: on' : 'Snap to grid: off'}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                <path d="M1.5 4.5h13M1.5 11.5h13M4.5 1.5v13M11.5 1.5v13" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                <rect x="3" y="3" width="3" height="3" fill="currentColor" />
              </svg>
            </button>
          )}
          {/* Line up with other cards while dragging (D-117); lit while on. */}
          {!viewer && (
            <button
              className={`${styles.fit} ${guides ? styles.on : ''}`}
              onClick={() => useGuides.getState().toggle()}
              aria-pressed={guides}
              aria-label={guides ? 'Alignment guides: on' : 'Alignment guides: off'}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                <rect x="2" y="2.5" width="5" height="4" fill="currentColor" />
                <rect x="9" y="9.5" width="5" height="4" fill="none" stroke="currentColor" strokeWidth="1" />
                <path d="M7.5 0.5v15" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
              </svg>
            </button>
          )}
        </span>
        <span className={styles.hints}>
          {viewer ? 'viewing only · scroll: zoom' : `drag: move${snap ? ' on the grid (alt: freely)' : ''} · drag ○ or shift+drag: link · shift+click / alt+drag: select · scroll: zoom`}
          {' · 0: fit all'}
          {!viewer && ' · g: snap · a: guides · right-click: menu'}
          {places.length > 0 && ' · 1–9: go to'}
        </span>
      </footer>

      {all.length === 0 && labels.length === 0 && (
        <div className={styles.empty}>
          <DecodeText text={viewer ? 'Nothing on this board yet' : 'Add your first card with the + button'} />
        </div>
      )}
      {all.length > 0 && nodes.length === 0 && labels.length === 0 && (
        <div className={styles.empty}>
          <DecodeText text="Nothing here with these filters" />
        </div>
      )}

      <BoardMenu ws={ws} create={(type, at) => void create(type, at)} />

      <DetailPanel items={all} />
    </main>
  )
}
