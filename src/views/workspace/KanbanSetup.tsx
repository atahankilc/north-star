// A kanban's setup (D-268), in the matrix's and table's way (D-212, D-218): a tabbed panel over the bottom middle of its
// space, above the dock: holds · cards · columns. Holds: tasks (its own columns, D-251) or cards. Cards: which, by the
// table's rules (D-209: plane, type, status, tag, title; cards added by hand). Columns: the field they come from (status,
// impact, effort, priority), `no value` always first; rows from another, or none (D-269). Boxes (D-269): with rows, a
// name for any box (column × row), plain, washed green or named in magenta. Every change is one undo step. The same editors make a new kanban
// in the wizard (KanbanWizard.tsx), on a draft.
// A kanban with tasks on it never hides them (D-300): switched to cards, it asks where they go first (a new kanban for
// the cards beside it, or the tasks moved to another kanban); one that hid them before this says so, in the same place.
import { useState } from 'react'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { BOX_NAME_MAX, BOX_NAMES_MAX, CARD_FIELDS, emptyKanban, moveTasksAway, setKanbanSetup, tasksIn, type BoxName, type CardField, type KanbanSetup, type Task, type TaskMove } from '../../data/tasks'
import { addPiece, GRID, PIECE_SIZE } from '../../data/pieces'
import { setEditing } from '../../state/canvasView'
import { findGo } from './find'
import type { Source } from '../../data/source'
import type { TableSetup } from '../../data/table'
import { Choices, Row } from './MatrixSetup'
import { RowsEditor } from './TableSetup'
import { kanbanOf, KANBAN_TABS, useKanbanUi, type KanbanTab } from './Kanban'
import { columnsOf, FIELD_NAME, heldCards, KANBAN_TEMPLATES, NO_VALUE, rowFieldOf, rowsOfField } from './kanbanCards'
import { AutosaveField } from '../../ui/AutosaveField'
import styles from './Kanban.module.css'
import { useWs } from './context'
import m from './Matrix.module.css'

const TAB_NAME: Record<KanbanTab, string> = { holds: 'holds', cards: 'cards', cols: 'columns', boxes: 'boxes' }

// One part changed: on the piece, or on the wizard's draft.
export type KanbanPatch = Partial<Pick<KanbanSetup, 'holds' | 'source' | 'colField' | 'rowField' | 'names'>>
export type SetKanban = (patch: KanbanPatch, what: string, key?: string) => void

// What a kanban holding cards starts with when switched to it: features by status (the template's).
export const CARDS_START = KANBAN_TEMPLATES[1].setup() as Required<Pick<KanbanPatch, 'colField' | 'source'>>

export function KanbanSetupPanel({ piece }: { piece: WithId<Piece> }) {
  const { wid, cards, tasks } = useWs()
  const held = tasks.filter((t) => t.pieceId === piece.id)
  // Cards picked while it holds tasks: where they go is asked first (D-300).
  const [asking, setAsking] = useState(false)
  const setup = kanbanOf(piece)
  const tab = useKanbanUi((s) => s.tab)
  const close = () => useKanbanUi.setState({ setup: null })
  const set: SetKanban = (patch, what, key) => void setKanbanSetup(wid, piece.id, patch, what, key)
  const cardsHere = setup.holds === 'cards'
  const count = {
    holds: undefined,
    cards: cardsHere ? heldCards(piece, cards).length : undefined,
    cols: cardsHere ? columnsOf(setup.colField ?? 'status', heldCards(piece, cards)).length : setup.cols.length,
    boxes: cardsHere && rowFieldOf(setup) ? (setup.names?.length ?? 0) : undefined,
  }
  return (
    <section className={m.setup} data-learn="setup" aria-label="Set up the deck" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())}>
      <header className={m.setupHead}>
        <nav className={m.tabs} role="tablist" aria-label="Setup">
          {KANBAN_TABS.map((t) => (
            <button key={t} role="tab" aria-selected={t === tab} className={m.tab} onClick={() => useKanbanUi.setState({ tab: t })}>
              {TAB_NAME[t]}
              {count[t] !== undefined && <span className={m.tabCount}>{count[t]}</span>}
            </button>
          ))}
        </nav>
        <span className={m.setupEnd}>
          <button className={m.tool} title="close (Esc)" onClick={close}>
            done
          </button>
        </span>
      </header>
      <div className={m.setupBody} role="tabpanel">
        <KanbanEditor tab={tab} setup={setup} onChange={set} onHoldCards={held.length ? () => setAsking(true) : undefined} />
        {tab === 'holds' && held.length > 0 && (asking || cardsHere) && <HeldTasks piece={piece} held={held} onDone={() => setAsking(false)} />}
      </div>
    </section>
  )
}

