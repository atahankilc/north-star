// The `?` guide (D-315, onboarding.md §4.6): every note again, in the middle like the finder (its twin: the prompt look,
// D-222, the scrim, magenta top corners). A `>` line narrows; `# start` replays the welcome and what's new; `# areas`,
// each with `n / N seen`, `NEW` while one of its notes is armed, folding with `[▸ N inside]` (→ or ↵ opens, ← folds),
// each note `› ✓ title · its first line` (✓ seen, • not yet), ↵ plays it (`onPlay`, the coach's queue.play); `# keys`
// folds the same way; `tips on | off` on the `>` line (⇥ switches it). At most the screen less 48 px top and bottom, the
// list scrolling inside. Focus is in its field while it's open (the coach gives it back on close); esc or a press on
// the scrim closes it.
//
// Three looks while the user picks (Q-028, `useLook('guide')`): a, the finder's twin (a list); b, the list and a preview
// of the note under the keys (its demo and first page); c, the map (every area a column in the deck's ledger look, the
// keys a sheet of keycaps).
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Appear } from '../ui/Appear'
import { Demo } from './Demo'
import { guideModel, guideRows, hasNew, keyLesson, parentOf, step, type AreaInfo, type GuideModel, type Note, type Row, type StartRow } from './guideModel'
import type { KeyRow } from './keys'
import { lessonById, type Role } from './lessons'
import { useLook } from './looks'
import { useProgress } from './progress'
import styles from './Guide.module.css'

type Props = {
  onClose: () => void
  onPlay: (lessonId: string) => void
  // This person's role here, to list only their notes (none: every note; the workspaces page).
  role?: Role | null
  // A lesson showing beside something right now (onboarding.md §3.1.9): listed first, ↵ goes to it (`onReach`).
  now?: { title: string } | null
  onReach?: () => void
  // Opened again from a played note's `‹ guide`: where it was (the area open, the row picked).
  resume?: boolean
}

// Where the guide was when a note was played from it, for `‹ guide` (this tab, this session).
let lastList: { open: string | null; selKey: string | null } | null = null
let lastMap: { col: number; i: number } | null = null

// `whats-new` and `welcome` are what `# start` plays: the coach knows both (welcome is a lesson; what's new its own).
export const WHATS_NEW = 'whats-new'

// Keys pressed anywhere in the guide stay in it (the canvas's and the app's own never hear them), except `?`, which the
// coach hears to close it.
const keepKeys = (e: React.KeyboardEvent) => void (e.key !== '?' && e.stopPropagation())

// The magenta dot on the side nav's `?` (O6): something armed is still unseen.
export function useGuideDot(): boolean {
  const seen = useProgress((s) => s.seen)
  const armed = useProgress((s) => s.armed)
  return useMemo(() => hasNew({ seen, armed }), [seen, armed])
}

function useModel(role: Role | null): GuideModel {
  const seen = useProgress((s) => s.seen)
  const armed = useProgress((s) => s.armed)
  const welcome = useProgress((s) => s.welcome)
  return useMemo(() => guideModel({ seen, armed, welcome }, role), [seen, armed, welcome, role])
}

export function Guide({ onClose, onPlay, role = null, now = null, onReach, resume = false }: Props) {
  const look = useLook('guide')
  const model = useModel(role)
  const reach = now && onReach ? { title: now.title, go: onReach } : null
  return createPortal(
    <>
      <div className={styles.scrim} data-coach onPointerDown={onClose} aria-hidden />
      {look === 'c' ? (
        <MapGuide model={model} onClose={onClose} onPlay={onPlay} reach={reach} resume={resume} />
      ) : (
        <ListGuide model={model} look={look} onClose={onClose} onPlay={onPlay} reach={reach} resume={resume} />
      )}
    </>,
    document.body,
  )
}

// `code` in a lesson's words, as the app writes keys.
function Words({ text }: { text: string }) {
  const parts = text.split('`')
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <code key={i} className={styles.k}>
            {p}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}

