// A new table (D-218), made as a matrix is (D-212): `+ → table…` opens a short wizard in the middle of the screen. Three
// steps, any of them at any time: start from (a template, or my own), which rows, which columns. A small preview beside
// it shows the first rows and columns as they'll come, and how many. `make the table` puts it at the middle of the
// canvas, selected. Escape or a click outside leaves it; Enter goes to the next step, ⌘Enter makes it (D-250). It
// works on a draft: nothing is written until it's made.
import { rowsOf } from '../../../data/source'
import { colName, TEMPLATES, type TableSetup } from '../../../data/table'
import { useWs } from '../canvas/context'
import { WizardShell } from '../../../ui/patterns/WizardShell'
import { useFieldText, useTableUi } from './Table'
import { ColumnsEditor, RowsEditor, type SetTable } from './TableSetup'
import m from '../matrix/Matrix.module.css'
import { firstFew, makeFromWizard, useDraftWizard } from '../canvas/useDraftWizard'
import { StartFrom } from '../canvas/StartFrom'

const STEPS = ['start from', 'rows', 'columns'] as const
const QUESTION = ['Start from', 'Which rows?', 'Which columns?']

export function TableWizard() {
  const open = useTableUi((s) => s.wizard)
  return open ? <Wizard /> : null
}

const close = () => useTableUi.setState({ wizard: false })

function Wizard() {
  const { wid, pieces, cards } = useWs()
  const fieldText = useFieldText()
  const { step, setStep, template, draft, patch, start, templateName } = useDraftWizard<TableSetup>(TEMPLATES, (s) => s)
  const change: SetTable = (k, v) => patch({ [k]: v } as Partial<TableSetup>)
  const rows = rowsOf(draft.rows, cards, !draft.manual)
  const cols = draft.cols.slice(0, 3)

  const make = () => makeFromWizard(close, wid, 'table', pieces, draft, templateName ?? 'table')

  return (
    <WizardShell
      label="A new table"
      steps={STEPS}
      step={step}
      onStep={setStep}
      title={QUESTION[step]}
      make="make the table"
      onMake={() => void make()}
      onClose={close}
      preview={
        <>
          <table className={m.mini}>
            <thead>
              <tr>
                <th>{draft.manual ? 'name' : 'title'}</th>
                {cols.map((c) => (
                  <th key={c.id} title={colName(c)}>
                    {colName(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((r) => (
                <tr key={r.key}>
                  <th title={r.name}>{r.name || 'untitled'}</th>
                  {cols.map((c) => (
                    <td key={c.id}>{c.field ? fieldText(r, c.field) || '·' : '·'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className={m.checkHint}>
            {rows.length} rows × {draft.cols.length + 1} columns
            {firstFew(rows.length > 5 || draft.cols.length > 3)}
          </p>
        </>
      }
    >
      {step === 0 && <StartFrom templates={TEMPLATES} value={template} onPick={start} own="answer the next two" />}
      {step === 1 && <RowsEditor setup={draft} onChange={change} />}
      {step === 2 && <ColumnsEditor setup={draft} onChange={change} />}
    </WizardShell>
  )
}
