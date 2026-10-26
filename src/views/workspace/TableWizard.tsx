// A new table (D-218), made as a matrix is (D-212): `+ → table…` opens a short wizard in the middle of the screen. Three
// steps, any of them at any time: start from (a template, or my own), which rows, which columns. A small preview beside
// it shows the first rows and columns as they'll come, and how many. `make the table` puts it at the middle of the
// canvas, selected. Escape or a click outside leaves it; Enter goes to the next step, ⌘Enter makes it (D-250). It
// works on a draft: nothing is written until it's made.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { rowsOf } from '../../data/source'
import { colName, TEMPLATES, type TableSetup } from '../../data/table'
import { addPiece } from '../../data/pieces'
import { canvasCenter, setEditing } from '../../state/canvasView'
import { useWs } from './context'
import { wizardEnter } from './wizardKeys'
import { useFieldText, useTableUi } from './Table'
import { ColumnsEditor, RowsEditor, type SetTable } from './TableSetup'
import m from './Matrix.module.css'

const STEPS = ['start from', 'rows', 'columns'] as const
const QUESTION = ['Start from', 'Which rows?', 'Which columns?']

export function TableWizard() {
  const open = useTableUi((s) => s.wizard)
  return open ? createPortal(<Wizard />, document.body) : null
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

  // Heard first, wherever the focus is: Escape leaves, Enter steps on (D-250).
  const enter = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') return enter.current(e)
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const make = async () => {
    close()
    const name = TEMPLATES.find((t) => t.key === template)?.name ?? 'table'
    const id = await addPiece(wid, 'table', canvasCenter(wid), pieces, draft, name)
    // Where you're looking, in edit mode, to be moved where you want it.
    setEditing(id, true)
  }
  enter.current = (e) => wizardEnter(e, step, STEPS.length, setStep, () => void make())

  return (
    <div className={m.wizardShade} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className={m.wizard} role="dialog" aria-modal="true" aria-label="A new table" onKeyDown={(e) => e.stopPropagation()}>
        <nav className={m.wizardSteps} role="tablist">
          {STEPS.map((s, i) => (
            <button key={s} role="tab" aria-selected={step === i} className={m.wizardStep} onClick={() => setStep(i)}>
              <span className={m.wizardNum}>{i + 1}</span>
              {s}
            </button>
          ))}
        </nav>
        <div className={m.wizardMain}>
          <div className={m.wizardQ}>
            <h3 className={m.wizardTitle}>{QUESTION[step]}</h3>
            {step === 0 && (
              <div className={m.templates}>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    className={m.template}
                    aria-pressed={template === t.key}
                    onClick={() => {
                      setDraft(t.setup())
                      setTemplate(t.key)
                    }}
                  >
                    {t.name}
                    <small>{t.hint}</small>
                  </button>
                ))}
                <button className={m.template} aria-pressed={template === null} onClick={() => setStep(1)}>
                  my own
                  <small>answer the next two</small>
                </button>
              </div>
            )}
            {step === 1 && <RowsEditor setup={draft} onChange={change} />}
            {step === 2 && <ColumnsEditor setup={draft} onChange={change} />}
          </div>
          <aside className={m.wizardPreview} aria-label="Preview">
            <span className={m.setupLabel}>preview</span>
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
          </aside>
        </div>
        <footer className={m.wizardFoot}>
          <span>{step > 0 && <button className={m.tool} onClick={() => setStep(step - 1)}>back</button>}</span>
          <span className={m.setupEnd}>
            <button className={m.tool} onClick={close}>
              cancel
            </button>
            {step < STEPS.length - 1 && (
              <button className={m.tool} onClick={() => setStep(step + 1)}>
                next
              </button>
            )}
            <button className={m.tool} data-main onClick={() => void make()}>
              make the table
            </button>
          </span>
        </footer>
      </section>
    </div>
  )
}