// The `>` line: the field and the tips switch.
function Line({ field, query, setQuery, onKeyDown }: { field: React.RefObject<HTMLInputElement | null>; query: string; setQuery: (q: string) => void; onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void }) {
  const tipsOff = useProgress((s) => s.tipsOff)
  const setTipsOff = useProgress((s) => s.setTipsOff)
  const set = (off: boolean) => {
    setTipsOff(off)
    field.current?.focus()
  }
  return (
    <label className={styles.line}>
      <span className={styles.sign} aria-hidden>
        &gt;
      </span>
      <input
        ref={field}
        className={styles.field}
        value={query}
        placeholder="find a note or a key…"
        aria-label="Find a note or a key"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <span className={styles.tipsLabel}>tips</span>
      <span className={styles.seg} role="group" aria-label="Tips (⇥ switches)">
        <button type="button" tabIndex={-1} aria-pressed={!tipsOff} onMouseDown={(e) => e.preventDefault()} onClick={() => set(false)}>
          on
        </button>
        <button type="button" tabIndex={-1} aria-pressed={tipsOff} onMouseDown={(e) => e.preventDefault()} onClick={() => set(true)}>
          off
        </button>
      </span>
    </label>
  )
}

// Focus in the field on open; the rest of the keys the guide's own.
function useField() {
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const raf = requestAnimationFrame(() => field.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [])
  return field
}

const toggleTips = () => {
  const s = useProgress.getState()
  s.setTipsOff(!s.tipsOff)
}