// One tab's editor, on the piece or a draft. `onHoldCards`: it holds tasks, so cards picked asks first (D-300).
export function KanbanEditor({ tab, setup, onChange, onHoldCards }: { tab: KanbanTab; setup: KanbanSetup; onChange: SetKanban; onHoldCards?: () => void }) {
  const cardsHere = setup.holds === 'cards'
  if (tab === 'holds')
    return (
      <Row label="it holds" hint="a deck holds tasks or cards, never both">
        <Choices<'tasks' | 'cards'>
          value={cardsHere ? 'cards' : 'tasks'}
          options={[
            { value: 'tasks', label: 'tasks', hint: 'the team’s work, in its own columns; given to, due, a checklist' },
            { value: 'cards', label: 'cards', hint: 'cards from the planes, in columns from one of their fields; dragging one sets it' },
          ]}
          onChange={(v) =>
            v === 'cards' && !cardsHere && onHoldCards
              ? onHoldCards()
              : v === 'cards'
              ? onChange({ holds: 'cards', colField: setup.colField ?? CARDS_START.colField, source: setup.source ?? CARDS_START.source }, 'hold cards on a deck')
              : onChange({ holds: undefined }, 'hold tasks on a deck')
          }
        />
      </Row>
    )
  if (!cardsHere)
    return (
      <Row label={TAB_NAME[tab]}>
        <span className={m.checkHint}>
          {tab === 'cards' ? 'it holds tasks: a task points at a card from its panel' : tab === 'cols' ? 'its own: renamed by a double-click on a head, added with + column' : 'boxes are for a deck holding cards, with rows'}
        </span>
      </Row>
    )
  if (tab === 'cards') {
    const source: Source = setup.source ?? { rules: [], items: [] }
    // The table's editor, on a table-shaped draft of the source alone.
    const asTable = { rows: source, cols: [] } as TableSetup
    return <RowsEditor setup={asTable} cardsOnly onChange={(part, v, key) => part === 'rows' && onChange({ source: v as Source }, 'change which cards a deck holds', key)} />
  }
  if (tab === 'boxes') return <BoxesEditor setup={setup} onChange={onChange} />
  const field = setup.colField ?? 'status'
  const row = rowFieldOf(setup)
  return (
    <>
      <Row label="columns from" hint="no value comes first: its cards haven't got one yet; drag them out to set it">
        <Choices<CardField>
          value={field}
          options={CARD_FIELDS.map((f) => ({ value: f, label: FIELD_NAME[f], hint: HINT[f] }))}
          // The rows' field can't be the columns' too: it goes.
          onChange={(f) => onChange({ colField: f, ...(f === setup.rowField ? { rowField: undefined } : {}) }, `a deck’s columns by ${FIELD_NAME[f]}`)}
        />
      </Row>
      <Row label="rows from" hint="none, or another field: then each box is a column × a row, and dropping a card in one sets both">
        <Choices<CardField | 'none'>
          value={row ?? 'none'}
          options={[{ value: 'none' as const, label: 'none', hint: 'one row' }, ...CARD_FIELDS.filter((f) => f !== field).map((f) => ({ value: f, label: FIELD_NAME[f], hint: HINT[f] }))]}
          onChange={(f) => onChange({ rowField: f === 'none' ? undefined : f }, f === 'none' ? 'no rows on a deck' : `a deck’s rows by ${FIELD_NAME[f]}`)}
        />
      </Row>
    </>
  )
}

