// The threads panel (D-166): every conversation in the workspace in one place, opened from the board's bottom-left
// corner. Like the assistant's chat window: a header with views as bracket actions (all · new · mentions · resolved),
// then one row per thread, newest first: what it's on, who wrote last and how it began, when, how many messages, and
// the plane it's on when that isn't the open one (D-168: going there switches to it); new
// ones (someone else wrote since you last read it) lit magenta, `@` where you're mentioned. A row opens the thread
// beside the list (D-197). The two halves work apart (D-199): a chip on the canvas opens only its thread, `all threads`
// there opens the list beside it; closing the list closes both, closing the thread leaves the list. The tab, and each
// half on its own, builds up cell by cell as it opens and breaks apart as it closes (D-034, D-035), like everything else.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { WithId } from '../../data/hooks'
import type { Thread } from '../../data/model'
import { isNew, markSeen, useReads, type NewThread } from '../../data/threads'
import { isReducedMotion } from '../../state/motion'
import { ago } from '../../ui/ago'
import { runCells } from '../../ui/Appear'
import { DURATION_MS } from '../../ui/cellReveal'
import { CommentIcon, myUid, ThreadPanel, toggleInbox, useThreadView } from './Threads'
import styles from './Threads.module.css'

type View = 'all' | 'new' | 'mentions' | 'resolved'
type Convo = { thread: WithId<Thread> | null; draft: NewThread | null }

// The panel's height, dragged from its top edge (D-197): kept per browser; never under MIN_H, never over the breadcrumb.
const HEIGHT_KEY = 'north-star.threads-height'
const MIN_H = 220
const HEAD_ROOM = 64
// Breaking apart takes 0.6 of the build-up, as `Appear`'s exit; what's leaving is kept a little past it.
const OUT_MS = Math.round(DURATION_MS * 0.6)
const KEEP_MS = OUT_MS + 40
const HIDDEN = 'polygon(0 0, 0 0, 0 0)'

// A value kept for `ms` after it goes, so what's leaving is still drawn while it animates out.
function useLinger<T>(value: T | null, ms: number): [T | null, boolean] {
  const kept = useRef(value)
  const [, redraw] = useState(0)
  const on = value !== null
  if (on) kept.current = value
  useEffect(() => {
    if (on || kept.current === null) return
    const t = setTimeout(() => {
      kept.current = null
      redraw((n) => n + 1)
    }, isReducedMotion() ? 0 : ms)
    return () => clearTimeout(t)
  }, [on, ms])
  return on ? [value, false] : [kept.current, kept.current !== null]
}

type Props = {
  wid: string
  threads: WithId<Thread>[]
  titleOf: (t: Pick<Thread, 'on' | 'targetId'>) => string
  // Takes the board to a thread (on its plane, D-168) and opens it.
  onGo: (t: WithId<Thread>) => void
  // The plane each thread is seen on, by name, when the workspace has planes; and the open one's (D-168).
  whereOf?: (t: WithId<Thread>) => string | null
  here?: string
  // What it was on was deleted (D-171).
  goneOf?: (t: WithId<Thread>) => boolean
  // A scope's name (D-193): the plane whose console opened the panel.
  scopeName?: (id: string) => string
  // The thread half (D-197): owners delete any thread; the target in its header shows it where it is.
  isOwner: boolean
  onShow: (t: WithId<Thread>) => void
}

// The button in the bottom-left corner, just above your square (D-193): the comment mark; a magenta count of new
// mentions in its corner, or a magenta dot while anything else is new.
export function InboxButton({ wid, threads }: Pick<Props, 'wid' | 'threads'>) {
  const open = useThreadView((s) => s.inbox)
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  const fresh = threads.filter((t) => !t.resolved && isNew(t, seen, t.id, me))
  const mentions = fresh.filter((t) => t.mentions?.includes(me)).length
  return (
    <button
      className={styles.inboxButton}
      aria-pressed={open}
      aria-label={`Threads${mentions ? `, ${mentions} new mention${mentions === 1 ? '' : 's'}` : fresh.length ? `, ${fresh.length} new` : ''}`}
      title={mentions ? `${mentions} new mention${mentions === 1 ? '' : 's'}` : fresh.length ? `${fresh.length} thread${fresh.length === 1 ? '' : 's'} with something new` : 'Threads'}
      data-viewer-ok
      onClick={() => toggleInbox()}
    >
      <CommentIcon />
      {mentions > 0 ? <span className={styles.badge}>{mentions > 9 ? '9+' : mentions}</span> : fresh.length > 0 && <span className={styles.dot} />}
    </button>
  )
}

