// A new table (D-218), made as a matrix is (D-212): `+ → table…` opens a short wizard in the middle of the screen. Three
// steps, any of them at any time: start from (a template, or my own), which rows, which columns. A small preview beside
// it shows the first rows and columns as they'll come, and how many. `make the table` puts it at the middle of the
// canvas, selected. Escape or a click outside leaves it; Enter goes to the next step, ⌘Enter makes it (D-250). It
// works on a draft: nothing is written until it's made.
import { useState } from 'react'
import { rowsOf } from '../../data/source'
import { colName, TEMPLATES, type TableSetup } from '../../data/table'
import { addPiece } from '../../data/pieces'
import { canvasCenter, setEditing } from '../../state/canvasView'
import { useWs } from './context'
import { WizardShell } from '../../ui/WizardShell'
import { useFieldText, useTableUi } from './Table'
import { ColumnsEditor, RowsEditor, type SetTable } from './TableSetup'
import m from './Matrix.module.css'
import { Options } from '../../ui/Options'

// The `my own` option of the start (its own setup, the next steps).
const OWN = '__own'

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
  const [step, setStep] = useState(0)
  const [template, setTemplate] = useState<string | null>(TEMPLATES[0].key)
  const [draft, setDraft] = useState<TableSetup>(() => TEMPLATES[0].setup())
  const change: SetTable = (k, v) => {
    setDraft((d) => {
      const next = { ...d }
      if (v === undefined) delete next[k]
      else next[k] = v
      return next
    })
    setTemplate(null)
  }
  const rows = rowsOf(draft.rows, cards, !draft.manual)
  const cols = draft.cols.slice(0, 3)

  const make = async () => {
    close()
    const name = TEMPLATES.find((t) => t.key === template)?.name ?? 'table'
    const id = await addPiece(wid, 'table', canvasCenter(wid), pieces, draft, name)
    // Where you're looking, in edit mode, to be moved where you want it.
    setEditing(id, true)
  }

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
            {rows.length > 5 || draft.cols.length > 3 ? ' · the first few shown' : ''}
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
          options={[...TEMPLATES.map((t) => ({ value: t.key, label: t.name, line: t.hint })), { value: OWN, label: 'my own', line: 'answer the next two' }]}
          onChange={(key) => {
            const t = TEMPLATES.find((x) => x.key === key)
            if (!t) return setStep(1)
            setDraft(t.setup())
            setTemplate(t.key)
          }}
        />
      )}
      {step === 1 && <RowsEditor setup={draft} onChange={change} />}
      {step === 2 && <ColumnsEditor setup={draft} onChange={change} />}
    </WizardShell>
  )
}
