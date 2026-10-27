// A kanban's setup (D-268), in the matrix's and table's way (D-212, D-218): a tabbed panel over the bottom middle of its
// space, above the dock: holds · cards · columns. Holds: tasks (its own columns, D-251) or cards. Cards: which, by the
// table's rules (D-209: plane, type, status, tag, title; cards added by hand). Columns: the field they come from (status,
// impact, effort, priority), `no value` always first. Every change is one undo step. The same editors make a new kanban
// in the wizard (KanbanWizard.tsx), on a draft.
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { CARD_FIELDS, setKanbanSetup, type CardField, type KanbanSetup } from '../../data/tasks'
import type { Source } from '../../data/source'
import type { TableSetup } from '../../data/table'
import { Choices, Row } from './MatrixSetup'
import { RowsEditor } from './TableSetup'
import { kanbanOf, KANBAN_TABS, useKanbanUi, type KanbanTab } from './Kanban'
import { columnsOf, FIELD_NAME, heldCards, KANBAN_TEMPLATES } from './kanbanCards'
import { useWs } from './context'
import m from './Matrix.module.css'

const TAB_NAME: Record<KanbanTab, string> = { holds: 'holds', cards: 'cards', cols: 'columns' }

// One part changed: on the piece, or on the wizard's draft.
export type KanbanPatch = Partial<Pick<KanbanSetup, 'holds' | 'source' | 'colField'>>
export type SetKanban = (patch: KanbanPatch, what: string, key?: string) => void

// What a kanban holding cards starts with when switched to it: features by status (the template's).
export const CARDS_START = KANBAN_TEMPLATES[1].setup() as Required<KanbanPatch>

export function KanbanSetupPanel({ piece }: { piece: WithId<Piece> }) {
  const { wid, cards } = useWs()
  const setup = kanbanOf(piece)
  const tab = useKanbanUi((s) => s.tab)
  const close = () => useKanbanUi.setState({ setup: null })
  const set: SetKanban = (patch, what, key) => void setKanbanSetup(wid, piece.id, patch, what, key)
  const cardsHere = setup.holds === 'cards'
  const count = { holds: undefined, cards: cardsHere ? heldCards(piece, cards).length : undefined, cols: cardsHere ? columnsOf(setup.colField ?? 'status', heldCards(piece, cards)).length : setup.cols.length }
  return (
    <section className={m.setup} aria-label="Set up the kanban" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())}>
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
      <Row label="it holds" hint="a kanban holds tasks or cards, never both">
        <Choices<'tasks' | 'cards'>
          value={cardsHere ? 'cards' : 'tasks'}
          options={[
            { value: 'tasks', label: 'tasks', hint: 'the team’s work, in its own columns; given to, due, a checklist' },
            { value: 'cards', label: 'cards', hint: 'cards from the planes, in columns from one of their fields; dragging one sets it' },
          ]}
          onChange={(v) =>
            v === 'cards'
              ? onChange({ holds: 'cards', colField: setup.colField ?? CARDS_START.colField, source: setup.source ?? CARDS_START.source }, 'hold cards on a kanban')
              : onChange({ holds: undefined }, 'hold tasks on a kanban')
          }
        />
      </Row>
    )
  if (!cardsHere)
    return (
      <Row label={tab === 'cards' ? 'cards' : 'columns'}>
        <span className={m.checkHint}>{tab === 'cards' ? 'it holds tasks: a task points at a card from its panel' : 'its own: renamed by a double-click on a head, added with + column'}</span>
      </Row>
    )
  if (tab === 'cards') {
    const source: Source = setup.source ?? { rules: [], items: [] }
    // The table's editor, on a table-shaped draft of the source alone.
    const asTable = { rows: source, cols: [] } as TableSetup
    return <RowsEditor setup={asTable} cardsOnly onChange={(part, v, key) => part === 'rows' && onChange({ source: v as Source }, 'change which cards a kanban holds', key)} />
  }
  const field = setup.colField ?? 'status'
  return (
    <Row label="columns from" hint="no value comes first: its cards haven't got one yet; drag them out to set it">
      <Choices<CardField>
        value={field}
        options={CARD_FIELDS.map((f) => ({ value: f, label: FIELD_NAME[f], hint: HINT[f] }))}
        onChange={(f) => onChange({ colField: f }, `a kanban’s columns by ${FIELD_NAME[f]}`)}
      />
    </Row>
  )
}

const HINT: Record<CardField, string> = {
  status: 'idea · planned · building · shipped for features; hypothesis → invalidated for customers, problems, ideas',
  impact: 'low · medium · high; features and packages',
  effort: 'S · M · L; features and packages',
  priority: 'P1 · P2 · P3; features',
}