// Its tasks, when it's switching to cards or already holds cards (D-300): never hidden on it. Switching: a new kanban
// for the cards next to it (first, Enter: nothing moves), or the tasks moved to another kanban and this one holding cards
// (one undo step), or tasks kept. Holding cards already, with tasks from before: moved, or it holds tasks again.
function HeldTasks({ piece, held, onDone }: { piece: WithId<Piece>; held: Task[]; onDone: () => void }) {
  const { wid, pieces, tasks: allTasks } = useWs()
  const setup = kanbanOf(piece)
  const cardsHere = setup.holds === 'cards'
  const [picking, setPicking] = useState(false)
  const others = pieces.filter((p) => p.id !== piece.id && p.kind === 'kanban' && kanbanOf(p).holds !== 'cards')
  const n = held.length
  const tasksWord = `${n} task${n === 1 ? '' : 's'}`
  const toCards = { holds: 'cards' as const, colField: setup.colField ?? CARDS_START.colField, source: setup.source ?? CARDS_START.source }

  // Each into the column of the same name there, else its first; after what's already in it, in the order they had.
  const moveTo = (to: WithId<Piece>) => {
    const cols = kanbanOf(to).cols
    const there = (name?: string) => cols.find((c) => c.name.trim().toLowerCase() === name?.trim().toLowerCase()) ?? cols[0]
    const last = new Map(cols.map((c) => [c.id, Math.max(0, ...tasksIn(allTasks.filter((t) => t.pieceId === to.id), c.id).map((t) => t.order))]))
    const from = setup.cols
    const moves: TaskMove[] = from.flatMap((c) => tasksIn(held, c.id)).concat(held.filter((t) => !from.some((c) => c.id === t.col))).map((t) => {
      const col = there(from.find((c) => c.id === t.col)?.name)
      const order = (last.get(col.id) ?? 0) + 1
      last.set(col.id, order)
      return { id: t.id, pieceId: to.id, col: col.id, order }
    })
    void moveTasksAway(wid, moves, piece.id, cardsHere ? null : toCards, `move ${tasksWord} to ${to.name || 'a deck'}${cardsHere ? '' : ', hold cards'}`)
    onDone()
  }
  // A new kanban holding cards, next to this one, named after it, its setup open on which cards; in this one's focus,
  // into the new one's.
  const makeNew = async () => {
    onDone()
    const { w, h } = PIECE_SIZE.kanban
    const id = await addPiece(wid, 'kanban', [piece.x + piece.w + GRID + w / 2, piece.y + h / 2], pieces, { ...emptyKanban(), ...toCards }, `${piece.name || 'deck'} · cards`)
    useKanbanUi.setState({ setup: id, tab: 'cards' })
    if (new URLSearchParams(location.search).get('focus') === piece.id) findGo({ kind: 'lens', space: id, k: 0, focus: id })
    else setEditing(id, true)
  }

  return (
    <div className={styles.held} role="group" aria-label={`Its ${tasksWord}`}>
      <span className={styles.heldWhat}>{cardsHere ? `${tasksWord} from before it held cards` : `it holds ${tasksWord}`}</span>
      <p className={styles.heldWhy}>
        {cardsHere ? 'They aren’t shown on it while it holds cards. Move them to a deck of tasks, or let it hold tasks again.' : 'To hold cards, its tasks need somewhere to go first. Nothing is hidden.'}
      </p>
      <span className={styles.heldActs}>
        {!cardsHere && (
          <button className={m.tool} data-main autoFocus onClick={() => void makeNew()} title="a new deck next to this one holds the cards; the tasks stay here">
            [make a new deck for cards]<span className={styles.heldHint}>next to this one; the tasks stay</span>
          </button>
        )}
        {others.length > 0 && (
          <button className={m.tool} aria-expanded={picking} onClick={() => setPicking(!picking)}>
            [move the tasks to {picking ? '▴' : '▾'}]<span className={styles.heldHint}>{cardsHere ? 'into the column of the same name' : 'then this one holds cards'}</span>
          </button>
        )}
        {picking && (
          <span className={styles.heldList} role="list">
            {others.map((p) => {
              const cols = kanbanOf(p)
              const count = allTasks.filter((t) => t.pieceId === p.id).length
              const same = setup.cols.every((c) => cols.cols.some((x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase()))
              return (
                <button key={p.id} role="listitem" className={styles.heldTo} onClick={() => moveTo(p)}>
                  {p.name || 'deck'}
                  <span className={styles.heldHint}>
                    {count} task{count === 1 ? '' : 's'} · {same ? 'same columns' : `others into ${cols.cols[0]?.name ?? 'its first'}`}
                  </span>
                </button>
              )
            })}
          </span>
        )}
        {cardsHere ? (
          <button className={m.tool} onClick={() => void setKanbanSetup(wid, piece.id, { holds: undefined }, 'hold tasks on a deck')}>
            [hold tasks again]
          </button>
        ) : (
          <button className={m.tool} onClick={onDone}>
            [keep tasks]
          </button>
        )}
      </span>
    </div>
  )
}

// Boxes (D-269): a small grid of the kanban's columns × rows, each box a name field (≤ 40) and its tone (plain, `wash`
// green, `warn` magenta). An empty, plain box has no name.
const TONES: { tone: BoxName['tone']; label: string; hint: string }[] = [
  { tone: undefined, label: '·', hint: 'plain' },
  { tone: 'good', label: 'wash', hint: 'washed green: where you want cards to be' },
  { tone: 'bad', label: 'warn', hint: 'its name in magenta: where you don’t' },
]
function BoxesEditor({ setup, onChange }: { setup: KanbanSetup; onChange: SetKanban }) {
  const { cards } = useWs()
  const field = setup.colField ?? 'status'
  const row = rowFieldOf(setup)
  if (!row)
    return (
      <Row label="boxes">
        <span className={m.checkHint}>boxes come with rows: pick a field to take rows from under columns</span>
      </Row>
    )
  const held = heldCards({ kanban: setup }, cards)
  const cols = columnsOf(field, held)
  const rows = rowsOfField(row, held)
  const names = setup.names ?? []
  const at = (col: string, r: string) => names.find((n) => n.col === col && n.row === r)
  const put = (col: string, r: string, change: Partial<BoxName>, what: string, key?: string) => {
    const was = at(col, r)
    const next: BoxName = { col, row: r, name: '', ...was, ...change }
    if (!next.tone) delete next.tone
    const rest = names.filter((n) => n !== was)
    const kept = next.name.trim() || next.tone ? [...rest, { ...next, name: next.name.slice(0, BOX_NAME_MAX) }] : rest
    onChange({ names: kept.length ? kept.slice(0, BOX_NAMES_MAX) : undefined }, what, key)
  }
  return (
    <table className={styles.boxes} aria-label="Box names">
      <thead>
        <tr>
          <th />
          {cols.map((c) => (
            <th key={c.id}>{c.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <th>{r.id === NO_VALUE ? `no ${FIELD_NAME[row]}` : r.name}</th>
            {cols.map((c) => {
              const n = at(c.id, r.id)
              const i = TONES.findIndex((t) => t.tone === n?.tone)
              const tone = TONES[(i + 1) % TONES.length]
              return (
                <td key={c.id} data-tone={n?.tone}>
                  <AutosaveField className={styles.boxField} label={`Name of ${c.name} × ${r.name}`} placeholder="name" maxLength={BOX_NAME_MAX} value={n?.name ?? ''} onSave={(v) => put(c.id, r.id, { name: v }, 'name a box', `box:${c.id}|${r.id}`)} />
                  <button className={styles.boxTone} data-tone={n?.tone} title={`${TONES[i < 0 ? 0 : i].hint}; click: ${tone.hint}`} onClick={() => put(c.id, r.id, { tone: tone.tone }, tone.tone ? `${tone.label} a box` : 'a plain box')}>
                    {TONES[i < 0 ? 0 : i].label}
                  </button>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const HINT: Record<CardField, string> = {
  status: 'idea · planned · building · shipped for features; hypothesis → invalidated for customers, problems, ideas',
  impact: 'low · medium · high; features and packages',
  effort: 'S · M · L; features and packages',
  priority: 'P1 · P2 · P3; features',
}