// ↓ below the fold: how many areas (and whether the keys) are still under the list's bottom.
function useBelow(list: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  const [below, setBelow] = useState<{ areas: string[]; keys: boolean } | null>(null)
  useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    const measure = () => {
      const bottom = el.scrollTop + el.clientHeight
      if (el.scrollHeight - bottom < 4) return setBelow(null)
      const under = [...el.querySelectorAll<HTMLElement>('[data-below]')].filter((r) => r.offsetTop >= bottom - 4)
      setBelow({ areas: under.filter((r) => r.dataset.below !== 'keys').map((r) => r.dataset.below!), keys: under.some((r) => r.dataset.below === 'keys') })
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return below
}

function belowLine(b: { areas: string[]; keys: boolean }, map = false) {
  if (map) return `↓ scrolls: ${[...b.areas, ...(b.keys ? ['keys'] : [])].join(' · ')}`
  const n = b.areas.length
  const parts = [n ? `${n} more ${n === 1 ? 'area' : 'areas'}` : '', b.keys ? '# keys' : ''].filter(Boolean)
  return `↓ the list scrolls${parts.length ? `: ${parts.join(' and ')} below` : ''}`
}

// ── a and b: the list (b with its preview) ───────────────────────────────────────────────────────────────────────────
function ListGuide({ model, look, onClose, onPlay, reach, resume }: { model: GuideModel; look: 'a' | 'b'; onClose: () => void; onPlay: (id: string) => void; reach: Reach; resume: boolean }) {
  const field = useField()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(() => (resume ? (lastList?.open ?? null) : null))
  const rows = useMemo(() => guideRows(model, open, query), [model, open, query])
  const [selKey, setSelKey] = useState<string | null>(() => (resume ? (lastList?.selKey ?? null) : null))
  // On the `# showing now` row (first, while a lesson shows and nothing is typed).
  const [onNow, setOnNow] = useState(!!reach && !resume)
  const nowShown = !!reach && !query.trim()
  useEffect(() => {
    lastList = { open, selKey }
  }, [open, selKey])
  // What's picked: kept by key while the rows change; typed, the first note (else the first row).
  const at = useMemo(() => {
    const i = selKey ? rows.findIndex((r) => r.key === selKey) : -1
    if (i >= 0) return i
    if (query.trim()) {
      const n = rows.findIndex((r) => r.kind === 'note' || r.kind === 'key')
      if (n >= 0) return n
    }
    return step(rows, -1, 1)
  }, [rows, selKey, query])
  const nowPicked = nowShown && onNow
  const picked = nowPicked ? null : (rows[at] ?? null)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    list.current?.querySelector('[data-picked]')?.scrollIntoView({ block: 'nearest' })
  }, [at, rows, nowPicked])
  const below = useBelow(list, [rows])

  const toggle = (key: string) => setOpen((o) => (o === key ? null : key))
  const foldKey = (r: Row) => (r.kind === 'area' ? r.area.area : r.kind === 'keys' ? 'keys' : null)
  const act = (r: Row | null) => {
    if (!r) return
    if (r.kind === 'area' || r.kind === 'keys') {
      if (!query.trim()) toggle(foldKey(r)!)
      setSelKey(r.key)
    } else if (r.kind === 'note') onPlay(r.note.id)
    else if (r.kind === 'start' && !r.start.off) onPlay(r.start.id === 'welcome' ? 'welcome' : WHATS_NEW)
    else if (r.kind === 'key') {
      const l = keyLesson(model, r.row)
      if (l) onPlay(l)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // The canvas's own keys (0, t, c, Delete) never hear these.
    e.stopPropagation()
    const typed = !!query.trim()
    if (e.key === 'Escape') return (e.preventDefault(), onClose())
    if (nowPicked) {
      if (e.key === 'Enter') return (e.preventDefault(), reach!.go())
      if (e.key === 'ArrowDown') return (e.preventDefault(), setOnNow(false))
      if (e.key === 'ArrowUp') return e.preventDefault()
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const j = step(rows, at, e.key === 'ArrowDown' ? 1 : -1)
      // Up from the first row: back to what's showing now.
      if (e.key === 'ArrowUp' && nowShown && (j < 0 || j === at)) return setOnNow(true)
      if (j >= 0) setSelKey(rows[j].key)
      return
    }
    if (e.key === 'Enter') return (e.preventDefault(), act(picked))
    if (e.key === 'Tab') return (e.preventDefault(), toggleTips())
    if (!picked || typed) return
    // → / ← open and fold (the caret stays put in the field only when nothing is typed: typed, they move it).
    if (e.key === 'ArrowRight' && (picked.kind === 'area' || picked.kind === 'keys') && !picked.open) return (e.preventDefault(), setOpen(foldKey(picked)))
    if (e.key === 'ArrowLeft') {
      if ((picked.kind === 'area' || picked.kind === 'keys') && picked.open) return (e.preventDefault(), setOpen(null))
      const p = parentOf(rows, at)
      if (p >= 0 && p !== at) {
        e.preventDefault()
        setSelKey(rows[p].key)
        setOpen(null)
      }
    }
  }

  return (
    <Appear
      className={styles.guide}
      data-look={look}
      role="dialog"
      aria-modal="true"
      aria-label="Guide: every note again"
      data-coach
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      onKeyDown={keepKeys}
    >
      <Line field={field} query={query} setQuery={(q) => (setQuery(q), setSelKey(null))} onKeyDown={onKeyDown} />
      <div className={styles.body}>
        <div ref={list} className={styles.list} role="listbox" aria-label="Notes and keys">
          {nowShown && <NowRow reach={reach!} picked={nowPicked} onClick={() => reach!.go()} />}
          {rows.length === 0 && <p className={styles.none}>nothing matches · esc closes</p>}
          {rows.map((r, i) => (
            <RowView
              key={r.key}
              row={r}
              model={model}
              picked={!nowPicked && i === at}
              typed={!!query.trim()}
              onClick={() => {
                setOnNow(false)
                setSelKey(r.key)
                field.current?.focus()
                // b: a click previews, a double-click (or ↵) plays; a: a click is ↵. A fold always opens or shuts.
                if (look === 'a' || r.kind === 'area' || r.kind === 'keys') act(r)
              }}
              onDoubleClick={look === 'b' && r.kind !== 'area' && r.kind !== 'keys' ? () => act(r) : undefined}
              onFold={() => (toggle(foldKey(r)!), setSelKey(r.key), field.current?.focus())}
            />
          ))}
        </div>
        {look === 'b' && <Preview row={picked} model={model} onPlay={() => act(picked)} />}
      </div>
      {below && <div className={styles.more}>{belowLine(below)}</div>}
      <div className={styles.foot}>
        <span>
          <b>→ ↵</b> open · <b>←</b> fold · <b>↵</b> on a note plays it · <b>⇥</b> tips · <b>esc</b>
        </span>
        <span className={styles.sp} />
        <span>
          {model.total} notes · {model.seen} seen
        </span>
      </div>
    </Appear>
  )
}

type Reach = { title: string; go: () => void } | null

