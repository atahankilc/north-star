// The `?` guide (D-315, onboarding.md §4.6): every note again, in the middle like the finder (its twin: the prompt look,
// D-222, the scrim, magenta top corners). A `>` line narrows; `# start` replays the welcome and what's new; `# areas`,
// each with `n / N seen`, `NEW` while one of its notes is armed, folding with `[▸ N inside]` (→ or ↵ opens, ← folds),
// each note `› ✓ title · its first line` (✓ seen, • not yet), ↵ plays it (`onPlay`, the coach's queue.play); `# keys`
// folds the same way; `tips on | off` on the `>` line (⇥ switches it). At most the screen less 48 px top and bottom, the
// list scrolling inside. Focus is in its field while it's open (the coach gives it back on close); esc or a press on
// the scrim closes it.
//
// The finder's twin, a list (D-316).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Appear } from '../ui/Appear'
import { guideModel, guideRows, hasNew, keyLesson, parentOf, step, type AreaInfo, type GuideModel, type Note, type Row, type StartRow } from './guideModel'
import type { KeyRow } from './keys'
import type { Role } from './lessons'
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
  const model = useModel(role)
  const reach = now && onReach ? { title: now.title, go: onReach } : null
  return createPortal(
    <>
      <div className={styles.scrim} data-coach onPointerDown={onClose} aria-hidden />
      <ListGuide model={model} onClose={onClose} onPlay={onPlay} reach={reach} resume={resume} />
    </>,
    document.body,
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

function belowLine(b: { areas: string[]; keys: boolean }) {
  const n = b.areas.length
  const parts = [n ? `${n} more ${n === 1 ? 'area' : 'areas'}` : '', b.keys ? '# keys' : ''].filter(Boolean)
  return `↓ the list scrolls${parts.length ? `: ${parts.join(' and ')} below` : ''}`
}

// ── The list ───────────────────────────────────────────────────────────────────────────────────────────
function ListGuide({ model, onClose, onPlay, reach, resume }: { model: GuideModel; onClose: () => void; onPlay: (id: string) => void; reach: Reach; resume: boolean }) {
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
                // A click is ↵ (a fold opens or shuts).
                act(r)
              }}
              onFold={() => (toggle(foldKey(r)!), setSelKey(r.key), field.current?.focus())}
            />
          ))}
        </div>
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

function RowView({ row: r, model, picked, typed, onClick, onFold }: { row: Row; model: GuideModel; picked: boolean; typed: boolean; onClick: () => void; onFold: () => void }) {
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
