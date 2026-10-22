// The finder (D-236): ⌘F, or the side nav's compass, anywhere in a workspace. A prompt in the middle of the screen
// (the menus' look, D-222): `> what's typed`, `[here | everywhere]`, `Aa W .*`. Opened empty it's only that line,
// in the middle; typed into, it opens out to its matches, grouped by where they are, and the preview of the one picked
// (what the screen shows once you're there), gliding as it grows so it stays in the middle. ↓ with nothing typed lists
// the places (go to, D-196). ↑ ↓ pick, Enter goes, Tab is here / everywhere, alt C W X the switches, Escape closes.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Doc, DocBody } from '../../data/documents'
import { useDocBody } from '../../data/documents'
import { CANVAS } from '../../data/labels'
import { useAuth } from '../../data/auth'
import { KIND_NAME, kindOfPiece } from '../../data/pieces'
import { useCanvasView } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { useWs } from './context'
import { closeFinder, findGo, matchesIn, openFinder, setQuery, toggleOpt, toggleScope, useFind, useMatcher, type FindOpts } from './find'
import { findGroups, folded, type Dest, type Group, type Row } from './findIndex'
import { FindPreview } from './FindPreview'
import { placesIn } from './goTo'
import { shownPieces } from './shownBox'
import { useFieldText, useTableUi } from './Table'
import { useDocUi } from './Documents'
import { TYPE_ACCENT } from './PlaneCards'
import styles from './Finder.module.css'

const SWITCHES: { k: keyof FindOpts; label: string; title: string; code: string }[] = [
  { k: 'caseSensitive', label: 'Aa', title: 'match case (alt C)', code: 'KeyC' },
  { k: 'words', label: 'W', title: 'whole words (alt W)', code: 'KeyW' },
  { k: 'regex', label: '.*', title: 'regular expression (alt X)', code: 'KeyX' },
]

// Its sizes: narrow while empty, wide with matches; the line, the foot; the list's most.
const W = { empty: 600, full: 1040 }
const LINE = 47
const FOOT = 31
const LIST_MAX = 0.3
const EDGE = 16