export function ThreadInbox({ wid, threads: all, titleOf, onGo, whereOf, here, goneOf, scopeName, isOwner, onShow }: Props) {
  const listOpen = useThreadView((s) => s.inbox)
  // Only what's inside a plane when its console opened the panel (D-193, D-195); the plane's own conversation isn't
  // inside it, it's on the canvas.
  const scope = useThreadView((s) => s.scope)
  const threads = useMemo(() => (scope ? all.filter((t) => t.planeId === scope) : all), [all, scope])
  const openId = useThreadView((s) => s.openId)
  const draft = useThreadView((s) => s.draft)
  const current = all.find((t) => t.id === openId) ?? null
  // What's open now; while the tab sinks away, what was open, so nothing in it changes as it goes; and while the thread
  // half folds shut, the thread it showed.
  const convoNow = useMemo<Convo | null>(() => (current ? { thread: current, draft: null } : draft ? { thread: null, draft } : null), [current, draft])
  const now = useMemo(() => (listOpen || convoNow ? { list: listOpen, convo: convoNow } : null), [listOpen, convoNow])
  const [shown, leaving] = useLinger(now, KEEP_MS)
  const [convo, convoLeaving] = useLinger(shown?.convo ?? null, KEEP_MS)
  const open = !!shown?.list

  // The cells (D-034, D-035): the tab builds as it opens and breaks apart as it shuts; a half opening beside the other
  // builds on its own (a thread again when another is picked), and breaks apart as it closes.
  const tab = useRef<HTMLElement>(null)
  const listEl = useRef<HTMLDivElement>(null)
  const convoEl = useRef<HTMLDivElement>(null)
  const convoKey = convo ? (convo.thread?.id ?? 'draft') : null
  const was = useRef({ tab: false, leaving: false, list: false, convo: null as string | null, convoLeaving: false })
  const running = useRef(new Map<HTMLElement, () => void>())
  useLayoutEffect(() => {
    const cells = (el: HTMLElement | null, mode: 'enter' | 'exit') => {
      if (!el) return
      running.current.get(el)?.()
      if (mode === 'enter' && !isReducedMotion()) el.style.clipPath = HIDDEN
      running.current.set(el, runCells(el, mode, 0, mode === 'enter' ? DURATION_MS : OUT_MS))
    }
    const prev = was.current
    if (shown && (!prev.tab || (prev.leaving && !leaving))) cells(tab.current, 'enter')
    else if (leaving && !prev.leaving) cells(tab.current, 'exit')
    else if (shown && !leaving) {
      if (open && !prev.list) cells(listEl.current, 'enter')
      if (convoKey && !convoLeaving && (convoKey !== prev.convo || prev.convoLeaving)) cells(convoEl.current, 'enter')
      if (convoLeaving && !prev.convoLeaving) cells(convoEl.current, 'exit')
    }
    was.current = { tab: !!shown, leaving, list: open, convo: convoKey, convoLeaving }
  })
  useEffect(() => () => running.current.forEach((stop) => stop()), [])
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  const [view, setView] = useState<View>('all')
  const [height, setHeight] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem(HEIGHT_KEY))
      return v >= MIN_H ? v : null
    } catch {
      return null
    }
  })

  // Escape closes it, unless a thread is open (that closes first).
  useEffect(() => {
    if (!listOpen) return
    const onKey = (e: KeyboardEvent) => {
      const { openId, draft } = useThreadView.getState()
      if (e.key === 'Escape' && !e.defaultPrevented && !openId && !draft) toggleInbox(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listOpen])

  const sorted = useMemo(() => [...threads].sort((a, b) => b.lastAt - a.lastAt), [threads])
  const fresh = (t: WithId<Thread>) => isNew(t, seen, t.id, me)
  const mentioned = (t: WithId<Thread>) => !!t.mentions?.includes(me)
  const counts = {
    all: sorted.filter((t) => !t.resolved).length,
    new: sorted.filter((t) => !t.resolved && fresh(t)).length,
    mentions: sorted.filter((t) => mentioned(t)).length,
    resolved: sorted.filter((t) => t.resolved).length,
  }
  const rows = sorted.filter((t) =>
    view === 'resolved' ? t.resolved : view === 'mentions' ? mentioned(t) : !t.resolved && (view === 'all' || fresh(t)),
  )
  const markAll = () => sorted.filter(fresh).forEach((t) => void markSeen(wid, t.id, t.lastAt))

  if (!shown) return null
  // Dragging the top edge: taller up, shorter down; between MIN_H and the space under the breadcrumb.
  const resize = (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault()
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    const room = (e.currentTarget.closest('[data-app]') as HTMLElement | null)?.clientHeight ?? window.innerHeight
    const [sy, h0] = [e.clientY, box.height]
    let h = h0
    const move = (ev: PointerEvent) => {
      h = Math.round(Math.min(room - HEAD_ROOM, Math.max(MIN_H, h0 + sy - ev.clientY)))
      setHeight(h)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      try {
        localStorage.setItem(HEIGHT_KEY, String(h))
      } catch {
        // No storage (a private window): it's only for this time.
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <section
      ref={tab}
      className={styles.inbox}
      aria-label="Threads"
      data-list={open || undefined}
      data-convo={convo ? true : undefined}
      data-leaving={leaving || undefined}
      style={height ? { height } : undefined}
      data-viewer-ok
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Its top edge sets its height (D-197), kept in this browser. */}
      <span className={styles.grip} onPointerDown={resize} aria-hidden />
      <div className={styles.listSide} inert={!open || undefined}>
      <div ref={listEl} className={styles.listInner}>
      <header className={styles.head}>
        <span className={styles.title}>threads</span>
        <span className={styles.actions}>
          {counts.new > 0 && (
            <button className={styles.action} onClick={markAll}>
              mark all read
            </button>
          )}
          <button className={styles.close} aria-label="Close threads" onClick={() => toggleInbox(false)}>
            [×]
          </button>
        </span>
      </header>
      {/* What you're looking at, always said (D-195): the whole workspace, or what's inside one plane. */}
      <div className={styles.scope} data-scoped={scope ? true : undefined}>
        {scope ? (
          <>
            <span>
              inside <b>{scopeName?.(scope) ?? 'a plane'}</b>
            </span>
            <button className={styles.action} onClick={() => useThreadView.setState({ scope: null })}>
              whole workspace
            </button>
          </>
        ) : (
          <span>whole workspace</span>
        )}
      </div>
      <nav className={styles.views} aria-label="Which threads">
        {(['all', 'new', 'mentions', 'resolved'] as const).map((v) => (
          <button key={v} className={styles.action} aria-pressed={view === v} data-lit={(v === 'new' && counts.new > 0) || undefined} onClick={() => setView(v)}>
            {v}
            {counts[v] > 0 && ` ${counts[v]}`}
          </button>
        ))}
      </nav>
      <ol className={styles.rows}>
        {rows.length === 0 && (
          <li className={styles.lead}>
            {view === 'all'
              ? 'No open threads. Right-click anything → comment.'
              : view === 'new'
                ? 'Nothing new: you have read everything.'
                : view === 'mentions'
                  ? 'Nobody has mentioned you yet.'
                  : 'No resolved threads.'}
          </li>
        )}
        {rows.map((t) => (
          <li key={t.id}>
            <button className={styles.row} data-new={fresh(t) || undefined} data-open={t.id === openId || undefined} onClick={() => onGo(t)}>
              <span className={styles.rowHead}>
                <span className={styles.rowMark} aria-hidden>
                  {fresh(t) ? (mentioned(t) ? '@' : '●') : t.resolved ? '✓' : <CommentIcon size={11} />}
                </span>
                <span className={styles.rowTitle}>{titleOf(t)}</span>
                <span className={styles.when}>{ago(t.lastAt)}</span>
              </span>
              <span className={styles.rowText}>
                <b>{t.lastName ?? t.name}</b> {t.lastText ?? ''}
              </span>
              <span className={styles.rowMeta}>
                {t.count} message{t.count === 1 ? '' : 's'} · started by {t.name}
                {goneOf?.(t) && <span className={styles.rowGone}> · what it was on was deleted</span>}
                {/* Another plane than the open one: going there switches to it (D-168). */}
                {(() => {
                  const where = whereOf?.(t)
                  return where && where !== here ? <span className={styles.rowPlane}> · on {where} ↗</span> : null
                })()}
              </span>
            </button>
          </li>
        ))}
      </ol>
      </div>
      </div>
      {/* The conversation picked on the left or from a chip, or one being started (D-197, D-199); with none, the tab is
          just the list. */}
      <div className={styles.convoSide} inert={!shown.convo || undefined}>
        {convo && (
          <div ref={convoEl} className={styles.convoInner}>
            <ThreadPanel
              key={convo.thread?.id ?? 'draft'}
              wid={wid}
              thread={convo.thread}
              draft={convo.draft}
              title={titleOf(convo.thread ?? convo.draft!)}
              isOwner={isOwner}
              where={convo.thread ? (whereOf?.(convo.thread) ?? undefined) : undefined}
              onShow={convo.thread ? () => onShow(convo.thread!) : undefined}
              onList={open ? undefined : () => toggleInbox(true)}
            />
          </div>
        )}
      </div>
    </section>
  )
}