// The lesson showing right now, first: `↵` goes to it (focus in its card, where its keys work).
function NowRow({ reach, picked, onClick }: { reach: NonNullable<Reach>; picked: boolean; onClick: () => void }) {
  return (
    <>
      <div className={styles.hd} role="presentation">
        <span className={styles.hash}>#</span> showing now
      </div>
      <div className={styles.it} role="option" aria-selected={picked} data-picked={picked || undefined} data-now onClick={onClick}>
        <span className={styles.cur} aria-hidden>
          ›
        </span>
        <span className={styles.st} aria-hidden>
          ◆
        </span>
        <span className={styles.title}>{reach.title}</span>
        <span className={styles.dot}>·</span>
        <span className={styles.what}>↵ goes to it</span>
      </div>
    </>
  )
}

function Status({ seen }: { seen: boolean }) {
  return (
    <span className={styles.st} data-seen={seen || undefined} aria-label={seen ? 'seen' : 'not seen yet'}>
      {seen ? '✓' : '•'}
    </span>
  )
}

const New = () => <span className={styles.new}>NEW</span>

function RowView({ row: r, model, picked, typed, onClick, onDoubleClick, onFold }: { row: Row; model: GuideModel; picked: boolean; typed: boolean; onClick: () => void; onDoubleClick?: () => void; onFold: () => void }) {
  if (r.kind === 'head') {
    return (
      <div className={styles.hd} role="presentation">
        <span className={styles.hash}>#</span> {r.title}
        {r.count && <span className={styles.cnt}>{r.count}</span>}
      </div>
    )
  }
  const common = {
    className: styles.it,
    role: 'option',
    'aria-selected': picked,
    'data-picked': picked || undefined,
    onClick,
    onDoubleClick,
  }
  const cur = (
    <span className={styles.cur} aria-hidden>
      ›
    </span>
  )
  if (r.kind === 'start') {
    const s: StartRow = r.start
    return (
      <div {...common} data-off={s.off || undefined}>
        {cur}
        <Status seen={s.seen} />
        <span className={styles.title}>{s.title}</span>
        <span className={styles.dot}>·</span>
        <span className={styles.what}>{s.line}</span>
        {s.isNew && <New />}
      </div>
    )
  }
  if (r.kind === 'area' || r.kind === 'keys') {
    const a: AreaInfo | null = r.kind === 'area' ? r.area : null
    const count = r.kind === 'keys' ? `${r.shown} keys` : `${a!.notes.length} inside`
    return (
      <div {...common} data-fold data-open={r.open || undefined} data-below={a ? a.name : 'keys'} aria-expanded={r.open}>
        {cur}
        <span className={styles.st} aria-hidden>
          {r.open ? '▾' : '▸'}
        </span>
        <span className={styles.title}>{a ? a.name : 'every shortcut'}</span>
        <span className={styles.what}>{a ? `${a.seen} / ${a.notes.length} seen` : ''}</span>
        {a?.isNew && <New />}
        {!typed && (
          <button
            type="button"
            tabIndex={-1}
            className={styles.fold}
            aria-hidden
            title={r.open ? 'fold (←)' : 'open (→)'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => (e.stopPropagation(), onFold())}
          >
            {r.open ? '▾' : '▸'} {count}
          </button>
        )}
      </div>
    )
  }
  if (r.kind === 'note') {
    const n: Note = r.note
    return (
      <div {...common} data-ind>
        {cur}
        <Status seen={n.seen} />
        <span className={styles.title}>{n.title}</span>
        <span className={styles.dot}>·</span>
        <span className={styles.what}>{n.line.replace(/`/g, '')}</span>
        {n.isNew && <New />}
      </div>
    )
  }
  const k: KeyRow = r.row
  const plays = !!keyLesson(model, k)
  return (
    <div {...common} data-ind data-key-row>
      {cur}
      <kbd className={styles.kbd}>{k.keys}</kbd>
      <span className={styles.title}>{k.what}</span>
      {k.where && (
        <>
          <span className={styles.dot}>·</span>
          <span className={styles.what}>{k.where}</span>
        </>
      )}
      {plays && picked && <span className={styles.hint}>↵ its note</span>}
    </div>
  )
}

// b · what the row under the keys says: a note's demo and first page, an area's count, a key's line.
function Preview({ row, model, onPlay }: { row: Row | null; model: GuideModel; onPlay: () => void }) {
  let inner: ReactNode = null
  if (row?.kind === 'note' || row?.kind === 'start') {
    const id = row.kind === 'note' ? row.note.id : row.start.id
    const note = row.kind === 'note' ? row.note : null
    const welcome = id === 'welcome' ? lessonById('welcome') : null
    const first = welcome && welcome.format === 'welcome' ? welcome.pages.find((p) => !p.audience || p.audience === 'new') : null
    const title = note?.title ?? first?.title ?? (row.kind === 'start' ? row.start.title : '')
    const body = note?.body ?? first?.body ?? (row.kind === 'start' ? row.start.line : '')
    const scene = note?.scene ?? first?.scene
    const pages = note?.pages ?? (welcome && welcome.format === 'welcome' ? 4 : 1)
    const off = row.kind === 'start' && row.start.off
    inner = (
      <>
        <div className={styles.pg}>
          <span className={styles.lab}>
            {row.kind === 'note' ? id.replace(/-/g, ' ') : row.start.title} · {pages} {pages === 1 ? 'page' : 'pages'}
          </span>
          <span className={styles.sp} />
          {Array.from({ length: Math.min(pages, 4) }, (_, i) => (
            <span key={i} data-on={i === 0 || undefined}>
              {String(i + 1).padStart(2, '0')}
            </span>
          ))}
        </div>
        {scene ? (
          <Demo scene={scene} width={PREVIEW_W - 24} />
        ) : (
          <div className={styles.noDemo}>
            <span>words only</span>
          </div>
        )}
        <h4 className={styles.pvTitle}>{title}</h4>
        <p className={styles.pvBody}>
          <Words text={body} />
        </p>
        <span className={styles.sp} />
        {!off && (
          <button type="button" tabIndex={-1} className={styles.play} onMouseDown={(e) => e.preventDefault()} onClick={onPlay}>
            ↵ play here
          </button>
        )}
      </>
    )
  } else if (row?.kind === 'area') {
    const a = row.area
    inner = (
      <>
        <div className={styles.pg}>
          <span className={styles.lab}>area · {a.notes.length} notes</span>
        </div>
        <h4 className={styles.pvTitle}>{a.name}</h4>
        <p className={styles.pvBody}>
          {a.seen} of {a.notes.length} seen{a.isNew ? ', and something new' : ''}.
        </p>
        <div className={styles.bar} aria-hidden>
          {a.notes.map((n) => (
            <i key={n.id} data-on={n.seen || undefined} data-new={n.isNew || undefined} />
          ))}
        </div>
        <ul className={styles.pvList}>
          {a.notes.slice(0, 8).map((n) => (
            <li key={n.id}>
              <Status seen={n.seen} /> {n.title}
            </li>
          ))}
          {a.notes.length > 8 && <li className={styles.dim}>+ {a.notes.length - 8} more</li>}
        </ul>
        <span className={styles.sp} />
        <span className={styles.lab}>{row.open ? '← folds it' : '→ or ↵ opens it'}</span>
      </>
    )
  } else if (row?.kind === 'keys' || row?.kind === 'key') {
    const k = row.kind === 'key' ? row.row : null
    inner = k ? (
      <>
        <div className={styles.pg}>
          <span className={styles.lab}>key{k.where ? ` · ${k.where}` : ''}</span>
        </div>
        <kbd className={styles.bigKey}>{k.keys}</kbd>
        <p className={styles.pvBody}>{k.what}</p>
        <span className={styles.sp} />
        {keyLesson(model, k) && (
          <button type="button" tabIndex={-1} className={styles.play} onMouseDown={(e) => e.preventDefault()} onClick={onPlay}>
            ↵ its note
          </button>
        )}
      </>
    ) : (
      <>
        <div className={styles.pg}>
          <span className={styles.lab}>keys · {model.keys.length}</span>
        </div>
        <h4 className={styles.pvTitle}>Every shortcut</h4>
        <p className={styles.pvBody}>As the app writes them. Type a key or a word to find one.</p>
      </>
    )
  }
  return <div className={styles.preview}>{inner}</div>
}

const PREVIEW_W = 330

// ── c: the map ───────────────────────────────────────────────────────────────────────────────────────────────────────
type Cell =
  | { kind: 'start'; key: string; start: StartRow }
  | { kind: 'note'; key: string; note: Note }
  | { kind: 'key'; key: string; row: KeyRow }
  | { kind: 'more'; key: string; col: string; n: number }
type Col = { id: string; title: string; seen: number; total: number; bar: { on: boolean; isNew: boolean }[]; cells: Cell[]; keys?: boolean }

// Shown per column before `+ N more` (the keys: one line of caps).
const SHOWN = 5
const SHOWN_KEYS = 11

function mapCols(model: GuideModel, q: string, wide: string[]): Col[] {
  const typed = q.trim().toLowerCase()
  const has = (s: string) =>
    typed
      .split(/\s+/)
      .filter(Boolean)
      .every((w) => s.toLowerCase().includes(w))
  const cut = (id: string, cells: Cell[], most: number): Cell[] =>
    typed || wide.includes(id) || cells.length <= most ? cells : [...cells.slice(0, most - 1), { kind: 'more', key: `more:${id}`, col: id, n: cells.length - (most - 1) }]
  const start = model.start.filter((s) => !typed || has(`${s.title} ${s.line}`))
  const cols: Col[] = []
  if (start.length)
    cols.push({
      id: 'start',
      title: 'start',
      seen: model.start.filter((s) => s.seen && !s.off).length,
      total: model.start.filter((s) => !s.off).length,
      bar: model.start.filter((s) => !s.off).map((s) => ({ on: s.seen, isNew: s.isNew })),
      cells: start.map((s) => ({ kind: 'start', key: `s:${s.id}`, start: s })),
    })
  for (const a of model.areas) {
    const notes = a.notes.filter((n) => !typed || has(`${n.title} ${n.body} ${a.name}`.replace(/`/g, '')))
    if (!notes.length) continue
    cols.push({
      id: a.area,
      title: a.name,
      seen: a.seen,
      total: a.notes.length,
      bar: a.notes.map((n) => ({ on: n.seen, isNew: n.isNew })),
      cells: cut(a.area, notes.map((n) => ({ kind: 'note', key: `n:${n.id}`, note: n })), SHOWN),
    })
  }
  const keys = model.keys.filter((k) => !typed || has(`${k.keys} ${k.what} ${k.where ?? ''} keys`))
  if (keys.length)
    cols.push({ id: 'keys', title: 'keys', seen: 0, total: model.keys.length, bar: [], keys: true, cells: cut('keys', keys.map((k, i) => ({ kind: 'key', key: `k:${i}`, row: k })), SHOWN_KEYS) })
  return cols
}