export function Finder() {
  const open = useFind((s) => s.open)
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
  const scope = useFind((s) => s.scope)
  const re = useMatcher()
  const size = useCanvasView((s) => s.size)
  const fieldText = useFieldText()
  const bodies = useBodies()
  const field = useRef<HTMLInputElement>(null)
  const summoned = useFinderUi((s) => s.summoned)
  // With nothing typed, ↓ lists the places (go to).
  const [browsing, setBrowsing] = useState(false)
  const [sel, setSel] = useState(0)

  useEffect(() => {
    field.current?.focus()
    field.current?.select()
  }, [summoned])

  const groups: Group[] = useMemo(() => {
    if (!query) {
      if (!browsing) return []
      const places = placesIn(here, shownPieces(ws.pieces, ws.cards), ws.labels, ws.workspace.name)
      if (!places.length) return []
      return [
        {
          space: 'places',
          title: here === CANVAS ? 'go to · on the canvas' : 'go to · in the plane',
          glyph: '⌖',
          count: places.length,
          rows: places.map((p): Row => ({ id: p.id, glyph: p.glyph, text: p.label, hint: p.inside ? 'inside' : '', dest: { kind: 'place', place: p, target: { kind: 'space', space: p.space, k: 0 } }, inside: false })),
        },
      ]
    }
    if (!(re instanceof RegExp)) return []
    const all = findGroups(
      { pieces: ws.pieces, cards: ws.cards, labels: ws.labels, cells: ws.cells, documents: ws.documents, bodies, workspace: ws.workspace, me: user?.id, fieldText, room: size },
      re,
      here,
    )
    // Pieces by their names, as places, first.
    const named = shownPieces(ws.pieces, ws.cards).filter((p) => p.name && matchesIn(p.name, re, 1).length)
    const places: Group[] = named.length
      ? [
          {
            space: 'places',
            title: 'places',
            glyph: '⌖',
            count: named.length,
            rows: named.map((p): Row => {
              const kind = kindOfPiece(p)
              const name = p.name ?? ''
              const place = { id: p.id, space: CANVAS, label: name, glyph: '▦', box: p, whole: true }
              return { id: `piece:${p.id}`, glyph: '⌖', text: name, hint: KIND_NAME[kind], dest: { kind: 'place', place, target: { kind: 'space', space: CANVAS, key: `${kind === 'plane' ? 'plane' : kind}:${p.id}`, k: 0 } } }
            }),
          },
        ]
      : []
    return [...places, ...(scope === 'here' ? folded(all, here) : all)]
  }, [query, browsing, re, scope, here, ws, bodies, user?.id, fieldText, size])

  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups])
  const total = groups.reduce((s, g) => s + (g.space === 'places' ? 0 : g.count), 0)
  const at = Math.min(sel, Math.max(0, rows.length - 1))
  const picked = rows[at] ?? null
  useEffect(() => setSel(0), [query, scope, opts, browsing])

  const go = (row: Row | null) => {
    if (!row) return
    const d = row.dest
    if (d.kind === 'place') return findGo({ ...(d.target ?? { kind: 'space', space: d.place.space, k: 0 }), place: d.place })
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
  }, [rows.length > 0])
  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth
  const vh = typeof window === 'undefined' ? 900 : window.innerHeight
  const full = rows.length > 0 || (!!query && !rows.length)
  const width = Math.min(full ? W.full : W.empty, vw - 2 * EDGE)
  const shownList = rows.length ? Math.min(listH, Math.round(vh * LIST_MAX)) : query ? 52 : 0
  const previewH = rows.length ? Math.max(160, Math.min(Math.round((width * size.h) / Math.max(1, size.w)), vh - 2 * EDGE - LINE - FOOT - shownList - 2)) : 0
  const height = LINE + shownList + (previewH ? previewH + 1 : 0) + FOOT

  // The picked row kept in sight in the list.
  useEffect(() => {
    list.current?.querySelector('[data-picked]')?.scrollIntoView({ block: 'nearest' })
  }, [at])

  const keys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      return closeFinder()
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!query && !browsing && e.key === 'ArrowDown') return setBrowsing(true)
      const n = rows.length
      if (n) setSel((at + (e.key === 'ArrowDown' ? 1 : -1) + n) % n)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      return go(picked)
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      return toggleScope()
    }
    const sw = e.altKey && SWITCHES.find((s) => s.code === e.code)
    if (sw) {
      e.preventDefault()
      toggleOpt(sw.k)
    }
  }

  let i = 0
  return (
    <>
      <div className={styles.shade} onPointerDown={closeFinder} aria-hidden />
      <div
        className={styles.finder}
        role="dialog"
        aria-label="Find"
        data-full={full || undefined}
        data-reduced={isReducedMotion() || undefined}
        style={{ width, height }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <label className={styles.line} style={{ height: LINE }}>
          <span className={styles.sign} aria-hidden>
            &gt;
          </span>
          <input
            ref={field}
            className={styles.field}
            value={query}
            placeholder="find a place or a word…"
            aria-label="Find"
            spellCheck={false}
            autoComplete="off"
            data-bad={re === 'bad' || undefined}
            onChange={(e) => {
              setQuery(e.target.value)
              if (!e.target.value) setBrowsing(false)
            }}
            onKeyDown={keys}
          />
          <span className={styles.scope} role="group" aria-label="Where">
            {(['here', 'everywhere'] as const).map((s) => (
              <button key={s} className={styles.seg} aria-pressed={scope === s} onClick={() => (scope !== s && toggleScope(), field.current?.focus())}>
                {s}
              </button>
            ))}
          </span>
          <span className={styles.switches}>
            {SWITCHES.map((s) => (
              <button key={s.k} className={styles.tool} aria-pressed={opts[s.k]} title={s.title} onClick={() => (toggleOpt(s.k), field.current?.focus())}>
                {s.label}
              </button>
            ))}
          </span>
        </label>

        <div ref={list} className={styles.list} style={{ height: shownList }} role="listbox" aria-label="Matches">
          {rows.length ? (
            <div>
              {groups.map((g) => (
                <Fragment key={g.space}>
                  <div className={styles.group}>
                    <span>
                      <span className={styles.hash}>#</span> {g.title}
                    </span>
                    <span className={styles.count}>{g.count}</span>
                  </div>
                  {g.rows.map((r) => {
                    const me = i++
                    return (
                      <div
                        key={r.id}
                        className={styles.row}
                        role="option"
                        aria-selected={me === at}
                        data-picked={me === at || undefined}
                        data-inside={r.inside || undefined}
                        onPointerMove={() => me !== at && setSel(me)}
                        onClick={() => go(r)}
                      >
                        <span className={styles.caret} aria-hidden>
                          ›
                        </span>
                        <span className={styles.glyph} style={r.tone ? { color: TYPE_ACCENT[r.tone as keyof typeof TYPE_ACCENT] } : undefined}>
                          {r.glyph}
                        </span>
                        <span className={styles.text}>{r.inside || !(re instanceof RegExp) ? r.text : marked(r.text, re)}</span>
                        <span className={styles.hint}>{r.hint}</span>
                      </div>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          ) : query ? (
            <p className={styles.none}>{re === 'bad' ? 'not a regular expression' : scope === 'here' ? 'nothing matches here' : 'nothing matches'}</p>
          ) : null}
        </div>

        {previewH > 0 && (
          <div className={styles.preview} style={{ height: previewH }}>
            <PreviewHead dest={picked?.dest ?? null} />
            <FindPreview dest={picked?.dest ?? null} re={re instanceof RegExp ? re : null} box={{ w: width - 2 - 24, h: previewH - 24 - 12 }} />
          </div>
        )}

        <div className={styles.foot} style={{ height: FOOT }}>
          <span>
            <b>↑↓</b> pick · <b>enter</b> go there · <b>⇥</b> here / everywhere · <b>esc</b>
            {!query && !browsing && (
              <>
                {' '}
                · <b>↓</b> places
              </>
            )}
          </span>
          <span>{query && re instanceof RegExp ? `${total} ${total === 1 ? 'match' : 'matches'} · ${scope}` : ''}</span>
        </div>
      </div>
      {query && <FindBodies />}
    </>
  )
}

// Over the preview: where it goes.
function PreviewHead({ dest }: { dest: Dest | null }) {
  const { documents } = useWs()
  if (!dest) return <div className={styles.previewHead} />
  const where =
    dest.kind === 'place'
      ? dest.place.space === CANVAS
        ? 'on the canvas'
        : 'in its plane'
      : dest.kind === 'reader'
        ? `${dest.doc.title} · beside ${dest.list.name || 'the documents'}`
        : dest.kind === 'doc'
          ? (documents.find((d) => d.id === dest.piece.docId)?.title ?? 'document')
          : `${dest.piece.name || KIND_NAME[kindOfPiece(dest.piece)]} · ${KIND_NAME[kindOfPiece(dest.piece)]}`
  return (
    <div className={styles.previewHead}>
      <span>preview</span>
      <span className={styles.previewWhere}>{where}</span>
    </div>
  )
}

// The text of a row with its matches marked.
function marked(text: string, re: RegExp): ReactNode {
  const out: ReactNode[] = []
  let last = 0
  for (const [a, b] of matchesIn(text, re, 50)) {
    out.push(text.slice(last, a), <mark key={a} className={styles.hit}>{text.slice(a, b)}</mark>)
    last = b
  }
  out.push(text.slice(last))
  return out
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
