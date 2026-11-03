// A kanban task's right panel (D-251), in the shell every right panel shares (D-219): its title, then the column it's
// in, who it's given to, when it's due, the card it's for, its checklist and notes. Everything is edited in place and
// undoable; viewers only read. The card it's for opens that card's own panel (LensCardPanel), in place of this one; a
// card's panel opens tasks here the same way (D-254), so it's mounted wherever a card's panel can be: a piece's focus and
// the canvas. Escape closes it. Finished, a task for a card still being tested offers to log what it taught there (D-254).
// With the tasks side view open (D-300) it opens inside that, over its right part (the board or days still seen on its
// left), never over a plane's part where cards' panels go: `[full]` fills the side view, `‹ back` makes it narrow again;
// `[show on board]` and `[show on days]` take you to it there, on purpose (nothing switches by itself).
import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { isOnPlane, type Card } from '../../../data/cards'
import { CHECK_MAX, LABEL_MAX, LABELS_MAX, TASK_PRIORITIES, deleteTask, deleteTasks, moveTasks, updateTasks, logLearned, moveTask, newCheck, orderBetween, overdue, setChecks, tasksIn, TASK_TITLE_MAX, today, untested, updateTask, type Check, type Task } from '../../../data/tasks'
import type { Evidence } from '../../../data/evidence'
import { useWorkspaceMembers } from '../../../data/workspaces'
import { useBesideW, useCanvasView } from '../../../state/canvasView'
import { PanelAction, PanelSection, SidePanel } from '../../../ui/patterns/SidePanel'
import { Select } from '../../../ui/patterns/Select'
import { CardPicker, EvidenceForm, PLACEHOLDER } from './CardPanel'
import { useWs } from '../canvas/context'
import { kanbanOf, selectTask, useKanbanUi } from '../deck/Kanban'
import { dueText } from '../../../model/tasks'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { useTasksSide } from '../deck/sideState'
import styles from './CardPanel.module.css'
import own from './TaskPanel.module.css'
import { Checkbox } from '../../../ui/primitives/Checkbox'
import { Button } from '../../../ui/primitives/Button'
import { Choice } from '../../../ui/primitives/Choice'
import { Field } from '../../../ui/primitives/Field'
import { CommitField } from '../../../ui/primitives/CommitField'
import { Label } from '../../../ui/primitives/Label'
import { CardRow } from '../cards/CardRow'
import { TASK_NOTES_MAX } from '../../../model/limits'
import { TagList } from './TagList'
import { NotesSection } from './NotesSection'
import { usePicker } from './usePicker'

const TONE = 'var(--accent-cyan)'

// A task's panel in the tasks side view (D-300): its width there, unless it fills it.
const SIDE_TASK_W = 330

// The side view open on a deck, its days or not (the task stays picked, lit there).
const showIn = (deck: string, days: boolean) => useTasksSide.setState({ open: true, linked: null, tab: deck, days })

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
  const beside = useBesideW()
  // Inside the tasks side view (D-300): flush with its right edge, narrow or filling it.
  const inSide = useTasksSide((s) => s.open)
  const full = useTasksSide((s) => s.taskFull)
  const right = inSide ? 0 : beside
  const width = inSide ? (full ? beside : Math.min(SIDE_TASK_W, beside)) : undefined
  const tools = inSide && (
    <Button onClick={() => useTasksSide.setState({ taskFull: !full })} title={full ? 'narrow again, the board beside it' : 'fill the side view'}>
      {full ? '‹ back' : 'full'}
    </Button>
  )
  // A card picked closes it (its panel takes the place). Going into a space or out of one lets go (CanvasView's focus
  // and unfocus), not this panel going: it's mounted per space, and remounted in development.
  const card = useCanvasView((s) => s.cardSelected)
  const was = useRef(card)
  useEffect(() => {
    if (card && card !== was.current) close()
    was.current = card
  }, [card])
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
          width={width}
          tools={tools}
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
          width={width}
          tools={tools}
          onClose={close}
          actions={
            <>
              {/* Where it is, on purpose (D-300): its deck's board, or the deck with its days open. */}
              <PanelAction label="show on board" title="its deck's board in the side view, the task lit" onClick={() => showIn(piece.id, false)} />
              <PanelAction label="show on days" title="its deck's days in the side view, the task lit" onClick={() => showIn(piece.id, true)} />
              {editor && (
                <PanelAction
                  label="delete"
                  danger
                  title="Delete or Backspace"
                  onClick={() => {
                    close()
                    void deleteTask(wid, task)
                  }}
                />
              )}
            </>
          }
        >
          <Inside key={task.id} task={task} cols={kanbanOf(piece).cols} editor={editor} />
        </SidePanel>
      )}
    </AnimatePresence>
  )
}

