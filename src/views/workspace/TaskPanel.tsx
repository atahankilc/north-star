// A kanban task's right panel (D-251), in the shell every right panel shares (D-219): its title, then the column it's
// in, who it's given to, when it's due, the card it's for, its checklist and notes. Everything is edited in place and
// undoable; viewers only read. The card it's for opens that card's own panel (LensCardPanel), in place of this one; a
// card's panel opens tasks here the same way (D-254), so it's mounted wherever a card's panel can be: a piece's focus and
// the canvas. Escape closes it. Finished, a task for a card still being tested offers to log what it taught there (D-254).
import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../../data/cards'
import { CHECK_MAX, LABEL_MAX, LABELS_MAX, TASK_PRIORITIES, deleteTask, deleteTasks, moveTasks, updateTasks, logLearned, moveTask, newCheck, orderBetween, overdue, setChecks, tasksIn, TASK_TITLE_MAX, today, untested, updateTask, type Check, type Task } from '../../data/tasks'
import type { Evidence } from '../../data/evidence'
import { useMembers } from '../../data/workspaces'
import { useCanvasView } from '../../state/canvasView'
import { useAutoGrow } from '../../ui/autoGrow'
import { PanelAction, PanelSection, SidePanel } from '../../ui/SidePanel'
import { Select } from '../../ui/Select'
import { CardPicker, EvidenceForm, Pills, PLACEHOLDER, useCommit } from './CardPanel'
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
  // Several selected (D-258): `N selected`.
  const manyIds = useKanbanUi((s) => s.many)
  const many = manyIds ? tasks.filter((t) => manyIds.tasks.includes(t.id)) : []
  const manyPiece = manyIds ? pieces.find((p) => p.id === manyIds.piece) : undefined
  const piece = task ? pieces.find((p) => p.id === task.pieceId) : undefined
  const close = () => selectTask('', null)
  // Beside a plane, over the plane's part of the screen (as a card's, D-211).
  const right = useCanvasView((s) => (s.beside ? s.size.w - Math.round(s.size.w * s.split) : 0))
  // A card picked closes it (its panel takes the place); so does this panel going (leaving a focus).
  const card = useCanvasView((s) => s.cardSelected)
  const was = useRef(card)
  useEffect(() => {
    if (card && card !== was.current) close()
    was.current = card
  }, [card])
  useEffect(() => close, [])
  // Escape closes it, unless typing somewhere or a menu or thread hears it first.
  const open = !!task || many.length > 1
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key !== 'Escape' || t?.closest('input, textarea, [contenteditable], [role=menu], [role=dialog], [role=listbox]')) return
      e.stopImmediatePropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
  return (
    <AnimatePresence>
      {many.length > 1 && manyPiece && (
        <SidePanel
          key="task"
          kind="tasks"
          tone={TONE}
          label={`${many.length} tasks selected`}
          title={`${many.length} selected`}
          right={right}
          onClose={close}
          actions={
            editor && (
              <PanelAction
                label={`delete ${many.length}`}
                danger
                title="Delete or Backspace"
                onClick={() => {
                  close()
                  void deleteTasks(wid, many.map((t) => t.id))
                }}
              />
            )
          }
        >
          <ManyInside tasks={many} cols={kanbanOf(manyPiece).cols} editor={editor} />
        </SidePanel>
      )}
      {task && piece && many.length < 2 && (
        <SidePanel
          // One panel while tasks change under it: it builds only when it opens.
          key="task"
          kind="task"
          tone={TONE}
          label={`task ${task.title}`}
          title={<Title key={task.id} task={task} editor={editor} />}
          right={right}
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

// Several tasks selected (D-258): what they are (how many in which column), then, each one undo step for all of them:
// move them to a column (to its end, in their order), give them to someone (or nobody), set their due day (or clear
// it); `[delete N]` at the foot. A value they don't share reads `several`.
function ManyInside({ tasks: picked, cols, editor }: { tasks: Task[]; cols: { id: string; name: string; done?: boolean }[]; editor: boolean }) {
  const { wid, workspace, tasks } = useWs()
  const members = useMembers(wid, 100).data.filter((m) => workspace.memberIds.includes(m.id))
  const ids = picked.map((t) => t.id)
  const inCol = cols.map((c) => [c, picked.filter((t) => t.col === c.id).length] as const).filter(([, n]) => n)
  const same = <T,>(f: (t: Task) => T) => (picked.every((t) => f(t) === f(picked[0])) ? f(picked[0]) : SEVERAL)
  const col = same((t) => t.col)
  const who = same((t) => t.assignee ?? NOBODY)
  const due = same((t) => t.due ?? '')
  const ordered = cols.flatMap((c) => tasksIn(picked, c.id))
  const moveTo = (to: string) => {
    let last = tasksIn(tasks.filter((t) => t.pieceId === picked[0].pieceId && !ids.includes(t.id)), to).at(-1)?.order ?? 0
    void moveTasks(wid, ordered.map((t) => ({ id: t.id, col: to, order: (last += 1) })), `move ${ids.length} tasks`)
  }
  const options = [
    ...(who === SEVERAL ? [{ value: SEVERAL, label: 'several' }] : []),
    { value: NOBODY, label: 'nobody' },
    ...members.map((m) => ({ value: m.id, label: m.name })),
  ]
  return (
    <>
      <div className={styles.under}>{inCol.map(([c, n]) => `${n} in ${c.name}`).join(' · ')}</div>
      <PanelSection n={1} name="move to">
        <Pills values={cols.map((c) => c.name)} value={col === SEVERAL ? undefined : cols.find((c) => c.id === col)?.name} editor={editor} label="Move to" onPick={(name) => {
          const to = cols.find((c) => c.name === name)
          if (to) moveTo(to.id)
        }} />
      </PanelSection>
      <PanelSection n={2} name="given to">
        <Select
          value={who}
          options={options}
          ariaLabel="Give them to"
          disabled={!editor}
          onChange={(uid) => {
            if (uid === SEVERAL) return
            const m = members.find((x) => x.id === uid)
            void updateTasks(wid, ids, uid === NOBODY ? { assignee: undefined, assigneeName: undefined } : { assignee: uid, assigneeName: m?.name }, uid === NOBODY ? `take ${ids.length} tasks back` : `give ${ids.length} tasks`)
          }}
        />
      </PanelSection>
      <PanelSection n={3} name="due" count={due === SEVERAL ? 'several' : due ? dueText(due) : undefined}>
        <div className={own.row}>
          <input
            className={`${styles.input} ${own.date}`}
            type="date"
            value={due === SEVERAL ? '' : due}
            readOnly={!editor}
            aria-label="Due"
            onChange={(e) => editor && void updateTasks(wid, ids, { due: e.target.value || undefined }, `set ${ids.length} tasks’ due day`)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {editor && due !== '' && (
            <button className={styles.pill} onClick={() => void updateTasks(wid, ids, { due: undefined }, `clear ${ids.length} tasks’ due day`)}>
              clear
            </button>
          )}
        </div>
      </PanelSection>
    </>
  )
}
const SEVERAL = '\u0000several'

type InsideProps = { task: Task; cols: { id: string; name: string; done?: boolean }[]; editor: boolean }

function Inside({ task, cols, editor }: InsideProps) {
  const { wid, tasks, cards } = useWs()
  const col = cols.find((c) => c.id === task.col)
  // `learned` is a section only when there's something in it, the ones after it numbered on.
  const learns = (task.learned && task.learned !== 'skip') || (editor && learnable(task, cards.find((c) => c.id === task.cardId), !!col?.done))
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
      <Assignee task={task} editor={editor} n={2} />
      <Due task={task} finished={!!col?.done} editor={editor} n={3} />
      <Priority task={task} editor={editor} n={4} />
      <Labels task={task} editor={editor} n={5} />
      <ForCard task={task} editor={editor} n={6} />
      {learns && <Learned task={task} finished={!!col?.done} editor={editor} n={7} />}
      <Checklist task={task} editor={editor} n={learns ? 8 : 7} />
      <Notes task={task} editor={editor} n={learns ? 9 : 8} />
    </>
  )
}

const NOBODY = ''

// Who it's given to: one member (a square with their initials on the card), or nobody.
function Assignee({ task, editor, n }: { task: Task; editor: boolean; n: number }) {
  const { wid, workspace } = useWs()
  const members = useMembers(wid, 100)
  const listed = members.data.filter((m) => workspace.memberIds.includes(m.id))
  const options = [{ value: NOBODY, label: 'nobody' }, ...listed.map((m) => ({ value: m.id, label: m.name }))]
  // Given to someone who's not loaded (or gone): their name as it was.
  if (task.assignee && !listed.some((m) => m.id === task.assignee)) options.push({ value: task.assignee, label: task.assigneeName ?? 'someone' })
  return (
    <PanelSection n={n} name="given to">
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
function Due({ task, finished, editor, n }: { task: Task; finished: boolean; editor: boolean; n: number }) {
  const { wid } = useWs()
  const late = overdue(task, finished)
  return (
    <PanelSection n={n} name="due" count={task.due ? dueText(task.due) : undefined}>
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

// What a finished task taught (D-254): for a customer, problem or idea still being tested, `+ log it on the card` opens
// the card's evidence form (D-137) filled with the task's title and notes, today, an observation; adding it puts the
// evidence on the card and marks the task (one undo step); `not now` stops asking. Logged, the evidence's line, and its
// card's panel a click away. Only once it's in a finished column, and only while there's something to say.
export function learnable(task: Task, card: Card | undefined, finished: boolean) {
  return finished && !task.learned && untested(card)
}

function Learned({ task, finished, editor, n }: { task: Task; finished: boolean; editor: boolean; n: number }) {
  const { wid, cards, evidence } = useWs()
  const card = task.cardId ? cards.find((c) => c.id === task.cardId) : undefined
  const asked = useKanbanUi((s) => s.learning === task.id)
  const [open, setOpen] = useState(asked)
  useEffect(() => {
    if (!asked) return
    setOpen(true)
    useKanbanUi.setState({ learning: null })
  }, [asked])
  const logged = task.learned && task.learned !== 'skip' ? evidence.find((e) => e.id === task.learned) : undefined
  if (logged)
    return (
      <PanelSection n={n} name="learned" count={logged.stance === 'supports' ? 'supports it' : 'against it'}>
        <p className={own.learned}>
          <span className={own.cell} data-filled={logged.stance === 'supports' || undefined} aria-hidden />
          {logged.text}
        </p>
      </PanelSection>
    )
  if (!editor || !card || !learnable(task, card, finished)) return null
  const start: Partial<Evidence> = { text: task.notes?.trim() ? `${task.title}: ${task.notes.trim()}` : task.title, kind: 'observation', date: today() }
  return (
    <PanelSection n={n} name="learned" add={open ? undefined : { label: 'log it on the card', onClick: () => setOpen(true) }}>
      {open ? (
        <EvidenceForm
          start={start}
          onDone={(fields) => {
            setOpen(false)
            if (fields) void logLearned(wid, task, { ...fields, nodeId: card.id, nodeType: card.type as Evidence['nodeType'] })
          }}
        />
      ) : (
        <p className={own.offer}>
          Finished. What did it teach about “{card.title || PLACEHOLDER[card.type]}”?{' '}
          <button className={styles.pill} onClick={() => void updateTask(wid, task, { learned: 'skip' }, 'not log a task')}>
            not now
          </button>
        </p>
      )}
    </PanelSection>
  )
}

// How urgent (D-256): `[P1] [P2] [P3]`, a click on the picked one clears it.
function Priority({ task, editor, n }: { task: Task; editor: boolean; n: number }) {
  const { wid } = useWs()
  return (
    <PanelSection n={n} name="priority">
      <Pills values={TASK_PRIORITIES} value={task.priority} editor={editor} label="Priority" onPick={(v) => void updateTask(wid, task, { priority: v }, v ? 'set a task’s priority' : 'clear a task’s priority')} />
    </PanelSection>
  )
}

// Its #labels (D-256), as a card's tags (D-056): chips, `×` on hover; `+ label` types one (Enter adds and keeps typing, a
// leading `#` dropped); the kanban's other labels offered as you type.
function Labels({ task, editor, n }: { task: Task; editor: boolean; n: number }) {
  const { wid, tasks } = useWs()
  const labels = task.labels ?? []
  const [draft, setDraft] = useState<string | null>(null)
  const set = (next: string[]) => void updateTask(wid, task, { labels: next.length ? next : undefined }, 'label a task')
  const known = [...new Set(tasks.filter((t) => t.pieceId === task.pieceId).flatMap((t) => t.labels ?? []))].filter((l) => !labels.includes(l)).sort()
  const typed = (draft ?? '').trim().replace(/^#/, '').toLowerCase()
  const offer = draft === null ? [] : known.filter((l) => l.toLowerCase().includes(typed)).slice(0, 6)
  const add = (l: string) => {
    const t = l.trim().replace(/^#/, '').slice(0, LABEL_MAX)
    if (t && !labels.includes(t) && labels.length < LABELS_MAX) set([...labels, t])
    setDraft('')
  }
  return (
    <PanelSection n={n} name="labels" add={editor && draft === null ? { label: 'label', onClick: () => setDraft('') } : undefined} empty={!labels.length && draft === null}>
      <div className={styles.tags}>
        {labels.map((l) => (
          <span key={l} className={styles.chip}>
            #{l}
            {editor && (
              <button className={styles.chipX} title="Remove" onClick={() => set(labels.filter((x) => x !== l))}>
                ×
              </button>
            )}
          </span>
        ))}
        {draft !== null && (
          <input
            className={`${styles.input} ${styles.tagInput}`}
            autoFocus
            placeholder="label"
            value={draft}
            maxLength={LABEL_MAX}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => setDraft(null)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter' && typed) add(draft)
              if (e.key === 'Escape') setDraft(null)
            }}
          />
        )}
      </div>
      {offer.length > 0 && (
        <div className={styles.pills}>
          {offer.map((l) => (
            <button key={l} className={styles.pill} onMouseDown={(e) => e.preventDefault()} onClick={() => add(l)}>
              #{l}
            </button>
          ))}
        </div>
      )}
    </PanelSection>
  )
}

const NO_CARD = { id: '', type: 'idea', pieceId: '', title: '', x: 0, y: 0 } as Card

// The card it's for (a feature, an idea, a problem…, on any plane): its row opens that card's panel; `×` lets go.
function ForCard({ task, editor, n }: { task: Task; editor: boolean; n: number }) {
  const { wid, cards } = useWs()
  const [picking, setPicking] = useState(false)
  const card = task.cardId ? cards.find((c) => c.id === task.cardId) : undefined
  const open = (c: Card) => {
    selectTask('', null)
    useCanvasView.setState({ cardSelected: c.id, labelSelected: null, cardMulti: [] })
  }
  const exclude = useMemo(() => new Set(task.cardId ? [task.cardId] : []), [task.cardId])
  return (
    <PanelSection n={n} name="for" add={editor && !picking ? { label: task.cardId ? 'change' : 'card', onClick: () => setPicking(true) } : undefined} empty={!task.cardId && !picking}>
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
function Checklist({ task, editor, n }: { task: Task; editor: boolean; n: number }) {
  const { wid } = useWs()
  const checks = task.checks ?? []
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState<string | null>(null)
  const set = (next: Check[], key?: string) => void setChecks(wid, task, next, key)
  const ticked = checks.filter((c) => c.done).length
  return (
    <PanelSection n={n} name="checklist" count={checks.length ? `${ticked}/${checks.length}` : undefined} add={editor ? { label: 'step', onClick: () => setAdding(true) } : undefined} empty={!checks.length && !adding}>
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
function Notes({ task, editor, n }: { task: Task; editor: boolean; n: number }) {
  const { wid } = useWs()
  const field = useRef<HTMLTextAreaElement>(null)
  const { draft, setDraft, commit } = useCommit(task.notes ?? '', (v) => void updateTask(wid, task, { notes: v.trim() ? v : undefined }, 'edit a task’s notes'))
  useAutoGrow(field, draft)
  return (
    <PanelSection n={n} name="notes">
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
