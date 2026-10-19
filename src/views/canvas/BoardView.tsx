// /workspaces/:wid: the main view (D-040). Every item type on one board, plus text written on it (D-050), filtered by the filter bar.
// /workspaces/:wid/focus?on=<id>: the same board showing one card's chain only, in place (D-127, focus.tsx).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { focusPath } from '../../app/paths'
import type { WithId } from '../../data/hooks'
import { createLabel, createSticky } from '../../data/labels'
import { BOARD_TYPES, MADE_TYPES, type Label } from '../../data/model'
import { createBoardNode, moveNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { useWsView, type NewThing } from '../../state/workspaceView'
import { DecodeText } from '../../ui/DecodeText'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { useWs } from '../workspace/context'
import { FilterBar } from '../workspace/FilterBar'
import { Board } from './Board'
import { nudge } from './arrange'
import { BOARD_KINDS, TYPE_ACCENT, useBoardItems, useVisibleItems } from './boardKinds'
import { focusFeatures, focusSet, rememberFocus } from './focus'
import { CARD_H, CARD_W, findFreeSpot } from './cardLayout'
import { copySelection, duplicateSelection, pasteClip } from './clipboard'
import { BoardMenu } from './BoardMenu'
import type { Frame } from './PackageFrame'
import { DetailPanel } from './DetailPanel'
import { useGuides } from './guides'
import { useSnap } from './snap'
import { useThreads } from '../../data/threads'
import { findItem } from '../workspace/useEditKeys'
import { linkStyle } from './linkKinds'
import { myUid, openThread, toggleThreadPins, useThreadView } from './Threads'
import { InboxButton, ThreadInbox } from './ThreadInbox'
import { isOwnerOf } from '../../data/workspaces'
import type { BoardThreads } from './Board'
import type { Thread } from '../../data/model'
import { isSticky } from './stickyNote'
import { PARA_W } from './textStyle'
import { TITLE_W, estimateTitleHalf, isTitle, labelHalf } from './titleBlock'
import { drawSection, fitSections, holdsPoint, isSection, rectOf, useSectionDraw, wrapRect, type Rect, type SectionRect } from './sections'
import { copied } from '../../data/selection'
import { ALL } from '../../data/planes'
import { allSpot, planeIds, useOpenPlane, usePlaneItems, usePlaneWs } from './planes'
import { ExistingCards, PlaneSwitcher } from './PlaneSwitcher'
import { editLocked, useViewer } from '../workspace/viewerLock'
import styles from './BoardView.module.css'

// A jump lands with the label near the top of the view, so the area under it is in sight.
const LAND_BELOW = 2.5

// How high a place sits, for reading order: a section by its top edge.
const topOf = (l: Label) => (isSection(l) ? rectOf(l)[3] : l.y)

// Which way each arrow key nudges, in board units (y grows upwards).
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }

