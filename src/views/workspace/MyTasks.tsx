// The tasks side view's button (D-300) in the side nav, after `+`, fit and the compass: columns over a time bar (a
// deck and its days), shown only while the canvas has a deck or a timeline; cyan while the side view is open; `t` does
// the same. A click opens it on the deck you had, or on MINE when something new is given to you. Its magenta count is
// still tasks given to you since you last looked (D-261; looking is MINE shown, your read marks
// `threadReads/{you}.tasks`), as `☐` by your square had; finished ones aren't counted. Where it's open goes out with your
// presence, so a follower's opens there too.
import { useEffect } from 'react'
import { useAuth } from '../../data/auth'
import { piecesOn } from '../../data/canvases'
import { setPresenceTasks } from '../../data/presence'
import { finished } from '../../data/tasks'
import { useReads } from '../../data/threads'
import { useWs } from './context'
import { loadTasksSide, sideShared, toggleTasksSide, useTasksSide } from './sideState'
import nav from './WorkspaceLayout.module.css'
import styles from './MyTasks.module.css'

export function TasksButton() {
  const { wid, tasks, pieces, canvas, spots } = useWs()
  const { user } = useAuth()
  const me = user?.id ?? null
  const reads = useReads(wid, me)
  const lookedAt = reads.data?.tasks ?? 0
  const open = useTasksSide((s) => s.open)
  useEffect(() => loadTasksSide(wid), [wid])
  const shared = useTasksSide(sideShared)
  useEffect(() => setPresenceTasks(shared), [shared])

  const mine = tasks.filter((t) => me && t.assignee === me && !finished(t, pieces) && pieces.some((p) => p.id === t.pieceId))
  // Nothing counts as new until your read marks are in.
  const fresh = reads.isLoading ? 0 : mine.filter((t) => (t.givenAt ?? 0) > lookedAt && t.givenBy !== me).length
  if (!piecesOn(canvas, pieces, spots).some((p) => p.kind === 'kanban' || p.kind === 'timeline')) return null
  return (
    <button
      className={`${nav.fit} ${styles.button}`}
      data-learn="tasks"
      data-on={open || undefined}
      aria-pressed={open}
      aria-label={`Decks and their days${fresh ? `: ${fresh} task${fresh === 1 ? '' : 's'} given to you, new` : ''}`}
      title={fresh ? `decks and days (t) · ${fresh} given to you since you last looked` : 'decks and days (t)'}
      data-viewer-ok
      onClick={() => toggleTasksSide(fresh && !open ? 'mine' : undefined)}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        {/* A deck's columns over a bar of days. */}
        <path d="M2 2h4v10H2zM8 2h4v7H8zM14 2h4v12h-4z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2 17.5h16" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 15.5v4M14 15.5v4" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      {fresh > 0 && <span className={styles.badge}>{fresh > 9 ? '9+' : fresh}</span>}
    </button>
  )
}
