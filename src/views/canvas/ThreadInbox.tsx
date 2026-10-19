// The threads panel (D-166): every conversation in the workspace in one place, opened from the board's bottom-left
// corner. Like the assistant's chat window: a header with views as bracket actions (all · new · mentions · resolved),
// then one row per thread, newest first: what it's on, who wrote last and how it began, when, how many messages; new
// ones (someone else wrote since you last read it) lit magenta, `@` where you're mentioned. A row takes you to the thread
// on the board and opens it there.
import { useEffect, useMemo, useState } from 'react'
import type { WithId } from '../../data/hooks'
import type { Thread } from '../../data/model'
import { isNew, markSeen, useReads } from '../../data/threads'
import menuStyles from '../../ui/Menu.module.css'
import { ago } from './stickyNote'
import { myUid, toggleInbox, useThreadView } from './Threads'
import styles from './Threads.module.css'

type View = 'all' | 'new' | 'mentions' | 'resolved'

type Props = {
  wid: string
  threads: WithId<Thread>[]
  titleOf: (t: Pick<Thread, 'on' | 'targetId'>) => string
  // Takes the board to a thread and opens it.
  onGo: (t: WithId<Thread>) => void
}

// The button in the board's bottom-left toolbar: `THREADS │ 2 new`, lit while something is new.
export function InboxButton({ wid, threads }: Pick<Props, 'wid' | 'threads'>) {
  const open = useThreadView((s) => s.inbox)
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  const fresh = threads.filter((t) => !t.resolved && isNew(t, seen, t.id, me)).length
  return (
    <button
      className={menuStyles.trigger}
      data-active={fresh > 0 || undefined}
      aria-expanded={open}
      aria-label={`Threads${fresh ? `, ${fresh} new` : ''}`}
      data-viewer-ok
      style={{ ['--accent' as string]: 'var(--accent-magenta)' }}
      onClick={() => toggleInbox()}
    >
      <span className={menuStyles.label}>threads</span>
      <span className={menuStyles.summary}>{fresh ? `${fresh} new` : threads.filter((t) => !t.resolved).length}</span>
    </button>
  )
}

export function ThreadInbox({ wid, threads, titleOf, onGo }: Props) {
  const open = useThreadView((s) => s.inbox)
  const openId = useThreadView((s) => s.openId)
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  const [view, setView] = useState<View>('all')

  // Escape closes it, unless a thread is open (that closes first).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !useThreadView.getState().openId && toggleInbox(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

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

  if (!open) return null
  return (
    <section
      className={styles.inbox}
      aria-label="Threads"
      data-viewer-ok
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
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
              ? 'No open threads. Right-click anything on the board → comment.'
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
                  {fresh(t) ? (mentioned(t) ? '@' : '●') : t.resolved ? '✓' : '“'}
                </span>
                <span className={styles.rowTitle}>{titleOf(t)}</span>
                <span className={styles.when}>{ago(t.lastAt)}</span>
              </span>
              <span className={styles.rowText}>
                <b>{t.lastName ?? t.name}</b> {t.lastText ?? ''}
              </span>
              <span className={styles.rowMeta}>
                {t.count} message{t.count === 1 ? '' : 's'} · started by {t.name}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
