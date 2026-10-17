// /w/:wid: the main view (D-040). Every item type on one board, filtered by the domain tab and the filter bar.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BOARD_TYPES, type BoardType } from '../../data/model'
import { createGroup } from '../../data/groups'
import { createBoardNode, moveNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { ALL, useWsView } from '../../state/workspaceView'
import { AsciiButton } from '../../ui/AsciiButton'
import { DecodeText } from '../../ui/DecodeText'
import { useWs } from '../workspace/context'
import { FilterBar } from '../workspace/FilterBar'
import { ViewSwitch } from '../workspace/ViewSwitch'
import { Board } from './Board'
import { BOARD_KINDS, useBoardItems, useVisibleItems } from './boardKinds'
import { findFreeSpot } from './cardLayout'
import { DetailPanel } from './DetailPanel'
import styles from './BoardView.module.css'

export function BoardView() {
  const { wid, edges, competitors, domains, groups } = useWs()
  const all = useBoardItems()
  const nodes = useVisibleItems(all)
  const select = useCanvas((s) => s.select)
  const domain = useWsView((s) => s.domain)
  const lastType = useWsView((s) => s.lastType)
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

  // Switching domain tab looks at what that tab shows.
  const firstDomain = useRef(domain)
  useEffect(() => {
    if (domain === firstDomain.current) return
    firstDomain.current = domain
    if (nodes.length === 0) return
    const xs = nodes.map((n) => n.x)
    const ys = nodes.map((n) => n.y)
    useCanvas.getState().focusOn([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain])

  // Leaving the board clears selection; Escape deselects.
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

  // New items go into the current domain tab; on `all` they start unsorted.
  const create = async (type: BoardType, at: [number, number]) => {
    const d = domain !== ALL && domains.some((x) => x.id === domain) ? domain : undefined
    const id = await createBoardNode(wid, type, { x: at[0], y: at[1] }, d ? { domainId: d, domainIds: [d] } : {})
    const { types, toggleType } = useWsView.getState()
    if (!types.includes(type)) toggleType(type)
    select(id)
  }

  // Frames on this tab: the tab's own and those without a domain.
  const frames = useMemo(
    () => groups.filter((g) => domain === ALL || !g.domainId || g.domainId === domain || !domains.some((d) => d.id === domain)),
    [groups, domain, domains],
  )

  // A new frame goes around the selected card, or in the middle of the view.
  const addGroup = async () => {
    const sel = all.find((i) => i.id === useCanvas.getState().selectedId)
    const [x, y] = sel ? [sel.x + 1.4, sel.y - 0.6] : useCanvas.getState().viewCenter()
    const d = domain !== ALL && domains.some((x) => x.id === domain) ? domain : undefined
    const id = await createGroup(wid, { name: '', x, y, w: 6.2, h: 3.4, ...(d && { domainId: d }) })
    select(id)
  }

  const add = (type: BoardType) => {
    useWsView.getState().setLastType(type)
    // Clear of every card, including ones this tab hides, so switching tabs never shows a pile-up.
    void create(type, findFreeSpot(useCanvas.getState().viewCenter(), all))
  }

  return (
    <main className={styles.page}>
      <Board wid={wid} nodes={nodes} edges={edges} groups={frames} focus={focus} onCreate={(at) => void create(lastType, at)} />

      <FilterBar />

      <footer className={styles.tools}>
        <span className={styles.adds}>
          {BOARD_TYPES.map((t) => (
            <AsciiButton key={t} onClick={() => add(t)}>
              {BOARD_KINDS[t].addLabel}
            </AsciiButton>
          ))}
          <AsciiButton accent="blue" onClick={() => void addGroup()}>
            + Group
          </AsciiButton>
        </span>
        <span className={styles.hints}>
          double-click: new {BOARD_KINDS[lastType].label} · drag: move · shift+drag: link · drag board: pan · scroll: zoom
        </span>
      </footer>
      <ViewSwitch />

      {nodes.length === 0 && (
        <div className={styles.empty}>
          <DecodeText text={all.length === 0 ? 'Double-click anywhere to pin your first idea' : 'Nothing here with these filters'} />
        </div>
      )}

      <DetailPanel items={all} />
    </main>
  )
}
