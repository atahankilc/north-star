// The finder (D-236): ⌘F, or the side nav's compass, anywhere in a workspace. A prompt in the middle of the screen
// (the menus' look and parts, D-222, D-350: its rows a PromptList, its frame the prompt's): `> what's typed`,
// `[here | this canvas | everywhere]` (those there are, D-302), `Aa W .*`. Opened empty it's only that line,
// in the middle; typed into, it opens out to its matches, grouped by where they are, and the preview of the one picked
// (what the screen shows once you're there), gliding as it grows so it stays in the middle. ↓ with nothing typed lists
// the places (go to, D-196). ↑ ↓ pick, Enter goes, Tab steps the scopes, alt C W X the switches, Escape closes.
// Something on another canvas (D-302) goes there first: the canvas builds, then the view goes on as it would.
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { canvasPath } from '../../../app/paths'
import { canvasTextOn, piecesOn } from '../../../data/canvases'
import { create } from 'zustand'
import type { WithId } from '../../../data/hooks'
import type { Doc, DocBody } from '../../../data/documents'
import { useDocBody } from '../../../data/documents'
import { CANVAS } from '../../../data/labels'
import { useAuth } from '../../../data/auth'
import { KIND_NAME, kindOfPiece } from '../../../data/pieces'
import { useCanvasView } from '../../../state/canvasView'
import { isReducedMotion } from '../../../state/motion'
import { useWs, useWsNow, type WorkspaceCtx } from '../canvas/context'
import { closeFinder, findGo, matcherOf, matchesIn, openFinder, setQuery, setScope, toggleOpt, toggleScope, useFind, useMatcher, type FindOpts, type FindScope } from './find'
import { findGroups, folded, type Dest, type Group, type Row } from './findIndex'
import { goToTask } from '../deck/Kanban'
import { FindPreview } from './FindPreview'
import { placesIn, shownPlaces, toggleOpen, useGoTo } from '../canvas/goTo'
import { shownPieces } from '../canvas/shownBox'
import { useFieldText, useTableUi } from '../table/Table'
import { useDocUi } from '../documents/Documents'
import { TYPE_ACCENT } from '../plane/PlaneCards'
import styles from './Finder.module.css'
import { Button } from '../../../ui/primitives/Button'
import { Hit } from '../../../ui/primitives/PromptRow'
import { PromptList } from '../../../ui/patterns/PromptList'
import { usePromptNav } from '../../../ui/foundation/usePromptNav'
import type { PromptEntry, PromptItem } from '../../../ui/foundation/promptModel'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Empty } from '../../../ui/primitives/Empty'
import { PromptField } from '../../../ui/primitives/PromptField'
import { Tabs } from '../../../ui/primitives/Tabs'
import { Window } from '../../../ui/patterns/Window'

const SWITCHES: { k: keyof FindOpts; label: string; title: string; code: string }[] = [
  { k: 'caseSensitive', label: 'Aa', title: 'match case', code: 'KeyC' },
  { k: 'words', label: 'W', title: 'whole words', code: 'KeyW' },
  { k: 'regex', label: '.*', title: 'regular expression', code: 'KeyX' },
]

// Its sizes: narrow while empty, wide with matches; the line; the list's most.
const W = { empty: 600, full: 1040 }
const LINE = 47
const LIST_MAX = 0.3
const GO_MAX = 0.6
const EDGE = 16

// A match on another canvas (D-302), waiting for that canvas to be shown.
// Given up after a few seconds (that canvas never came: deleted on the way).
let waiting: Row | null = null
let waitingSince = 0
const WAIT_MS = 4000

