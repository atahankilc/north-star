// Tasks given to you (D-261), by your square bottom left (under the rule: yours, not the workspace's): `☐` with how many
// are new, magenta, like a thread's `@` (D-166). New = given to you by someone else since you last looked; looking is
// opening the list (your read marks, `threadReads/{you}.tasks`). The list, a prompt like every menu (D-222), opens on
// the right: the new ones first, then the rest by due day; each row its title, `kanban · column · due`; a row goes to
// it (its kanban's focus, the task picked). Finished tasks aren't listed. Shown only once something's given to you.
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../data/auth'
import { overdue, type Task } from '../../data/tasks'
import { markTasksSeen, useReads } from '../../data/threads'
import { Appear } from '../../ui/Appear'
import { MenuPanel, type MenuEntry } from '../../ui/Menu'
import { useWs } from './context'
import { dueText, goToTask, kanbanOf } from './Kanban'
import menu from './ContextMenu.module.css'
import styles from './MyTasks.module.css'

export function MyTasks() {
  const { wid, tasks, pieces } = useWs()
  const { user } = useAuth()
  const me = user?.id ?? null
  const lookedAt = useReads(wid, me).data?.tasks ?? 0
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  // What was new when it opened stays marked while it's open.
  const [since, setSince] = useState(lookedAt)

  const colOf = (t: Task) => {
    const p = pieces.find((x) => x.id === t.pieceId)
    return p ? kanbanOf(p).cols.find((c) => c.id === t.col) : undefined
  }
  const mine = tasks.filter((t) => me && t.assignee === me && !colOf(t)?.done && pieces.some((p) => p.id === t.pieceId))
  const isNew = (t: Task, at: number) => (t.givenAt ?? 0) > at && t.givenBy !== me
  const fresh = mine.filter((t) => isNew(t, lookedAt)).length

  useEffect(() => {
    if (!open) return
    const away = (e: Event) => !root.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', away, true)
    return () => window.removeEventListener('pointerdown', away, true)
  }, [open])

  if (!mine.length) return null
  const toggle = () => {
    if (open) return setOpen(false)
    setSince(lookedAt)
    setOpen(true)
    if (fresh) void markTasksSeen(wid)
  }
  const sorted = [...mine].sort((a, b) => Number(isNew(b, since)) - Number(isNew(a, since)) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt)
  // The kanban's name only when they're on more than one.
  const several = new Set(mine.map((t) => t.pieceId)).size > 1
  const row = (t: Task): MenuEntry => {
    const p = pieces.find((x) => x.id === t.pieceId)!
    const late = overdue(t, false)
    return {
      key: t.id,
      label: t.title,
      glyph: isNew(t, since) ? <span className={styles.new}>●</span> : '☐',
      tone: late ? 'var(--accent-magenta)' : undefined,
      hint: [several ? p.name || 'kanban' : '', colOf(t)?.name, t.due && `${late ? 'was due ' : ''}${dueText(t.due)}`].filter(Boolean).join(' · '),
      onSelect: () => goToTask(p, tasks, t),
    }
  }
  const newOnes = sorted.filter((t) => isNew(t, since))
  const items: MenuEntry[] = [
    ...(newOnes.length ? [{ key: 'h-new', heading: `new · ${newOnes.length}` }, ...newOnes.map(row)] : []),
    ...(newOnes.length && newOnes.length < sorted.length ? [{ key: 'h-rest', heading: 'given to you' }] : []),
    ...sorted.filter((t) => !isNew(t, since)).map(row),
  ]
  return (
    <span ref={root} className={styles.at}>
      <button
        className={styles.button}
        aria-pressed={open}
        aria-haspopup="menu"
        aria-label={`Tasks given to you: ${mine.length}${fresh ? `, ${fresh} new` : ''}`}
        title={fresh ? `${fresh} task${fresh === 1 ? '' : 's'} given to you since you last looked` : `${mine.length} task${mine.length === 1 ? '' : 's'} given to you`}
        data-viewer-ok
        onClick={toggle}
      >
        <span aria-hidden>☐</span>
        {fresh > 0 ? <span className={styles.badge}>{fresh > 9 ? '9+' : fresh}</span> : <span className={styles.count}>{mine.length}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <Appear key="list" className={`${menu.menu} ${styles.pop}`}>
            <MenuPanel items={items} ariaLabel="Tasks given to you" prompt="your tasks…" noun="tasks" onClose={() => setOpen(false)} />
          </Appear>
        )}
      </AnimatePresence>
    </span>
  )
}
