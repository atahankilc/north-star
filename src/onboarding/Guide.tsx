// The `?` guide (D-315, onboarding.md §4.6): every note again, in the middle like the finder (its twin: the prompt's
// parts and frame, D-222, D-350; the scrim). A `>` line narrows; `# start` replays the welcome and what's new; `# areas`,
// each with `n / N seen`, `NEW` while one of its notes is armed, folding with `[▸ N inside]` (→ or ↵ opens, ← folds),
// each note `› ✓ title · its first line` (✓ seen, • not yet), ↵ plays it (`onPlay`, the coach's queue.play); `# keys`
// folds the same way; `tips on | off` on the `>` line (⇥ switches it). At most the screen less 48 px top and bottom, the
// list scrolling inside. Focus is in its field while it's open (the coach gives it back on close); esc or a press on
// the scrim closes it.
//
// The finder's twin, a list (D-316).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { Appear } from '../ui/primitives/Appear'
import { guideModel, guideRows, keyLesson, showDot, parentOf, step, type AreaInfo, type GuideModel, type Note, type Row, type StartRow } from './guideModel'
import type { KeyRow } from './keys'
import type { Role } from './lessons'
import { useProgress } from './progress'
import styles from './Guide.module.css'
import { PromptField } from '../ui/primitives/PromptField'
import { Tabs } from '../ui/primitives/Tabs'
import { Label } from '../ui/primitives/Label'
import { Empty } from '../ui/primitives/Empty'
import { PromptList } from '../ui/patterns/PromptList'
import type { PromptEntry, PromptItem } from '../ui/foundation/promptModel'

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

// This person's role in the open workspace, as the coach knows it (null: none known, every note counts).
export const useGuideRole = create<{ role: Role | null }>(() => ({ role: null }))
// Whether the guide is open, set by the coach: the side nav's `?` turns cyan while it is, as every HUD tool does (D-343).
export const useGuideShown = create<{ open: boolean }>(() => ({ open: false }))

// The magenta dot on the side nav's `?` (O6): something armed is still unseen, and `?` lists it here (as `NEW`).
export function useGuideDot(): boolean {
  const seen = useProgress((s) => s.seen)
  const armed = useProgress((s) => s.armed)
  const role = useGuideRole((s) => s.role)
  return useMemo(() => showDot({ seen, armed }, role), [seen, armed, role])
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
  return createPortal( // kit-ok: the guide is the finder's twin (D-316), not the wizard Window
    <>
      <div className={styles.scrim} data-coach onPointerDown={onClose} aria-hidden />
      <ListGuide model={model} onClose={onClose} onPlay={onPlay} reach={reach} resume={resume} />
    </>,
    document.body,
  )
}

const TIPS = [
  { value: 'on' as const, label: 'on' },
  { value: 'off' as const, label: 'off' },
]

