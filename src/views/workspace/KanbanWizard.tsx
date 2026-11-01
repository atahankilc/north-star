// A new kanban (D-268), made as a table is (D-218): `+ → kanban…` opens a short wizard in the middle of the screen. Three
// steps, any of them at any time: start from (tasks, features by status, or my own), what it holds (tasks or cards, and
// which cards), its columns (a field's values, for cards) and rows (another field, D-269). A small preview beside it shows the columns as they'll come and
// how many cards each gets. `make the kanban` puts it at the middle of the canvas, in edit mode. Escape or a click outside
// leaves it; Enter goes to the next step, ⌘Enter makes it (D-250). Nothing is written until it's made.
import { useState } from 'react'
import { addPiece } from '../../data/pieces'
import { emptyKanban, type KanbanSetup } from '../../data/tasks'
import { canvasCenter, setEditing } from '../../state/canvasView'
import { useWs } from './context'
import { WizardShell } from '../../ui/WizardShell'
import { useKanbanUi, type KanbanTab } from './Kanban'
import { KanbanEditor, type SetKanban } from './KanbanSetup'
import { boxKey, byBox, byColumn, columnsOf, heldCards, KANBAN_TEMPLATES, NO_VALUE, rowFieldOf, rowsOfField, type CardCol } from './kanbanCards'
import m from './Matrix.module.css'
import { Options } from '../../ui/Options'

// The `my own` option of the start (its own setup, the next steps).
const OWN = '__own'

const STEPS = ['start from', 'holds', 'columns · rows'] as const
const QUESTION = ['Start from', 'What does it hold?', 'Its columns and rows']

export function KanbanWizard() {
  const open = useKanbanUi((s) => s.wizard)
  return open ? <Wizard /> : null
}

const close = () => useKanbanUi.setState({ wizard: false })

function Wizard() {
  const { wid, pieces, cards } = useWs()
  const [step, setStep] = useState(0)
  const [template, setTemplate] = useState<string | null>(KANBAN_TEMPLATES[0].key)
  const [draft, setDraft] = useState<KanbanSetup>(() => emptyKanban())
  const change: SetKanban = (patch) => {
    setDraft((d) => {
      const next = { ...d, ...patch }
      for (const k of Object.keys(patch) as (keyof KanbanSetup)[]) if (patch[k as keyof typeof patch] === undefined) delete next[k]
      return next
    })
    setTemplate(null)
  }
  const cardsHere = draft.holds === 'cards'
  const field = draft.colField ?? 'status'
  const held = cardsHere ? heldCards({ kanban: draft }, cards) : []
  const cols = cardsHere ? columnsOf(field, held) : draft.cols
  const counts = cardsHere ? byColumn(field, columnsOf(field, held), held) : null
  // Rows (D-269): the preview becomes the grid, a count in each box.
  const rowField = cardsHere ? rowFieldOf(draft) : undefined
  const rows = rowField ? rowsOfField(rowField, held) : []
  const boxes = rowField ? byBox(field, cols as CardCol[], rowField, rows, held) : null

  const make = async () => {
    close()
    const t = KANBAN_TEMPLATES.find((x) => x.key === template)
    const name = t && t.key !== 'tasks' ? t.name : cardsHere ? `cards by ${field}` : undefined
    const id = await addPiece(wid, 'kanban', canvasCenter(wid), pieces, draft, name)
    // Where you're looking, in edit mode, to be moved where you want it.
    setEditing(id, true)
  }
  const tab: KanbanTab = step === 1 ? 'holds' : 'cols'

  return (
    <WizardShell
      label="A new deck"
      steps={STEPS}
      step={step}
      onStep={setStep}
      title={QUESTION[step]}
      make="make the deck"
      onMake={() => void make()}
      onClose={close}
      preview={
        <>
          <table className={m.mini}>
            <thead>
              <tr>
                {cols.slice(0, 5).map((c) => (
                  <th key={c.id} title={c.name}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {boxes ? (
                rows.slice(0, 5).map((r) => (
                  <tr key={r.id}>
                    {cols.slice(0, 5).map((c) => (
                      <td key={c.id} title={`${c.name} × ${r.name}`}>
                        {boxes.get(boxKey(c.id, r.id))?.length ?? 0}
                      </td>
                    ))}
                    <th title={r.name}>{r.id === NO_VALUE ? '–' : r.name}</th>
                  </tr>
                ))
              ) : (
                <tr>
                  {cols.slice(0, 5).map((c) => (
                    <td key={c.id}>{counts ? (counts.get(c.id)?.length ?? 0) : '·'}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
          <p className={m.checkHint}>
            {cardsHere ? `${held.length} cards in ${cols.length} columns${rowField ? ` × ${rows.length} rows` : ''}` : `tasks in ${cols.length} columns`}
            {cols.length > 5 || rows.length > 5 ? ' · the first few shown' : ''}
          </p>
        </>
      }
    >
      {step === 0 && (
        <Options
          pick="one"
          cards
          label="Start from"
          value={template ?? OWN}
          options={[...KANBAN_TEMPLATES.map((t) => ({ value: t.key, label: t.name, line: t.hint })), { value: OWN, label: 'my own', line: 'answer the next two' }]}
          onChange={(key) => {
            const t = KANBAN_TEMPLATES.find((x) => x.key === key)
            if (!t) return setStep(1)
            setDraft({ ...emptyKanban(), ...t.setup() })
            setTemplate(t.key)
          }}
        />
      )}
      {step === 1 && (
        <>
          <KanbanEditor tab="holds" setup={draft} onChange={change} />
          {cardsHere && <KanbanEditor tab="cards" setup={draft} onChange={change} />}
        </>
      )}
      {step === 2 && <KanbanEditor tab={tab} setup={draft} onChange={change} />}
    </WizardShell>
  )
}