// `focusMode`: the focus view (D-127).
export function BoardView({ focusMode = false }: { focusMode?: boolean }) {
  const ws = useWs()
  const { wid, edges, competitors, competitorFeatures } = ws
  const viewer = useViewer((s) => s.viewer)
  const snap = useSnap((s) => s.on)
  const guides = useGuides((s) => s.on)
  // The plane the board shows (D-139): on one other than All, only the cards placed there, at their places there, and its
  // own text. `every` is every card, for the panel and what's brought in.
  const plane = useOpenPlane(ws, focusMode)
  const pws = usePlaneWs(ws, plane)
  const every = useBoardItems()
  const all = usePlaneItems(every, ws, plane)
  const visible = useVisibleItems(all, !focusMode)
  const select = useCanvas((s) => s.select)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  // The focus view: the card it's on, its chain and the competitors around it; no text, no project block. The card
  // itself shows even when the filters would hide its type. The sections that hold those cards stay, drawn round them
  // (D-130), so you still see what each card is part of.
  const onId = focusMode ? params.get('on') : null
  const centre = onId ? all.find((n) => n.id === onId) : undefined
  const chain = useMemo(
    () => (focusMode ? focusSet(onId ?? '', all, edges, competitorFeatures) : null),
    [focusMode, onId, all, edges, competitorFeatures],
  )
  const nodes = useMemo(() => (chain ? visible.filter((n) => chain.has(n.id) || n.id === onId) : visible), [chain, visible, onId])
  const labels = useMemo(
    () =>
      focusMode
        ? fitSections(
            pws.labels.filter(isSection),
            nodes.map((n) => ({ x: n.x, y: n.y, half: [CARD_W / 2, CARD_H / 2] as [number, number] })),
          )
        : pws.labels,
    [focusMode, pws.labels, nodes],
  )
  const features = useMemo(() => (chain ? focusFeatures(chain, competitorFeatures) : competitorFeatures), [chain, competitorFeatures])
  // Which of our features each competitor's feature matches (D-164): the matrix cells that name it as their feature.
  const matches = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of ws.comparisons) if (c.competitorFeatureId && !map.has(c.competitorFeatureId)) map.set(c.competitorFeatureId, c.featureId)
    return map
  }, [ws.comparisons])
  // Packages at home on this plane (D-141): a frame round their members, as they sit here.
  const frames = useMemo<Frame[]>(() => {
    if (plane === ALL) return []
    const at = new Map(all.map((n) => [n.id, n]))
    return ws.packages.flatMap((k) => {
      if (k.homePlaneId !== plane) return []
      const here = k.memberIds.flatMap((id) => (at.has(id) ? [at.get(id)!] : []))
      if (!here.length) return []
      const pad = 0.5
      return [
        {
          id: k.id,
          name: k.title,
          rect: [
            Math.min(...here.map((n) => n.x)) - CARD_W / 2 - pad,
            Math.min(...here.map((n) => n.y)) - CARD_H / 2 - pad,
            Math.max(...here.map((n) => n.x)) + CARD_W / 2 + pad,
            Math.max(...here.map((n) => n.y)) + CARD_H / 2 + pad,
          ] as [number, number, number, number],
        },
      ]
    })
  }, [plane, all, ws.packages])
  useEffect(() => {
    if (centre) rememberFocus(wid, centre.id)
  }, [wid, centre])
  // Moving the focus to another card frames its chain; the first one is framed as the board opens.
  const framed = useRef(onId)
  useEffect(() => {
    if (!focusMode || framed.current === onId || !nodes.length) return
    framed.current = onId
    const hw = CARD_W / 2 + 1.2
    const hh = CARD_H / 2 + 1.2
    // With the names of the sections round them.
    const frames = labels.map((l) => rectOf(l))
    useCanvas
      .getState()
      .flyToFit([
        Math.min(...nodes.map((n) => n.x - hw), ...frames.map((r) => r[0])),
        Math.min(...nodes.map((n) => n.y - hh), ...frames.map((r) => r[1])),
        Math.max(...nodes.map((n) => n.x + hw), ...frames.map((r) => r[2])),
        Math.max(...nodes.map((n) => n.y + hh), ...frames.map((r) => r[3])),
      ])
  }, [focusMode, onId, nodes, labels])
  // Every card to focus on, by type in the chain's order (D-045).
  const focusItems = useMemo<MenuEntry[]>(
    () =>
      BOARD_TYPES.flatMap((t) => {
        const of = all.filter((n) => n.type === t).sort((a, b) => a.title.localeCompare(b.title))
        return of.length
          ? [
              { key: `h-${t}`, heading: BOARD_KINDS[t].plural },
              // The card in focus is marked ◎; choosing one closes the menu.
              ...of.map((n) => ({ key: n.id, label: n.title || 'Untitled', tone: TYPE_ACCENT[t], glyph: n.id === onId ? '◎' : '▌', onSelect: () => navigate(focusPath(wid, n.id)) })),
            ]
          : []
      }),
    [all, onId, navigate, wid],
  )

  // `?item=<id>` (from a link in another view) selects that card, unhides it, and starts the camera on it.
  const [focus] = useState(() => {
    const n = all.find((c) => c.id === params.get('item'))
    return n ? ([n.x, n.y] as [number, number]) : undefined
  })
  useEffect(() => {
    const id = params.get('item')
    if (!id) return
    const n = all.find((c) => c.id === id)
    // A card that isn't on this plane opens on All.
    if (!n && plane !== ALL && every.some((c) => c.id === id)) {
      useWsView.getState().setPlane(ALL)
      setParams((p) => {
        p.delete('plane')
        return p
      })
      return
    }
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

  // Competitors made before the board (D-040) have no position yet: give each a free spot once (on All).
  const placed = useRef(new Set<string>())
  useEffect(() => {
    if (editLocked() || plane !== ALL) return
    const taken = all.filter((i) => i.type !== 'competitor' || competitors.find((c) => c.id === i.id)?.x !== undefined)
    for (const c of competitors) {
      if (c.x !== undefined || placed.current.has(c.id)) continue
      placed.current.add(c.id)
      const [x, y] = findFreeSpot([0, -4], taken)
      taken.push({ ...all.find((i) => i.id === c.id)!, x, y })
      void moveNode(wid, 'competitor', c.id, x, y)
    }
  }, [all, competitors, wid, plane])

  // The jump list (D-050), in reading order: top to bottom, then left to right. Notes and H3s aren't places (D-116, D-130).
  // The title block (D-118) is a place too, under the workspace's name; a named section (D-130) by its top edge.
  const places = useMemo(
    () =>
      (focusMode ? [] : labels)
        .filter((l) => isTitle(l) || (l.text.trim() && !isSticky(l) && (isSection(l) || (l.size !== 'note' && l.size !== 'minor'))))
        .sort((a, b) => topOf(b) - topOf(a) || a.x - b.x),
    [labels, focusMode],
  )
  // A section is framed whole.
  const jump = (l: WithId<Label>) =>
    isSection(l) ? useCanvas.getState().flyToFit(rectOf(l)) : useCanvas.getState().flyTo(isTitle(l) ? [l.x, l.y] : [l.x, l.y - LAND_BELOW])
  const title = labels.find(isTitle)

  // Escape deselects; arrows nudge the selection (D-124); 0 frames the whole board; g switches snapping to the grid (D-112); 1–9 jump to the places in the list; ⌘C / ⌘V / ⌘D copy, paste, duplicate (D-108);
  // leaving the board clears selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, dialog') || t.isContentEditable) return
      if (e.key === 'Escape') {
        // Drawing a section: Escape only puts the crosshair away.
        if (useSectionDraw.getState().on) return drawSection(false)
        select(null)
      }
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      // Text selected on the page copies as text, as usual.
      const textSelected = !(window.getSelection()?.isCollapsed ?? true)
      if (mod && !e.shiftKey && !e.altKey && !editLocked() && !textSelected) {
        const any = useCanvas.getState().selection.length > 0
        if (key === 'c' && any) {
          e.preventDefault()
          copySelection(pws)
        } else if (key === 'v' && copied()) {
          e.preventDefault()
          void pasteClip(pws)
        } else if (key === 'd' && any) {
          e.preventDefault()
          void duplicateSelection(pws)
        }
      }
      // The arrow keys nudge what's selected (D-124); a menu or dropdown that took the key keeps it.
      const dir = ARROWS[e.key]
      if (dir && !mod && !e.altKey && !e.defaultPrevented && !editLocked() && !useCanvas.getState().editingLabel && useCanvas.getState().selection.length) {
        e.preventDefault()
        nudge(wid, dir, e.shiftKey)
      }
      if (e.key === '0' && !e.metaKey && !e.ctrlKey && !e.altKey) useCanvas.getState().fitAll()
      // [ and ] step through the planes (D-139), All first.
      if ((e.key === '[' || e.key === ']') && !mod && !e.altKey && !focusMode && ws.planes.length) {
        const order = [ALL, ...[...ws.planes].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt).map((p) => p.id)]
        const next = order[(order.indexOf(plane) + (e.key === ']' ? 1 : order.length - 1)) % order.length]
        useWsView.getState().setPlane(next)
        setParams((p) => {
          if (next === ALL) p.delete('plane')
          else p.set('plane', next)
          return p
        })
      }
      if (key === 'g' && !mod && !e.altKey && !editLocked()) useSnap.getState().toggle()
      // c shows or hides the comment pins (D-159).
      if (key === 'c' && !mod && !e.altKey) toggleThreadPins()
      // a switches the alignment guides (D-117).
      if (key === 'a' && !mod && !e.altKey && !editLocked()) useGuides.getState().toggle()
      if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const place = places[Number(e.key) - 1]
        if (place) jump(place)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select, places, pws, wid, ws.planes, plane, focusMode, setParams])
  useEffect(() => () => select(null), [select])
  // Leaving the board puts the section crosshair away.
  useEffect(() => () => drawSection(false), [])
  const drawing = useSectionDraw((s) => s.on)

  // Comment threads (D-159): loaded with the board, pinned where they're on.
  const threadList = useThreads(wid).data
  const pinsOn = useThreadView((s) => s.show)
  const titleOf = (t: Pick<Thread, 'on' | 'targetId'>): string => {
    const id = t.targetId ?? ''
    if (t.on === 'spot') return 'a spot on the board'
    if (t.on === 'card') return findItem(ws, id)?.title.trim() || ws.competitorFeatures.find((f) => f.id === id)?.name || 'a card'
    if (t.on === 'label') {
      const l = ws.labels.find((o) => o.id === id)
      if (!l) return 'text'
      if (isTitle(l)) return ws.workspace.name
      return l.text.trim().split('\n')[0].slice(0, 60) || (isSection(l) ? 'a section' : isSticky(l) ? 'a sticky note' : 'text')
    }
    const e = edges.find((o) => o.id === id)
    if (!e) return 'a link'
    const name = (n: string) => findItem(ws, n)?.title.trim() || ws.competitorFeatures.find((f) => f.id === n)?.name || '?'
    return `${linkStyle(e.kind).label}: ${name(e.fromId)} → ${name(e.toId)}`
  }
  const known = useMemo(
    () => new Set([...every.map((n) => n.id), ...ws.labels.map((l) => l.id), ...edges.map((e) => e.id), ...competitorFeatures.map((f) => f.id)]),
    [every, ws.labels, edges, competitorFeatures],
  )
  const boardThreads: BoardThreads = { list: threadList, exists: (id) => known.has(id), plane, titleOf, isOwner: isOwnerOf(ws.workspace, myUid()) }
  const pinsNewOnly = useThreadView((s) => s.newOnly)
  const pinsResolved = useThreadView((s) => s.resolvedToo)
  // The plane a thread is best seen on (D-168): this one if what it's on shows here; else the plane it was started on, if
  // what it's on is there; else All, where every card is. Text, sections and spots belong to one plane.
  const threadPlane = (t: Thread): string => {
    if (t.on === 'spot') return t.planeId ?? ALL
    if (t.on === 'label') return ws.labels.find((l) => l.id === t.targetId)?.planeId ?? ALL
    const ownerOf = (id: string) => competitorFeatures.find((f) => f.id === id)?.competitorId ?? id
    const edge = t.on === 'link' ? edges.find((e) => e.id === t.targetId) : undefined
    const ids = t.on === 'card' ? [ownerOf(t.targetId ?? '')] : edge ? [ownerOf(edge.fromId), ownerOf(edge.toId)] : []
    if (!ids.length) return plane
    const on = (p: string) => {
      const here = planeIds(ws, p)
      return !here || ids.every((id) => here.has(id))
    }
    if (on(plane)) return plane
    if (t.planeId && ws.planes.some((p) => p.id === t.planeId) && on(t.planeId)) return t.planeId
    return ALL
  }
  const planeName = (id: string) => (id === ALL ? 'All' : (ws.planes.find((p) => p.id === id)?.name ?? 'All'))
  // Opened from the list: the board switches to the thread's plane if it has to, goes to it, and it opens beside its pin.
  const [going, setGoing] = useState<(Thread & { id: string }) | null>(null)
  const flyToThread = (t: Thread & { id: string }) => {
    const target = t.on === 'card' ? all.find((n) => n.id === t.targetId) : t.on === 'label' ? labels.find((l) => l.id === t.targetId) : undefined
    const edge = t.on === 'link' ? edges.find((e) => e.id === t.targetId) : undefined
    const ends = edge ? [all.find((n) => n.id === edge.fromId), all.find((n) => n.id === edge.toId)].filter(Boolean) : []
    const at: [number, number] = target ? [target.x, target.y] : ends.length === 2 ? [(ends[0]!.x + ends[1]!.x) / 2, (ends[0]!.y + ends[1]!.y) / 2] : [t.x, t.y]
    useCanvas.getState().flyTo(at)
    openThread(t.id)
  }
  const goToThread = (t: Thread & { id: string }) => {
    const to = threadPlane(t)
    if (to === plane) return flyToThread(t)
    setGoing(t)
    useWsView.getState().setPlane(to)
    setParams((p) => {
      if (to === ALL) p.delete('plane')
      else p.set('plane', to)
      return p
    })
  }
  // Once the board is on the thread's plane (its cards and text at their places there), go to it.
  useEffect(() => {
    if (!going || threadPlane(going) !== plane) return
    const t = going
    setGoing(null)
    requestAnimationFrame(() => flyToThread(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [going, plane, all, labels])

  const create = async (type: NewThing, at: [number, number]) => {
    // A section is drawn on the board, not placed.
    if (type === 'section') return drawSection(true)
    if (type === 'text' || type === 'paragraph' || type === 'sticky') {
      const id = await (type === 'sticky' ? createSticky(wid, at) : createLabel(wid, { text: '', x: at[0], y: at[1], ...(type === 'paragraph' && { size: 'note' as const, w: PARA_W }) }))
      select(id)
      useCanvas.getState().setEditingLabel(id)
      return
    }
    // Made on a plane other than All, it lands on All too, right of everything there (D-139).
    const [ax, ay] = pws.plane ? allSpot(pws.plane.allSpots) : at
    const id = await createBoardNode(wid, type, { x: at[0], y: at[1] }, {}, { x: ax, y: ay })
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

  // A section (D-130) round these cards and labels, or an empty one; named straight away.
  const addSection = async (rect: SectionRect) => {
    const id = await createLabel(wid, { text: '', kind: 'section', ...rect })
    select(id)
    useCanvas.getState().setEditingLabel(id)
  }
  const wrap = (ids: string[]) => {
    const boxOf = (c: [number, number], h: [number, number]) => ({ c, h })
    const inside = new Set(ids)
    const boxes = () => [
      ...all.filter((n) => inside.has(n.id)).map((n) => boxOf([n.x, n.y], [CARD_W / 2, CARD_H / 2])),
      ...labels.filter((l) => inside.has(l.id)).map((l) => boxOf([l.x, l.y], labelHalf(l))),
    ]
    if (!boxes().length) return
    // Text the frame would cover (an area's heading just over its cards) goes in too, so the name band sits above it
    // instead of on it; twice, as taking it in makes the frame taller.
    for (let pass = 0; pass < 2; pass++) {
      const r = wrapRect(boxes())
      const frame: Rect = [r.x - r.w / 2, r.y - r.h / 2, r.x + r.w / 2, r.y + r.h / 2]
      for (const l of labels) if (!isSection(l) && !isTitle(l) && holdsPoint(frame, l.x, l.y)) inside.add(l.id)
    }
    void addSection(wrapRect(boxes()))
  }

  const add = (type: NewThing) => {
    if (type === 'section') return drawSection(true)
    const center = useCanvas.getState().viewCenter()
    // Clear of every card, including filtered-out ones.
    void create(type, findFreeSpot(center, all))
  }

  return (
    <main className={styles.page}>
      <Board
        wid={wid}
        nodes={nodes}
        edges={edges}
        labels={labels}
        competitorFeatures={features}
        matches={matches}
        focus={focus}
        cameraKey={focusMode ? `${wid}/focus/${onId ?? ''}` : plane !== ALL ? `${wid}/plane/${plane}` : undefined}
        centreId={centre?.id}
        sectionsFixed={focusMode}
        onDrawSection={focusMode ? undefined : (rect) => void addSection(rect)}
        frames={frames}
        threads={boardThreads}
      />

      <FilterBar
        plane={focusMode ? undefined : <PlaneSwitcher ws={ws} plane={plane} cards={all.length} locked={viewer} />}
        links
        focus={focusMode ? { summary: centre ? centre.title || 'Untitled' : 'none', items: focusItems } : undefined}
        goTo={focusMode ? undefined : places.map((l) => ({ key: l.id, label: isTitle(l) ? ws.workspace.name : l.text.trim(), onSelect: () => jump(l) }))}
        // Comment threads (D-159): the pins' switch and every thread, open ones first; viewers too. Last in the bar.
        // What the comment pins show (D-159, D-166); every thread is in the threads panel, bottom left.
        comments={{
          summary: !pinsOn ? 'off' : pinsNewOnly ? 'new' : 'on',
          active: !pinsOn || pinsNewOnly || pinsResolved,
          items: [
            { key: 'pins', label: 'show pins', hint: 'c', checked: pinsOn, onSelect: toggleThreadPins },
            { key: 'new', label: 'only with something new', checked: pinsNewOnly, onSelect: () => useThreadView.setState((st) => ({ newOnly: !st.newOnly, show: true })) },
            { key: 'resolved', label: 'resolved ones too', checked: pinsResolved, onSelect: () => useThreadView.setState((st) => ({ resolvedToo: !st.resolvedToo, show: true })) },
          ],
        }}
      />

      {/* One create button for everything (D-053); viewers make nothing (D-098). */}
      <footer className={styles.tools} data-preview-hide>
        <span className={styles.buttons}>
          {!viewer && !focusMode && <Menu
            primary
            up
            label="+"
            ariaLabel="Create"
            items={[
              { key: 'cards', heading: 'card' },
              ...MADE_TYPES.map((t) => ({
                key: t,
                label: BOARD_KINDS[t].label,
                // The card's left border, in its type colour (D-055).
                glyph: '▌',
                tone: TYPE_ACCENT[t],
                onSelect: () => add(t),
              })),
              { key: 'board', heading: 'on the board' },
              { key: 'text', label: 'heading', glyph: 'T', hint: 'jump point', onSelect: () => add('text') },
              { key: 'paragraph', label: 'paragraph', glyph: '¶', hint: 'wraps, **bold**', onSelect: () => add('paragraph') },
              { key: 'sticky', label: 'sticky note', glyph: '▚', hint: 'signed', onSelect: () => add('sticky') },
              { key: 'section', label: 'section', glyph: '⬚', hint: 'drag to draw', onSelect: () => add('section') },
              // One title block, on All (D-118, D-139).
              ...(title || plane !== ALL ? [] : [{ key: 'title', label: 'project title', glyph: '✦', hint: 'name + about', onSelect: () => void addTitle() }]),
            ]}
          />}
          {/* Cards already in the workspace, onto this plane (D-139). */}
          {!viewer && !focusMode && plane !== ALL && <ExistingCards wid={wid} plane={plane} all={every} here={all} />}
          {/* Every conversation in the workspace (D-166). */}
          {!focusMode && <InboxButton wid={wid} threads={threadList} />}
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
          {drawing && !focusMode ? (
            <span className={styles.drawing}>section: press and drag on the board to draw it · esc: cancel</span>
          ) : (
            <>
              {focusMode && centre && `${nodes.length} of ${all.length} cards · `}
              {viewer ? 'viewing only · scroll: zoom' : `drag: move${snap ? ' on the grid (alt: freely)' : ''} · drag › or shift+drag: link · shift+click / alt+drag: select · scroll: zoom`}
              {' · 0: fit all'}
              {!focusMode && ws.planes.length > 0 && ' · [ ]: planes'}
              {!viewer && ' · g: snap · a: guides'}
              {' · right-click: menu'}
              {places.length > 0 && ' · 1–9: go to'}
            </>
          )}
        </span>
      </footer>

      {all.length === 0 && labels.length === 0 && (
        <div className={styles.empty}>
          <DecodeText
            text={
              viewer
                ? 'Nothing on this board yet'
                : plane !== ALL
                  ? 'Bring cards in with existing, or make new ones with +'
                  : 'Add your first card with the + button'
            }
          />
        </div>
      )}
      {all.length > 0 && focusMode && !centre && (
        <div className={styles.empty}>
          <DecodeText text={onId ? 'That card is gone: pick another in focus ▾' : 'Pick a card in focus ▾ to see its chain'} />
        </div>
      )}
      {all.length > 0 && (!focusMode || centre) && nodes.length === 0 && labels.length === 0 && (
        <div className={styles.empty}>
          <DecodeText text="Nothing here with these filters" />
        </div>
      )}

      <BoardMenu ws={pws} create={focusMode ? undefined : (type, at) => void create(type, at)} wrap={focusMode ? undefined : wrap} />

      {!focusMode && <ThreadInbox wid={wid} threads={threadList} titleOf={titleOf} onGo={goToThread} whereOf={(t) => (ws.planes.length ? planeName(threadPlane(t)) : null)} here={planeName(plane)} />}

      <DetailPanel items={every} />
    </main>
  )
}
