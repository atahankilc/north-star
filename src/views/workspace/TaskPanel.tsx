// A kanban task's right panel (D-251), in the shell every right panel shares (D-219): its title, then the column it's
// in, who it's given to, when it's due, the card it's for, its checklist and notes. Everything is edited in place and
// undoable; viewers only read. The card it's for opens that card's own panel (LensCardPanel), in place of this one.
import { AnimatePresence } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import type { Card } from '../../data/cards'
import { CHECK_MAX, deleteTask, moveTask, newCheck, orderBetween, overdue, setChecks, tasksIn, TASK_TITLE_MAX, updateTask, type Check, type Task } from '../../data/tasks'
import { useMembers } from '../../data/workspaces'
import { useCanvasView } from '../../state/canvasView'
import { useAutoGrow } from '../../ui/autoGrow'
import { PanelAction, PanelSection, SidePanel } from '../../ui/SidePanel'
import { Select } from '../../ui/Select'
import { CardPicker, Pills, PLACEHOLDER, useCommit } from './CardPanel'
import { useWs } from './context'
import { dueText, kanbanOf, selectTask, useKanbanUi } from './Kanban'
import { TYPE_ACCENT } from './PlaneCards'
import styles from './CardPanel.module.css'
import own from './TaskPanel.module.css'

const TONE = 'var(--accent-cyan)'

export function TaskPanel({ editor }: { editor: boolean }) {
  const { wid, tasks, pieces } = useWs()
  const sel = useKanbanUi((s) => s.selected)
  const task = sel ? tasks.find((t) => t.id === sel.task) : undefined
  const piece = task ? pieces.find((p) => p.id === task.pieceId) : undefined
  const close = () => selectTask('', null)
  return (
    <AnimatePresence>
      {task && piece && (
        <SidePanel
          // One panel while tasks change under it: it builds only when it opens.
          key="task"
          kind="task"
          tone={TONE}
          label={`task ${task.title}`}
          title={<Title key={task.id} task={task} editor={editor} />}
          onClose={close}
          actions={
            editor && (
              <PanelAction
                label="delete"
                danger
                title="Delete or Backspace"
                onClick={() => {
                  close()
                  void deleteTask(wid, task)
                }}
              />
            )
          }
        >
          <Inside key={task.id} task={task} cols={kanbanOf(piece).cols} editor={editor} />
        </SidePanel>
      )}
    </AnimatePresence>
  )
}

// Its title: Geist, typed in place; Enter keeps it, Escape puts it back. A task always has one.
function Title({ task, editor }: { task: Task; editor: boolean }) {
  const { wid } = useWs()
  const field = useRef<HTMLTextAreaElement>(null)
  const { draft, setDraft, commit, revert } = useCommit(task.title, (v) => {
    const t = v.trim().slice(0, TASK_TITLE_MAX)
    if (t) void updateTask(wid, task, { title: t }, 'rename a task')
  })
  useAutoGrow(field, draft)
  if (!editor) return <span className={styles.title}>{task.title}</span>
  return (
    <textarea
      ref={field}
      className={`${styles.title} ${styles.titleField}`}
      value={draft}
      rows={1}
      maxLength={TASK_TITLE_MAX}
      aria-label="Title"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => (draft.trim() ? commit() : revert())}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), e.currentTarget.blur())
        if (e.key === 'Escape') (revert(), requestAnimationFrame(() => field.current?.blur()))
      }}
    />
  )
}

type InsideProps = { task: Task; cols: { id: string; name: string; done?: boolean }[]; editor: boolean }

function Inside({ task, cols, editor }: InsideProps) {
  const { wid, tasks } = useWs()
  const col = cols.find((c) => c.id === task.col)
  const names = cols.map((c) => c.name)
  return (
    <>
      <PanelSection n={1} name="column">
        <Pills
          values={names}
          value={col?.name}
          editor={editor}
          label="Column"
          onPick={(name) => {
            const to = cols.find((c) => c.name === name)
            if (!to || to.id === task.col) return
            // At the end of the column it goes to.
            const last = tasksIn(tasks.filter((t) => t.pieceId === task.pieceId), to.id).at(-1)?.order
            void moveTask(wid, task, to.id, orderBetween(last, undefined))
          }}
        />
      </PanelSection>
      <Assignee task={task} editor={editor} />
      <Due task={task} finished={!!col?.done} editor={editor} />
      <ForCard task={task} editor={editor} />
      <Checklist task={task} editor={editor} />
      <Notes task={task} editor={editor} />
    </>
  )
}