export function Finder() {
  const open = useFind((s) => s.open)
  const { canvas } = useWs()
  const now = useWsNow()
  // The canvas asked for is shown (and its pieces drawn): on to the match.
  useEffect(() => {
    const row = waiting
    if (row && performance.now() - waitingSince > WAIT_MS) waiting = null
    if (!row || !waiting || row.dest.canvas !== canvas) return
    waiting = null
    const raf = requestAnimationFrame(() => goRow(row, now()))
    return () => cancelAnimationFrame(raf)
  }, [canvas, now])
  // ⌘F (ctrl F) anywhere in the workspace is the finder's, never the browser's.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openFinder()
        useFinderUi.setState((s) => ({ summoned: s.summoned + 1 }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return open ? <Panel /> : null
}

// ⌘F again while it's open: the field takes the keys again, what's typed selected. Documents' text read while it's open.
const useFinderUi = create<{ summoned: number }>(() => ({ summoned: 0 }))
const useBodies = create<Record<string, DocBody>>(() => ({}))

function Panel() {
  const ws = useWs()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const here = params.get('focus') ?? CANVAS
  const query = useFind((s) => s.query)
  const opts = useFind((s) => s.opts)
  const asked = useFind((s) => s.scope)
  const re = useMatcher()
  const navigate = useNavigate()
  // The scopes there are (D-302): `here` only in a focus (out of one it's the canvas), `everywhere` only with more
  // than one canvas; one alone isn't shown.
  const several = ws.canvases.length > 1
  const scopes: FindScope[] = [...(here !== CANVAS ? ['here' as const] : []), 'canvas', ...(several ? ['everywhere' as const] : [])]
  const scope: FindScope = scopes.includes(asked) ? asked : 'canvas'
  const size = useCanvasView((s) => s.size)
  const fieldText = useFieldText()
  // Documents' text comes in one by one: looked through again once they're in, not on each.
  const bodies = useDeferredValue(useBodies())
  // What's typed is looked for once typing pauses (a workspace's every page and cell takes a moment), the field
  // answering every key meanwhile; `searching…` shows until then.
  const [settled, setSettled] = useState(query)
  useEffect(() => {
    if (!query) return setSettled('')
    const t = setTimeout(() => setSettled(query), SETTLE_MS)
    return () => clearTimeout(t)
  }, [query])
  // Looked through behind the field (React draws what's typed first, then this).
  const looking = useDeferredValue(settled)
  const found = useMemo(() => matcherOf(looking, opts), [looking, opts])
  const searching = !!query && (settled !== query || looking !== settled)
  const field = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const summoned = useFinderUi((s) => s.summoned)
  // With nothing typed it's go to (D-196): the places, a plane's own folded under it until opened (D-200).
  const unfolded = useGoTo((s) => s.open)
  const going = !query && !looking
  // The preview's zoom, kept for each space while the finder's open: the next match in the same one keeps it.
  const [zooms, setZooms] = useState<Record<string, number>>({})

  useEffect(() => {
    field.current?.focus()
    field.current?.select()
  }, [summoned])

  // What the tables, matrices and lists hold, kept until their data changes.
  const held = useMemo(() => new Map(), [ws.pieces, ws.cards, ws.cells, ws.documents, fieldText, user?.id])
  const groups: Group[] = useMemo(() => {
    if (going) {
      const places = placesIn(here, shownPieces(piecesOn(ws.canvas, ws.pieces, ws.spots), ws.cards), ws.labels.filter((l) => l.pieceId !== CANVAS || canvasTextOn(ws.canvas)(l)), ws.workspace.name)
      if (!places.length) return []
      const inside = (id: string) => places.filter((p) => p.inside && p.space === id).length
      return [
        {
          space: 'places',
          title: here === CANVAS ? 'go to · on the canvas' : 'go to · in the plane',
          glyph: '⌖',
          count: places.length,
          rows: shownPlaces(places, unfolded).map((p): Row => {
            const n = p.inside ? 0 : inside(p.id)
            return {
              id: `${p.space}:${p.id}`,
              glyph: p.glyph,
              text: p.label,
              hint: '',
              indent: p.inside,
              fold: n ? { open: unfolded.includes(p.id), count: n, plane: p.id } : undefined,
              dest: { kind: 'place', place: p, target: { kind: 'space', space: p.space, k: 0 } },
            }
          }),
        },
      ]
    }
    if (!(found instanceof RegExp)) return []
    const re = found
    // The canvas shown, or every canvas, the one shown first (D-302); another's groups say which it is, and their
    // matches go there first.
    const looked = scope === 'everywhere' ? [ws.canvas, ...ws.canvases.map((c) => c.id).filter((c) => c !== ws.canvas)] : [ws.canvas]
    const all: Group[] = []
    const named: { row: Row; canvas: string }[] = []
    for (const c of looked) {
      const pieces = piecesOn(c, ws.pieces, ws.spots)
      const labels = ws.labels.filter((l) => l.pieceId !== CANVAS || canvasTextOn(c)(l))
      const other = c !== ws.canvas
      const name = ws.canvases.find((x) => x.id === c)?.name ?? ''
      const tag = (r: Row): Row => (other ? { ...r, id: `${c}:${r.id}`, dest: { ...r.dest, canvas: c } } : r)
      const groups = findGroups(
        { pieces, cards: ws.cards, places: ws.places, labels, cells: ws.cells, tasks: ws.tasks, documents: ws.documents, bodies, workspace: ws.workspace, me: user?.id, fieldText, room: size, held },
        re,
        here,
      )
      for (const g of groups) all.push(other ? { ...g, space: `${c}:${g.space}`, title: `${name} / ${g.title}`, rows: g.rows.map(tag) } : g)
      // Pieces by their names, as places, first.
      for (const p of shownPieces(pieces, ws.cards)) {
        if (!p.name || !matchesIn(p.name, re, 1).length) continue
        const kind = kindOfPiece(p)
        const place = { id: p.id, space: CANVAS, label: p.name, glyph: '▦', box: p, whole: true }
        const row: Row = { id: `piece:${p.id}`, glyph: '⌖', text: p.name, hint: other ? `${KIND_NAME[kind]} · ${name}` : KIND_NAME[kind], dest: { kind: 'place', place, target: { kind: 'space', space: CANVAS, key: `${kind === 'plane' ? 'plane' : kind}:${p.id}`, k: 0 } } }
        named.push({ row: tag(row), canvas: c })
      }
    }
    const places: Group[] = named.length ? [{ space: 'places', title: 'places', glyph: '⌖', count: named.length, rows: named.map((n) => n.row) }] : []
    return [...places, ...(scope === 'here' ? folded(all, here) : all)]
  }, [going, unfolded, found, scope, here, ws.pieces, ws.cards, ws.labels, ws.cells, ws.tasks, ws.documents, ws.workspace, ws.canvas, ws.canvases, bodies, user?.id, fieldText, size, held])

  // Only so many rows are drawn (typing more narrows them); each group still says how many it has.
  const total = groups.reduce((s, g) => s + (g.space === 'places' ? 0 : g.count), 0)
  const [shownGroups, more] = useMemo(() => {
    let left = ROWS_MAX
    const out = groups.map((g) => {
      const rows = g.rows.slice(0, Math.max(0, left))
      left -= rows.length
      return { ...g, rows }
    })
    const all = groups.reduce((s, g) => s + g.rows.length, 0)
    return [out.filter((g) => g.rows.length), all - Math.min(all, ROWS_MAX)]
  }, [groups])
  const rows = useMemo(() => shownGroups.flatMap((g) => g.rows), [shownGroups])
  // The rows as the prompt's entries (D-350): each group a `# head` with its count, its rows under it; drawn again only
  // when they change, their handlers through a ref.
  const acts = useRef({ go: (_: Row) => {}, fold: (_: string) => {} })
  const entries = useMemo<PromptEntry[]>(
    () =>
      shownGroups.flatMap((g): PromptEntry[] => [
        { key: `#${g.space}`, heading: g.title, count: g.count },
        ...g.rows.map(
          (r): PromptItem => ({
            key: r.id,
            label: r.inside || !(found instanceof RegExp) ? r.text : <Hit text={r.text} ranges={matchesIn(r.text, found, 50)} tone="found" />,
            glyph: r.glyph,
            tone: r.tone ? TYPE_ACCENT[r.tone as keyof typeof TYPE_ACCENT] : undefined,
            hint: r.hint || undefined,
            indent: r.indent,
            faint: r.inside,
            fold: r.fold && { open: r.fold.open, count: r.fold.count, onToggle: () => acts.current.fold(r.fold!.plane) },
            onSelect: () => acts.current.go(r),
          }),
        ),
      ]),
    [shownGroups, found],
  )
  // The keys (usePromptNav): ↑ ↓ pick, Enter goes, → ← a plane's places, Escape closes; Tab and alt C W X are the
  // finder's own (below).
  const nav = usePromptNav(entries, { onPick: (i) => i.onSelect({ shift: false, alt: false }), onClose: closeFinder })
  const picked = rows.find((r) => r.id === nav.picked) ?? null
  const setPick = nav.setPicked
  useEffect(() => setPick(null), [looking, scope, opts, setPick])
  // The preview follows the pick once it rests (arrows held run through without drawing each one).
  const [previewed, setPreviewed] = useState<Row | null>(picked)
  useEffect(() => {
    const t = setTimeout(() => setPreviewed(picked), previewed ? PREVIEW_MS : 0)
    return () => clearTimeout(t)
    // When the pick changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked?.id, groups])

  const go = (row: Row | null) => {
    if (!row) return
    // On another canvas (D-302): that canvas first, then on from there (Finder, above).
    if (row.dest.canvas && row.dest.canvas !== ws.canvas) {
      waiting = row
      waitingSince = performance.now()
      closeFinder()
      return navigate(canvasPath(ws.wid, row.dest.canvas))
    }
    goRow(row, ws)
  }

  // How big it is, and so where: the list as tall as its rows (to its most), the preview what's left, at the screen's
  // shape. Set as numbers so the change glides; centred by its middle, so it stays in the middle as it grows.
  const list = useRef<HTMLDivElement>(null)
  const [listH, setListH] = useState(0)
  useLayoutEffect(() => {
    const el = list.current?.firstElementChild as HTMLElement | null | undefined
    if (!el) return setListH(0)
    const ro = new ResizeObserver(() => setListH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [rows.length > 0, going])
  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth
  const vh = typeof window === 'undefined' ? 900 : window.innerHeight
  // Going to a place (nothing typed): narrow, its list only, no preview. Finding: wide, the list and the preview.
  const full = !!query
  const width = Math.min(full ? W.full : W.empty, vw - 2 * EDGE)
  const shownList = rows.length ? Math.min(listH, Math.round(vh * (going ? GO_MAX : LIST_MAX))) : query || going ? 52 : 0
  const previewH = !going && rows.length ? Math.max(160, Math.min(Math.round((width * size.h) / Math.max(1, size.w)), vh - 2 * EDGE - LINE - shownList - 2)) : 0
  const height = LINE + shownList + (previewH ? previewH + 1 : 0)

  // The preview's zoom for the previewed match's space.
  const space = previewed ? spaceOf(previewed.dest) : ''
  const zoom = zooms[space] ?? 1
  const setZoom = useCallback((z: number) => setZooms((all) => ({ ...all, [space]: Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, z)) * 100) / 100 })), [space])

  const keys = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // The field passes its keys on (⌘F again reaches the window): Escape stays here.
    if (e.key === 'Escape') e.stopPropagation()
    if (e.key === 'Tab') {
      e.preventDefault()
      return scopes.length > 1 && toggleScope(scopes, scope)
    }
    const sw = e.altKey && SWITCHES.find((s) => s.code === e.code)
    if (sw) {
      e.preventDefault()
      return toggleOpt(sw.k)
    }
    nav.onKeyDown(e)
  }

  acts.current = {
    go,
    fold: (plane: string) => (toggleOpen(plane), field.current?.focus()),
  }
  // Going to a place: a click goes, the pointer picks. Finding: a click shows it in the preview, a double-click goes
  // (the pointer passing over shows nothing, so reaching for the preview doesn't run through them all).
  const onRow = (i: PromptItem) => (going ? i.onSelect({ shift: false, alt: false }) : (setPick(i.key), field.current?.focus()))
  const idOf = (key: string) => `find-${key}`

  return (
    <>
      {/* The Window (D-326): its scrim closes it, focus on the field and back on close; the frame, the keys (Escape,
          Tab steps the scopes) and the fade (the scrim's) are the finder's own. */}
      <Window
        label="Find"
        onClose={closeFinder}
        escape={false}
        trap={false}
        look="bare"
        entrance="none"
        portal={false}
        focus={field as RefObject<HTMLElement | null>}
        scrimProps={{ className: styles.shade }}
        className={styles.finder}
        data-full={full || undefined}
        data-reduced={isReducedMotion() || undefined}
        style={{ width, height }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* The `>` line (PromptField, D-326): Enter goes; the arrows, Tab and Escape are the finder's (`keys`); ⌘F again
            reaches the window (passKeys). */}
        <PromptField
          ref={field}
          className={styles.line}
          style={{ height: LINE }}
          value={query}
          onChange={setQuery}
          onSubmit={() => {}}
          onKeyDown={keys}
          passKeys
          invalid={re === 'bad'}
          label="Find"
          placeholder="find a place or a word…"
          controls="find-matches"
          active={nav.picked ? idOf(nav.picked) : undefined}
        >
          {scopes.length > 1 && (
            <span className={styles.scope}>
              <Tabs look="segments" label="Where" options={scopes.map((s) => ({ value: s, label: SCOPE_NAME[s] }))} value={scope} onChange={(s) => (setScope(s), field.current?.focus())} />
            </span>
          )}
          <span className={styles.switches}>
            {SWITCHES.map((s) => (
              <Button key={s.k} pressed={opts[s.k]} title={s.title} onClick={() => (toggleOpt(s.k), field.current?.focus())}>
                {s.label}
              </Button>
            ))}
          </span>
        </PromptField>

        <div ref={list} className={styles.list} style={{ height: shownList }} data-scrolls>
          {rows.length ? (
            <>
              <PromptList
                id="find-matches"
                className={styles.matches}
                role="listbox"
                label="Matches"
                entries={entries}
                picked={nav.picked}
                q=""
                onPick={onRow}
                onPoint={going ? setPick : NO_POINT}
                onConfirm={going ? undefined : (i) => i.onSelect({ shift: false, alt: false })}
                idOf={idOf}
              />
              {more > 0 && <Empty className={styles.more}>{`${rows.length} of ${total} shown: type more to narrow`}</Empty>}
            </>
          ) : searching ? (
            <Empty className={styles.none}>searching…</Empty>
          ) : going ? (
            <Empty className={styles.none}>{here === CANVAS ? 'nothing to go to yet' : 'nothing to go to here yet'}</Empty>
          ) : query ? (
            <Empty className={styles.none}>{re === 'bad' ? 'not a regular expression' : scope === 'here' ? 'nothing matches here' : 'nothing matches'}</Empty>
          ) : null}
        </div>

        {previewH > 0 && (
          <div className={styles.preview} style={{ height: previewH }}>
            <PreviewHead dest={previewed?.dest ?? null} zoom={zoom} onZoom={setZoom} drawing={previewed?.id !== picked?.id} />
            <FindPreview dest={previewed?.dest ?? null} re={found instanceof RegExp ? found : null} w={width - 2 - 24} h={previewH - 24 - 12} zoom={zoom} onZoom={setZoom} />
          </div>
        )}

      </Window>
      {looking && <FindBodies />}
    </>
  )
}

// Going to a match on the canvas shown.
function goRow(row: Row, ws: WorkspaceCtx) {
  const d = row.dest
  if (d.kind === 'place') return findGo({ ...(d.target ?? { kind: 'space', space: d.place.space, k: 0 }), place: d.place })
  // A kanban's task (D-261): its kanban's focus, the task picked.
  if (d.kind === 'lens' && kindOfPiece(d.piece) === 'kanban' && d.target.key?.startsWith('task:')) return goToTask(d.piece, ws.tasks, { id: d.target.key.slice(5) }, ws.pieces)
  if (d.kind === 'lens') {
    const page = d.page
    if (page !== undefined) {
      const set = { [d.piece.id]: page }
      if (kindOfPiece(d.piece) === 'documents') useDocUi.setState((s) => ({ pages: { ...s.pages, ...set } }))
      else useTableUi.setState((s) => ({ pages: { ...s.pages, ...set } }))
    }
    return findGo({ ...d.target, focus: d.piece.id })
  }
  if (d.kind === 'doc') return findGo({ ...d.target, focus: d.piece.id })
  useDocUi.setState({ readers: [d.doc.id], listHidden: false })
  findGo({ ...d.target, focus: d.list.id })
}

const ZOOM = { min: 1, max: 6, step: 1.5 }
// How long typing pauses before it's looked for; how long a pick rests before the preview draws it; rows drawn at most.
const SETTLE_MS = 160
const PREVIEW_MS = 90
const ROWS_MAX = 150
const NO_POINT = () => {}
const spaceOf = (d: Dest) => `${d.canvas ?? ''}${d.kind === 'place' ? d.place.space : d.target.space}`
const SCOPE_NAME: Record<FindScope, string> = { here: 'here', canvas: 'this canvas', everywhere: 'everywhere' }

// Over the preview: where it goes, and its zoom (`[−] 100% [+]`; a click on the number puts it back).
function PreviewHead({ dest, zoom, onZoom, drawing }: { dest: Dest | null; zoom: number; onZoom: (z: number) => void; drawing: boolean }) {
  const { documents, canvases } = useWs()
  if (!dest) return <div className={styles.previewHead} />
  const where =
    dest.kind === 'place'
      ? dest.place.space === CANVAS
        ? dest.canvas
          ? `on ${canvases.find((c) => c.id === dest.canvas)?.name ?? 'another canvas'}`
          : 'on the canvas'
        : 'in its plane'
      : dest.kind === 'reader'
        ? `${dest.doc.title} · beside ${dest.list.name || 'the documents'}`
        : dest.kind === 'doc'
          ? (documents.find((d) => d.id === dest.piece.docId)?.title ?? 'document')
          : `${dest.piece.name || KIND_NAME[kindOfPiece(dest.piece)]} · ${KIND_NAME[kindOfPiece(dest.piece)]}`
  return (
    <div className={styles.previewHead}>
      <span>
        preview{drawing && <span className={styles.drawing}> · drawing…</span>}
      </span>
      <span className={styles.previewWhere}>{where}</span>
      <ButtonGroup className={styles.zoom} label="Preview zoom">
        <Button icon disabled={zoom <= ZOOM.min} title="zoom out (wheel)" aria-label="Zoom out" onClick={() => onZoom(zoom / ZOOM.step)}>
          −
        </Button>
        <Button icon title="back to 100 %" onClick={() => onZoom(1)}>
          {Math.round(zoom * 100)}%
        </Button>
        <Button icon disabled={zoom >= ZOOM.max} title="zoom in (wheel)" aria-label="Zoom in" onClick={() => onZoom(zoom * ZOOM.step)}>
          +
        </Button>
      </ButtonGroup>
    </div>
  )
}

// Every document's text you may read, loaded while something's typed (kept for the tab), so they're found too.
const BODIES_MOST = 60
function FindBodies() {
  const { documents } = useWs()
  return (
    <>
      {documents
        .filter((d) => d.kind === 'markdown' || d.kind === 'report')
        .slice(0, BODIES_MOST)
        .map((d) => (
          <BodyOf key={d.id} d={d} />
        ))}
    </>
  )
}

function BodyOf({ d }: { d: WithId<Doc> }) {
  const { wid } = useWs()
  const body = useDocBody(wid, d)
  useEffect(() => {
    if (body.data && useBodies.getState()[d.id] !== body.data) useBodies.setState({ [d.id]: body.data })
  }, [body.data, d.id])
  return null
}