// Its title: Inter, typed in place; Enter keeps it, Escape puts it back. A task always has one.
function Title({ task, editor }: { task: Task; editor: boolean }) {
  const { wid } = useWs()
  if (!editor) return <span className={styles.title}>{task.title}</span>
  return (
    <CommitField
      enter="shift"
      empty="undo"
      className={`${styles.title} ${styles.titleField}`}
      value={task.title}
      maxLength={TASK_TITLE_MAX}
      label="Title"
      onSave={(v) => {
        const t = v.trim().slice(0, TASK_TITLE_MAX)
        if (t) void updateTask(wid, task, { title: t }, 'rename a task')
      }}
    />
  )
}

// Several tasks selected (D-258): what they are (how many in which column), then, each one undo step for all of them:
// move them to a column (to its end, in their order), give them to someone (or nobody), set their due day (or clear
// it); `[delete N]` at the foot. A value they don't share reads `several`.
function ManyInside({ tasks: picked, cols, editor }: { tasks: Task[]; cols: { id: string; name: string; done?: boolean }[]; editor: boolean }) {
  const { wid, workspace, tasks } = useWs()
  const members = useWorkspaceMembers(wid, workspace.memberIds)
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
        <Choice bare clearable options={cols.map((c) => c.name)} value={col === SEVERAL ? undefined : cols.find((c) => c.id === col)?.name} disabled={!editor} label="Move to" onChange={(name) => {
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
          <Field
            size="sm"
            className={own.date}
            type="date"
            value={due === SEVERAL ? '' : due}
            readOnly={!editor}
            label="Due"
            onChange={(v) => editor && void updateTasks(wid, ids, { due: v || undefined }, `set ${ids.length} tasks’ due day`)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {editor && due !== '' && (
            <Button onClick={() => void updateTasks(wid, ids, { due: undefined }, `clear ${ids.length} tasks’ due day`)}>
              clear
            </Button>
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
        <Choice bare clearable options={names} value={col?.name} disabled={!editor} label="Column" onChange={(name) => {
            const to = cols.find((c) => c.name === name)
            if (!to || to.id === task.col) return
            // At the end of the column it goes to.
            const last = tasksIn(tasks.filter((t) => t.pieceId === task.pieceId), to.id).at(-1)?.order
            void moveTask(wid, task, to.id, orderBetween(last, undefined))
          }} />
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
  const listed = useWorkspaceMembers(wid, workspace.memberIds)
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

// When it's done: from a first day (D-304, or none: just a due day) to its due day. A first day after the due day takes
// the due day with it, a due day before the first day the first day; one undo step. Past its due day (and not finished),
// the card and this say so in magenta.
function Due({ task, finished, editor, n }: { task: Task; finished: boolean; editor: boolean; n: number }) {
  const { wid } = useWs()
  const late = overdue(task, finished)
  const days = task.start && task.due ? Math.round((Date.parse(task.due) - Date.parse(task.start)) / 86400000) + 1 : 0
  const setStart = (start: string) => void updateTask(wid, task, start && task.due && start > task.due ? { start, due: start } : { start: start || undefined }, start ? 'set a first day' : 'clear a first day')
  // No due day, no first day either: a task without one sits in the tray, and an old first day would come back with
  // the next due day.
  const setDue = (due: string) => void updateTask(wid, task, !due ? { start: undefined, due: undefined } : task.start && due < task.start ? { start: due, due } : { due }, due ? 'set a due day' : 'clear a due day')
  return (
    <PanelSection n={n} name="when" count={task.due ? `${task.start ? `${dueText(task.start)} → ` : ''}${dueText(task.due)}${days > 1 ? ` · ${days} days` : ''}` : undefined}>
      <div className={own.row}>
        <Field
          size="sm"
          className={own.date}
          type="date"
          value={task.start ?? ''}
          max={task.due}
          readOnly={!editor}
          label="First day"
          title="its first day (optional)"
          onChange={(v) => editor && setStart(v)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <span className={own.to}>→</span>
        <Field
          size="sm"
          className={own.date}
          type="date"
          value={task.due ?? ''}
          readOnly={!editor}
          label="Due"
          title="its due day"
          onChange={(v) => editor && setDue(v)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        {editor && (task.due || task.start) && (
          <Button onClick={() => void updateTask(wid, task, { start: undefined, due: undefined }, 'clear a task’s days')}>
            clear
          </Button>
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
          <Button onClick={() => void updateTask(wid, task, { learned: 'skip' }, 'not log a task')}>
            not now
          </Button>
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
      <Choice bare clearable options={TASK_PRIORITIES} value={task.priority} disabled={!editor} label="Priority" onChange={(v) => void updateTask(wid, task, { priority: v }, v ? 'set a task’s priority' : 'clear a task’s priority')} />
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
  const known = [...new Set(tasks.filter((t) => t.pieceId === task.pieceId).flatMap((t) => t.labels ?? []))].sort()
  return (
    <PanelSection n={n} name="labels" add={editor && draft === null ? { label: 'label', onClick: () => setDraft('') } : undefined} empty={!labels.length && draft === null}>
      <TagList items={labels} editor={editor} word="label" max={LABEL_MAX} room={LABELS_MAX} suggest={known} draft={draft} onDraft={setDraft} onAdd={(t) => set([...labels, t])} onRemove={(t) => set(labels.filter((x) => x !== t))} />
    </PanelSection>
  )
}

const NO_CARD = { id: '', type: 'idea', pieceId: '', title: '', x: 0, y: 0 } as Card

// The card it's for (a feature, an idea, a problem…, on any plane): its row opens that card's panel; `×` lets go.
function ForCard({ task, editor, n }: { task: Task; editor: boolean; n: number }) {
  const { wid, cards, tasks, pieces } = useWs()
  const { picking, close, add } = usePicker()
  // What the picker offers first (D-299): what this kanban's other tasks are for most, then the cards on the plane the
  // kanban is stuck to.
  const suggest = useMemo(() => {
    if (!picking) return []
    const out: { id: string; why: string }[] = []
    const add = (id: string, why: string) => !out.some((x) => x.id === id) && out.push({ id, why })
    const count = new Map<string, number>()
    for (const t of tasks) if (t.pieceId === task.pieceId && t.cardId && t.id !== task.id) count.set(t.cardId, (count.get(t.cardId) ?? 0) + 1)
    for (const [id, k] of [...count].sort((a, b) => b[1] - a[1]).slice(0, 3)) add(id, `${k} on this deck`)
    const plane = pieces.find((p) => p.id === task.pieceId)?.stuckTo
    const name = pieces.find((p) => p.id === plane)?.name?.trim() || 'its plane'
    if (plane) for (const c of cards.filter((c) => isOnPlane(c, plane)).slice(0, 5)) add(c.id, `on ${name}`)
    return out
  }, [picking, tasks, task.pieceId, task.id, pieces, cards])
  const card = task.cardId ? cards.find((c) => c.id === task.cardId) : undefined
  const open = (c: Card) => {
    selectTask('', null)
    useCanvasView.setState({ cardSelected: c.id, labelSelected: null, cardMulti: [] })
  }
  const exclude = useMemo(() => new Set(task.cardId ? [task.cardId] : []), [task.cardId])
  return (
    <PanelSection n={n} name="for" add={add(task.cardId ? 'change' : 'card', editor)} empty={!task.cardId && !picking}>
      {task.cardId && (
        <div className={own.row}>
          {card ? (
            <CardRow
              className={own.card}
              tone={CARD_TONE[card.type]}
              hint="open its panel"
              onClick={() => open(card)}
              lead={<Label className={own.cardType}>{card.type}</Label>}
              title={card.title || PLACEHOLDER[card.type]}
              empty={!card.title}
              end={
                <span className={own.go} aria-hidden>
                  ↗
                </span>
              }
            />
          ) : (
            <span className={own.gone}>its card is gone</span>
          )}
          {editor && (
            <Button icon tone="danger" className={styles.chipX} style={{ display: 'inline-flex' }} title="let go of it" onClick={() => void updateTask(wid, task, { cardId: undefined, cardType: undefined }, 'unlink a task')}>
              ×
            </Button>
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
          suggest={suggest}
          onPick={(c) => {
            close()
            void updateTask(wid, task, { cardId: c.id, cardType: c.type }, 'link a task')
          }}
          onClose={close}
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
            {/* The box alone (no label): its text beside it is typed in place, so a click there must not tick it. */}
            <Checkbox checked={!!c.done} disabled={!editor} tone="var(--accent-green)" aria-label={c.done ? 'untick' : 'tick'} onChange={() => set(checks.map((x) => (x.id === c.id ? { ...x, done: !x.done || undefined } : x)))} />
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
              <Button icon tone="danger" className={styles.chipX} title="take it away" onClick={() => set(checks.filter((x) => x.id !== c.id))}>
                ×
              </Button>
            )}
          </li>
        ))}
      </ul>
      {adding && (
        <Field
          size="sm"
          label="A step"
          autoFocus
          placeholder="a step"
          value={draft}
          maxLength={CHECK_MAX}
          onChange={setDraft}
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
    <Field
      size="sm"
      autoFocus
      value={draft}
      maxLength={CHECK_MAX}
      label="Step"
      onChange={setDraft}
      onBlur={() => done(draft)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') done(draft)
        if (e.key === 'Escape') done(null)
      }}
    />
  )
}

function Notes({ task, editor, n }: { task: Task; editor: boolean; n: number }) {
  const { wid } = useWs()
  return <NotesSection n={n} value={task.notes} placeholder="What it takes, what done looks like." max={TASK_NOTES_MAX} editor={editor} onSave={(v) => void updateTask(wid, task, { notes: v }, 'edit a task’s notes')} />
}