const NOBODY = ''

// Who it's given to: one member (a square with their initials on the card), or nobody.
function Assignee({ task, editor }: { task: Task; editor: boolean }) {
  const { wid, workspace } = useWs()
  const members = useMembers(wid, 100)
  const listed = members.data.filter((m) => workspace.memberIds.includes(m.id))
  const options = [{ value: NOBODY, label: 'nobody' }, ...listed.map((m) => ({ value: m.id, label: m.name }))]
  // Given to someone who's not loaded (or gone): their name as it was.
  if (task.assignee && !listed.some((m) => m.id === task.assignee)) options.push({ value: task.assignee, label: task.assigneeName ?? 'someone' })
  return (
    <PanelSection n={2} name="given to">
      <Select
        value={task.assignee ?? NOBODY}
        options={options}
        ariaLabel="Given to"
        disabled={!editor}
        onChange={(uid) => {
          const m = listed.find((x) => x.id === uid)
          void updateTask(wid, task, uid ? { assignee: uid, assigneeName: m?.name ?? task.assigneeName } : { assignee: undefined, assigneeName: undefined }, uid ? 'give a task' : 'take a task back')
        }}
      />
    </PanelSection>
  )
}

// When it's due: a day, or none. Past it (and not finished), the card and this say so in magenta.
function Due({ task, finished, editor }: { task: Task; finished: boolean; editor: boolean }) {
  const { wid } = useWs()
  const late = overdue(task, finished)
  return (
    <PanelSection n={3} name="due" count={task.due ? dueText(task.due) : undefined}>
      <div className={own.row}>
        <input
          className={`${styles.input} ${own.date}`}
          type="date"
          value={task.due ?? ''}
          readOnly={!editor}
          aria-label="Due"
          onChange={(e) => editor && void updateTask(wid, task, { due: e.target.value || undefined }, 'set a due day')}
          onKeyDown={(e) => e.stopPropagation()}
        />
        {editor && task.due && (
          <button className={styles.pill} onClick={() => void updateTask(wid, task, { due: undefined }, 'clear a due day')}>
            clear
          </button>
        )}
      </div>
      {late && <p className={styles.warn}>past its day: was due {dueText(task.due!)}</p>}
    </PanelSection>
  )
}

const NO_CARD = { id: '', type: 'idea', pieceId: '', title: '', x: 0, y: 0 } as Card

