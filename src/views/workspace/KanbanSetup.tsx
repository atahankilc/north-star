// A kanban's setup (D-268), in the matrix's and table's way (D-212, D-218): a tabbed panel over the bottom middle of its
// space, above the dock: holds · cards · columns. Holds: tasks (its own columns, D-251) or cards. Cards: which, by the
// table's rules (D-209: plane, type, status, tag, title; cards added by hand). Columns: the field they come from (status,
// impact, effort, priority), `no value` always first; rows from another, or none (D-269). Boxes (D-269): with rows, a
// name for any box (column × row), plain, washed green or named in magenta. Every change is one undo step. The same editors make a new kanban
// in the wizard (KanbanWizard.tsx), on a draft.
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { BOX_NAME_MAX, BOX_NAMES_MAX, CARD_FIELDS, setKanbanSetup, type BoxName, type CardField, type KanbanSetup } from '../../data/tasks'
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
  const { wid, cards } = useWs()
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
    <section className={m.setup} aria-label="Set up the deck" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())}>
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
        <KanbanEditor tab={tab} setup={setup} onChange={set} />
      </div>
    </section>
  )
}

// One tab's editor, on the piece or a draft.
export function KanbanEditor({ tab, setup, onChange }: { tab: KanbanTab; setup: KanbanSetup; onChange: SetKanban }) {
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
            v === 'cards'
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