// The map is four columns wide; the keys span them all.
const ACROSS = 4

function MapGuide({ model, onClose, onPlay, reach, resume }: { model: GuideModel; onClose: () => void; onPlay: (id: string) => void; reach: Reach; resume: boolean }) {
  const field = useField()
  const [query, setQuery] = useState('')
  const [wide, setWide] = useState<string[]>([])
  const cols = useMemo(() => mapCols(model, query, wide), [model, query, wide])
  const [sel, setSel] = useState<{ col: number; i: number }>(() => (resume && lastMap ? lastMap : { col: 0, i: 0 }))
  const [onNow, setOnNow] = useState(!!reach && !resume)
  const nowPicked = !!reach && !query.trim() && onNow
  useEffect(() => {
    lastMap = sel
  }, [sel])
  const c = Math.min(sel.col, cols.length - 1)
  const i = Math.max(0, Math.min(sel.i, (cols[c]?.cells.length ?? 1) - 1))
  const picked = cols[c]?.cells[i] ?? null
  const grid = useRef<HTMLDivElement>(null)
  useEffect(() => {
    grid.current?.querySelector('[data-picked]')?.scrollIntoView({ block: 'nearest' })
  }, [c, i, cols])
  const below = useBelow(grid, [cols])

  const act = (cell: Cell | null) => {
    if (!cell) return
    if (cell.kind === 'note') onPlay(cell.note.id)
    else if (cell.kind === 'start' && !cell.start.off) onPlay(cell.start.id === 'welcome' ? 'welcome' : WHATS_NEW)
    else if (cell.kind === 'key') {
      const l = keyLesson(model, cell.row)
      if (l) onPlay(l)
    } else if (cell.kind === 'more') setWide((w) => [...w, cell.col])
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === 'Escape') return (e.preventDefault(), onClose())
    if (nowPicked) {
      if (e.key === 'Enter') return (e.preventDefault(), reach!.go())
      // Any arrow leaves it for the map.
      if (e.key.startsWith('Arrow')) return (e.preventDefault(), setOnNow(false))
    }
    if (e.key === 'Enter') return (e.preventDefault(), act(picked))
    if (e.key === 'Tab') return (e.preventDefault(), toggleTips())
    if (!cols.length) return
    const col = cols[c]
    const n = col.cells.length
    const isKeys = !!col.keys
    // ← → across columns (in the keys, along them), ↑ ↓ down a column, then on to the column under or over it.
    const typedLeftRight = !!query && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
    if (typedLeftRight && !isKeys) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const by = e.key === 'ArrowRight' ? 1 : -1
      if (isKeys) return setSel({ col: c, i: Math.max(0, Math.min(n - 1, i + by)) })
      const next = Math.max(0, Math.min(cols.length - 1, c + by))
      return setSel({ col: next, i })
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const by = e.key === 'ArrowDown' ? 1 : -1
      if (i + by >= 0 && i + by < n) return setSel({ col: c, i: i + by })
      // Off the end: the column under (or over) this one in the grid; the keys come after them all.
      const areas = cols.filter((x) => !x.keys).length
      let next = c + by * ACROSS
      if (isKeys && by < 0) next = Math.max(0, areas - 1)
      else if (next >= areas && by > 0) next = cols.length - 1
      if (next < 0 || next >= cols.length || next === c) return
      setSel({ col: next, i: by > 0 ? 0 : cols[next].cells.length - 1 })
    }
  }

  return (
    <Appear className={styles.guide} data-look="c" data-coach role="dialog" aria-modal="true" aria-label="Guide: every note again" onPointerDown={(e: React.PointerEvent) => e.stopPropagation()} onKeyDown={keepKeys}>
      <Line field={field} query={query} setQuery={(q) => (setQuery(q), setSel({ col: 0, i: 0 }))} onKeyDown={onKeyDown} />
      {!!reach && !query.trim() && (
        <div className={styles.nowMap} role="listbox" aria-label="Showing now">
          <NowRow reach={reach} picked={nowPicked} onClick={() => reach.go()} />
        </div>
      )}
      <div ref={grid} className={styles.cols} role="listbox" aria-label="Notes and keys">
        {cols.length === 0 && <p className={styles.none}>nothing matches · esc closes</p>}
        {cols.map((col, ci) => (
          <div key={col.id} className={styles.col} data-keys={col.keys || undefined} data-below={col.keys ? 'keys' : `${String(ci + 1).padStart(2, '0')} ${col.title}`}>
            <div className={styles.ch}>
              <span className={styles.num}>{String(ci + 1).padStart(2, '0')}</span>
              {col.title}
              <span className={styles.rl} />
              <span className={styles.c}>{col.keys ? col.total : `${col.seen}/${col.total}`}</span>
            </div>
            {!col.keys && (
              <div className={styles.bar} aria-hidden>
                {col.bar.map((b, k) => (
                  <i key={k} data-on={b.on || undefined} data-new={b.isNew || undefined} />
                ))}
              </div>
            )}
            <div className={col.keys ? styles.keys : undefined}>
              {col.cells.map((cell, k) => {
                const on = !nowPicked && ci === c && k === i
                const props = {
                  role: 'option',
                  'aria-selected': on,
                  'data-picked': on || undefined,
                  onClick: () => (setSel({ col: ci, i: k }), field.current?.focus(), act(cell)),
                }
                if (cell.kind === 'more')
                  return (
                    <div key={cell.key} {...props} className={styles.r} data-dim>
                      + {cell.n} more
                    </div>
                  )
                if (cell.kind === 'key')
                  return (
                    <span key={cell.key} {...props} className={styles.keyCap}>
                      <kbd className={styles.kbd}>{cell.row.keys}</kbd> {cell.row.what}
                    </span>
                  )
                const s = cell.kind === 'note' ? cell.note : cell.start
                return (
                  <div key={cell.key} {...props} className={styles.r} data-off={(cell.kind === 'start' && cell.start.off) || undefined}>
                    <Status seen={s.seen} />
                    <span className={styles.rTitle}>{s.title}</span>
                    {s.isNew && <span className={styles.newText}>NEW</span>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {below && <div className={styles.more}>{belowLine(below, true)}</div>}
      <div className={styles.foot}>
        <span>
          <b>arrows</b> move · <b>↵</b> plays it · type to find · <b>⇥</b> tips · <b>esc</b>
        </span>
        <span className={styles.sp} />
        <span>
          {model.total} notes · {model.seen} seen
        </span>
      </div>
    </Appear>
  )
}