// The card it's for (a feature, an idea, a problem…, on any plane): its row opens that card's panel; `×` lets go.
function ForCard({ task, editor }: { task: Task; editor: boolean }) {
  const { wid, cards } = useWs()
  const [picking, setPicking] = useState(false)
  const card = task.cardId ? cards.find((c) => c.id === task.cardId) : undefined
  const open = (c: Card) => {
    selectTask('', null)
    useCanvasView.setState({ cardSelected: c.id, labelSelected: null, cardMulti: [] })
  }
  const exclude = useMemo(() => new Set(task.cardId ? [task.cardId] : []), [task.cardId])
  return (
    <PanelSection n={4} name="for" add={editor && !picking ? { label: task.cardId ? 'change' : 'card', onClick: () => setPicking(true) } : undefined} empty={!task.cardId && !picking}>
      {task.cardId && (
        <div className={own.row}>
          {card ? (
            <button className={own.card} style={{ ['--tone' as string]: TYPE_ACCENT[card.type] }} onClick={() => open(card)} title="open its panel">
              <span className={own.cardType}>▌{card.type}</span>
              <span className={own.cardTitle}>{card.title || PLACEHOLDER[card.type]}</span>
              <span className={own.go} aria-hidden>
                ↗
              </span>
            </button>
          ) : (
            <span className={own.gone}>its card is gone</span>
          )}
          {editor && (
            <button className={styles.chipX} style={{ display: 'inline' }} title="let go of it" onClick={() => void updateTask(wid, task, { cardId: undefined, cardType: undefined }, 'unlink a task')}>
              ×
            </button>
          )}
        </div>
      )}
      {picking && (
        <CardPicker
          card={NO_CARD}
          cards={cards}
          types={null}
          exclude={exclude}
          make={false}
          onPick={(c) => {
            setPicking(false)
            void updateTask(wid, task, { cardId: c.id, cardType: c.type }, 'link a task')
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </PanelSection>
  )
}

// Its checklist: `[x]` rows, a click on the box ticks it, on the text types over it; `×` takes one away; `+ step` types
// new ones (Enter adds and keeps typing).
function Checklist({ task, editor }: { task: Task; editor: boolean }) {
  const { wid } = useWs()
  const checks = task.checks ?? []
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState<string | null>(null)
  const set = (next: Check[], key?: string) => void setChecks(wid, task, next, key)
  const ticked = checks.filter((c) => c.done).length
  return (
    <PanelSection n={5} name="checklist" count={checks.length ? `${ticked}/${checks.length}` : undefined} add={editor ? { label: 'step', onClick: () => setAdding(true) } : undefined} empty={!checks.length && !adding}>
      <ul className={own.checks}>
        {checks.map((c) => (
          <li key={c.id} className={own.check} data-done={c.done || undefined}>
            <button className={own.box} aria-pressed={!!c.done} disabled={!editor} aria-label={c.done ? 'untick' : 'tick'} onClick={() => set(checks.map((x) => (x.id === c.id ? { ...x, done: !x.done || undefined } : x)))}>
              [{c.done ? 'x' : ' '}]
            </button>
            {typing === c.id ? (
              <CheckField
                value={c.text}
                onDone={(text) => {
                  setTyping(null)
                  if (text === null || text === c.text) return
                  set(text ? checks.map((x) => (x.id === c.id ? { ...x, text } : x)) : checks.filter((x) => x.id !== c.id), `check:${task.id}:${c.id}`)
                }}
              />
            ) : (
              <span className={own.checkText} onClick={editor ? () => setTyping(c.id) : undefined}>
                {c.text}
              </span>
            )}
            {editor && (
              <button className={styles.chipX} title="take it away" onClick={() => set(checks.filter((x) => x.id !== c.id))}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {adding && (
        <input
          className={styles.input}
          autoFocus
          placeholder="a step"
          value={draft}
          maxLength={CHECK_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft.trim()) set([...checks, newCheck(draft.trim())])
            setAdding(false)
            setDraft('')
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' && draft.trim()) {
              set([...checks, newCheck(draft.trim())])
              setDraft('')
            }
            if (e.key === 'Escape') (setAdding(false), setDraft(''))
          }}
        />
      )}
    </PanelSection>
  )
}

// One step's text typed over: Enter or leaving keeps it (empty takes the step away), Escape puts it back (`null`).
function CheckField({ value, onDone }: { value: string; onDone: (text: string | null) => void }) {
  const [draft, setDraft] = useState(value)
  const over = useRef(false)
  const done = (v: string | null) => {
    if (over.current) return
    over.current = true
    onDone(v === null ? null : v.trim())
  }
  return (
    <input
      className={styles.input}
      autoFocus
      value={draft}
      maxLength={CHECK_MAX}
      aria-label="Step"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => done(draft)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') done(draft)
        if (e.key === 'Escape') done(null)
      }}
    />
  )
}

// Notes: Geist, as long as they are; kept on leaving the field (Enter is a new line), Escape leaves it too.
function Notes({ task, editor }: { task: Task; editor: boolean }) {
  const { wid } = useWs()
  const field = useRef<HTMLTextAreaElement>(null)
  const { draft, setDraft, commit } = useCommit(task.notes ?? '', (v) => void updateTask(wid, task, { notes: v.trim() ? v : undefined }, 'edit a task’s notes'))
  useAutoGrow(field, draft)
  return (
    <PanelSection n={6} name="notes">
      <textarea
        ref={field}
        className={styles.notes}
        rows={2}
        value={draft}
        readOnly={!editor}
        placeholder="What it takes, what done looks like."
        maxLength={20000}
        aria-label="Notes"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') e.currentTarget.blur()
        }}
      />
    </PanelSection>
  )
}
