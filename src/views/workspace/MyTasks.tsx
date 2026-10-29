// `☐` by your square bottom left (under the rule: yours, not the workspace's): opens and closes the tasks side view (D-300;
// `t` does the same), on MINE when something new is given to you. Its count is still tasks given to you (D-261): how
// many are new, magenta, like a thread's `@` (D-166); new = given to you by someone else since you last looked; looking
// is MINE shown (your read marks, `threadReads/{you}.tasks`). Finished tasks aren't counted. Shown once there's a deck.
import { useEffect } from 'react'
import { useAuth } from '../../data/auth'
import { finished } from '../../data/tasks'
import { useReads } from '../../data/threads'
import { useWs } from './context'
import { loadTasksSide, toggleTasksSide, useTasksSide } from './sideState'
import styles from './MyTasks.module.css'

export function MyTasks() {
  const { wid, tasks, pieces } = useWs()
  const { user } = useAuth()
  const me = user?.id ?? null
  const lookedAt = useReads(wid, me).data?.tasks ?? 0
  const open = useTasksSide((s) => s.open)
  useEffect(() => loadTasksSide(wid), [wid])

  const mine = tasks.filter((t) => me && t.assignee === me && !finished(t, pieces) && pieces.some((p) => p.id === t.pieceId))
  const fresh = mine.filter((t) => (t.givenAt ?? 0) > lookedAt && t.givenBy !== me).length
  if (!pieces.some((p) => p.kind === 'kanban')) return null
  return (
    <span className={styles.at}>
      <button
        className={styles.button}
        aria-pressed={open}
        aria-label={`Tasks${mine.length ? `: ${mine.length} given to you${fresh ? `, ${fresh} new` : ''}` : ''}`}
        title={fresh ? `tasks (t) · ${fresh} given to you since you last looked` : `tasks (t)${mine.length ? ` · ${mine.length} given to you` : ''}`}
        data-viewer-ok
        onClick={() => toggleTasksSide(fresh && !open ? 'mine' : undefined)}
      >
        <span aria-hidden>☐</span>
        {fresh > 0 ? <span className={styles.badge}>{fresh > 9 ? '9+' : fresh}</span> : mine.length > 0 && <span className={styles.count}>{mine.length}</span>}
      </button>
    </span>
  )
}