// The `>` line: the field and the tips switch.
function Line({ field, query, setQuery, onKeyDown }: { field: React.RefObject<HTMLInputElement | null>; query: string; setQuery: (q: string) => void; onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void }) {
  const tipsOff = useProgress((s) => s.tipsOff)
  const setTipsOff = useProgress((s) => s.setTipsOff)
  const set = (off: boolean) => {
    setTipsOff(off)
    field.current?.focus()
  }
  // The kit's prompt line (D-326): Enter, the arrows, Tab and Escape are the guide's own (onKeyDown), so its submit
  // does nothing of its own.
  return (
    <PromptField
      ref={field as React.Ref<HTMLInputElement | HTMLTextAreaElement | null>}
      className={styles.line}
      value={query}
      onChange={setQuery}
      onSubmit={() => {}}
      label="Find a note or a key"
      placeholder="find a note or a key…"
      onKeyDown={onKeyDown as (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void}
    >
      <Label tone="faint">tips</Label>
      <span className={styles.tips} onMouseDown={(e) => e.preventDefault()}>
        <Tabs look="segments" label="Tips (⇥ switches)" options={TIPS} value={tipsOff ? 'off' : 'on'} onChange={(v) => set(v === 'off')} />
      </span>
    </PromptField>
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
function useBelow(body: React.RefObject<HTMLElement | null>, rows: Row[]) {
  const [below, setBelow] = useState<{ areas: string[]; keys: boolean } | null>(null)
  useLayoutEffect(() => {
    const el = body.current?.firstElementChild as HTMLElement | null | undefined
    if (!el) return
    const folds = rows.flatMap((r) => (r.kind === 'area' ? [{ key: r.key, name: r.area.name }] : r.kind === 'keys' ? [{ key: r.key, name: 'keys' }] : []))
    const measure = () => {
      const bottom = el.scrollTop + el.clientHeight
      if (el.scrollHeight - bottom < 4) return setBelow(null)
      const under = folds.filter((f) => (el.querySelector<HTMLElement>(`[data-key="${CSS.escape(f.key)}"]`)?.offsetTop ?? 0) >= bottom - 4)
      setBelow({ areas: under.filter((f) => f.name !== 'keys').map((f) => f.name), keys: under.some((f) => f.name === 'keys') })
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [body, rows])
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
  const body = useRef<HTMLDivElement>(null)
  const below = useBelow(body, rows)

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

  // The rows as the prompt's entries (D-350): what's showing now first, then the guide's own rows.
  const entries = useMemo<PromptEntry[]>(
    () => [
      ...(nowShown ? [{ key: '#now', heading: 'showing now' }, { key: NOW, label: reach!.title, glyph: '◆', onSelect: NOOP }] : []),
      ...rows.map((r) => entryOf(r, () => (toggle(foldKey(r)!), setSelKey(r.key), field.current?.focus()))),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, nowShown, reach?.title],
  )
  // A click is ↵ (a fold opens or shuts).
  const onRow = (i: PromptItem) => {
    if (i.key === NOW) return reach?.go()
    const r = rows.find((x) => x.key === i.key)
    setOnNow(false)
    setSelKey(i.key)
    field.current?.focus()
    act(r ?? null)
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
      role="dialog" // kit-ok: the finder's twin (D-316)
      aria-modal="true"
      aria-label="Guide: every note again"
      data-coach
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      onKeyDown={keepKeys}
    >
      <Line field={field} query={query} setQuery={(q) => (setQuery(q), setSelKey(null))} onKeyDown={onKeyDown} />
      <div ref={body} className={styles.body}>
        {rows.length === 0 && !nowShown ? (
          <Empty className={styles.none}>nothing matches</Empty>
        ) : (
          <PromptList
            className={styles.list}
            role="listbox"
            label="Notes and keys"
            entries={entries}
            picked={nowPicked ? NOW : (rows[at]?.key ?? null)}
            q={query.trim()}
            onPick={onRow}
            onPoint={NO_POINT}
            idOf={(k) => `guide-${k}`}
          />
        )}
      </div>
      {below && <div className={styles.more}>{belowLine(below)}</div>}
    </Appear>
  )
}

type Reach = { title: string; go: () => void } | null

const NOW = 'now'
const NOOP = () => {}
const NO_POINT = () => {}
const seenMark = (seen: boolean) => ({ glyph: seen ? '✓' : '•', tone: seen ? 'var(--accent-cyan)' : undefined })

// A guide row as a prompt row: ✓ seen (cyan) or • not yet, the title, its first line dim, NEW; an area or the keys fold
// (`▸ 9 inside`); a note or a key hangs under its area.
function entryOf(r: Row, onFold: () => void): PromptEntry {
  if (r.kind === 'head') return { key: r.key, heading: r.title, count: r.count }
  if (r.kind === 'start') {
    const s: StartRow = r.start
    return { key: r.key, label: s.title, ...seenMark(s.seen), meta: s.line, badge: s.isNew ? 'NEW' : undefined, faint: s.off, onSelect: NOOP }
  }
  if (r.kind === 'area') {
    const a: AreaInfo = r.area
    return { key: r.key, label: a.name, meta: `${a.seen} / ${a.notes.length} seen`, badge: a.isNew ? 'NEW' : undefined, fold: { open: r.open, count: a.notes.length, onToggle: onFold }, onSelect: NOOP }
  }
  if (r.kind === 'keys') return { key: r.key, label: 'every shortcut', fold: { open: r.open, count: r.shown, noun: 'keys', onToggle: onFold }, onSelect: NOOP }
  if (r.kind === 'note') {
    const n: Note = r.note
    return { key: r.key, label: n.title, ...seenMark(n.seen), meta: n.line.replace(/`/g, ''), badge: n.isNew ? 'NEW' : undefined, indent: true, onSelect: NOOP }
  }
  const k: KeyRow = r.row
  return {
    key: r.key,
    label: (
      <>
        <kbd className={styles.kbd}>{k.keys}</kbd> {k.what}
      </>
    ),
    meta: k.where,
    indent: true,
    onSelect: NOOP,
  }
}
