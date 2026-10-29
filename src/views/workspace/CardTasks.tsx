// A card's tasks (D-254), in its right panel: the tasks for it on every kanban, unfinished first, each `[ ]` or `[x]`,
// its title, where it is (`roadmap · doing`), its due day; a row opens the task's own panel in place of the card's (the
// task's `for` row comes back). `+ task` types new ones into a kanban's first column (Enter makes one and keeps typing,
// Escape stops); with several kanbans, which one is picked above the field. A customer, problem or idea still being
// tested offers `+ test it`: a task named "Test: <title>" (made at once with one kanban, typed first with several),
// until such a test is open.
import { useState } from 'react'
import type { Card } from '../../data/cards'
import { useAuth } from '../../data/auth'
import { addTask, orderBetween, overdue, tasksIn, TASK_TITLE_MAX, untested, type Task } from '../../data/tasks'
import { useCanvasView } from '../../state/canvasView'
import { PanelSection } from '../../ui/SidePanel'
import { useWs } from './context'
import { dueText, kanbanOf, selectTask } from './Kanban'
import { kindOfPiece } from '../../data/pieces'
import styles from './CardPanel.module.css'
import own from './CardTasks.module.css'

// The kanban new tasks went into last, kept while the tab is open.
let lastKanban: string | null = null

// A task picked from a card's panel: its panel opens in place of the card's.
export function openTask(t: Pick<Task, 'id' | 'pieceId'>) {
  useCanvasView.setState({ cardSelected: null, cardMulti: [] })
  selectTask(t.pieceId, t.id)
}

export function TasksSection({ n, card, editor }: { n: number; card: Card; editor: boolean }) {
  const { wid, tasks, pieces } = useWs()
  const { user } = useAuth()
  const kanbans = pieces.filter((p) => kindOfPiece(p) === 'kanban')
  const [draft, setDraft] = useState<string | null>(null)
  const [into, setInto] = useState(() => (kanbans.some((k) => k.id === lastKanban) ? lastKanban! : kanbans[0]?.id))
  const kanban = kanbans.find((k) => k.id === into) ?? kanbans[0]
  const colOf = (t: Task) => {
    const p = pieces.find((x) => x.id === t.pieceId)
    return p ? kanbanOf(p).cols.find((c) => c.id === t.col) : undefined
  }
  const mine = tasks
    .filter((t) => t.cardId === card.id)
    .map((t) => ({ t, col: colOf(t), on: pieces.find((x) => x.id === t.pieceId) }))
    .sort((a, b) => Number(!!a.col?.done) - Number(!!b.col?.done) || a.t.createdAt - b.t.createdAt)
  const done = mine.filter((m) => m.col?.done).length
  // Not while a test of it is still open.
  const testing = mine.some((m) => !m.col?.done && m.t.title.startsWith('Test:'))
  const testable = editor && untested(card) && kanbans.length > 0 && !testing

  const make = (title: string) => {
    const t = title.trim().slice(0, TASK_TITLE_MAX)
    if (!t || !kanban || !user) return
    const first = kanbanOf(kanban).cols[0]
    const last = tasksIn(tasks.filter((x) => x.pieceId === kanban.id), first.id).at(-1)?.order
    lastKanban = kanban.id
    addTask(wid, kanban.id, first.id, orderBetween(last, undefined), t, user.id, { cardId: card.id, cardType: card.type })
  }
  const testIt = () => {
    const title = `Test: ${card.title || 'this'}`
    if (kanbans.length === 1) make(title)
    else setDraft(title)
  }

  return (
    <PanelSection
      n={n}
      name="tasks"
      count={mine.length ? `${done}/${mine.length}` : undefined}
      add={editor && kanbans.length && draft === null ? { label: 'task', onClick: () => setDraft('') } : undefined}
      empty={!mine.length && draft === null && !testable && !(editor && !kanbans.length)}
    >
      {mine.map(({ t, col, on }) => {
        const late = overdue(t, !!col?.done)
        return (
          <button key={t.id} className={own.row} data-done={col?.done || undefined} onClick={() => openTask(t)} title="open the task">
            <span className={own.box}>[{col?.done ? 'x' : ' '}]</span>
            <span className={own.title}>{t.title}</span>
            {t.due && !col?.done && (
              <span className={own.due} data-late={late || undefined}>
                ◷ {dueText(t.due)}
              </span>
            )}
            <span className={own.where}>{[kanbans.length > 1 ? on?.name || 'deck' : '', col?.name].filter(Boolean).join(' · ')}</span>
          </button>
        )
      })}
      {draft !== null && (
        <div className={own.add}>
          {kanbans.length > 1 && (
            <div className={styles.pills} role="group" aria-label="Into which deck">
              {kanbans.map((k) => (
                <button key={k.id} className={styles.pill} aria-pressed={k.id === kanban?.id} onMouseDown={(e) => e.preventDefault()} onClick={() => setInto(k.id)}>
                  {k.name || 'deck'}
                </button>
              ))}
            </div>
          )}
          <label className={own.field}>
            <span className={own.prompt} aria-hidden>
              &gt;
            </span>
            <input
              className={styles.input}
              autoFocus
              placeholder={`a task, into ${kanban ? kanbanOf(kanban).cols[0].name : ''}`}
              value={draft}
              maxLength={TASK_TITLE_MAX}
              aria-label="New task"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => setDraft(null)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' && draft.trim()) (make(draft), setDraft(''))
                if (e.key === 'Escape') setDraft(null)
              }}
            />
          </label>
          <span className={styles.hint}>enter makes it · esc</span>
        </div>
      )}
      {testable && draft === null && (
        <div className={styles.pills}>
          <button className={styles.pill} onClick={testIt} title="A task to find out whether this holds">
            + test it
          </button>
        </div>
      )}
      {editor && !kanbans.length && <p className={own.none}>no deck yet: put one on the canvas from its +</p>}
    </PanelSection>
  )
}
