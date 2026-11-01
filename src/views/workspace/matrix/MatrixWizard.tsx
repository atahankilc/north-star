// A new matrix (D-212): `+ → matrix` opens a short wizard in the middle of the screen instead of dropping a template.
// Four steps, any of them at any time: start from (a template, or my own), what goes down the side, what goes across the
// top, what a cell holds. A small preview beside it shows the first rows and columns as they'll come, and how many.
// `make the matrix` puts it at the middle of the canvas, named after what it crosses, selected. Escape or a click
// outside leaves it; Enter goes to the next step, ⌘Enter makes it (D-250). It works on a draft: nothing is written
// until it's made.
import { useState } from 'react'
import { entriesOf, nounOf, TEMPLATES, TONE_VAR, type MatrixSetup } from '../../../data/matrix'
import { addPiece } from '../../../data/pieces'
import { canvasCenter, setEditing } from '../../../state/canvasView'
import { useWs } from '../canvas/context'
import { WizardShell } from '../../../ui/patterns/WizardShell'
import { StepSquare, useMatrixUi } from './Matrix'
import { AxisEditor, CellsEditor, type SetPart } from './MatrixSetup'
import styles from './Matrix.module.css'
import { Options } from '../../../ui/patterns/Options'

// The `my own` option of the start (its own setup, the next steps).
const OWN = '__own'

const STEPS = ['start from', 'rows', 'columns', 'cells'] as const
const QUESTION = ['Start from', 'What goes down the side?', 'What goes across the top?', 'What goes in a cell?']

export function MatrixWizard() {
  const open = useMatrixUi((s) => s.wizard)
  return open ? <Wizard /> : null
}

const close = () => useMatrixUi.setState({ wizard: false })

function Wizard() {
  const { wid, pieces, cards } = useWs()
  const [step, setStep] = useState(0)
  const [template, setTemplate] = useState<string | null>(TEMPLATES[0].key)
  const [draft, setDraft] = useState<MatrixSetup>(() => TEMPLATES[0].setup())
  const change: SetPart = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  const edit = (d: MatrixSetup) => {
    setDraft(d)
    setTemplate(null)
  }
  const rows = entriesOf(draft.rows, cards)
  const cols = entriesOf(draft.cols, cards)

  const make = async () => {
    close()
    const id = await addPiece(wid, 'matrix', canvasCenter(wid), pieces, draft, `${nounOf(draft.rows)} × ${nounOf(draft.cols)}`)
    // Where you're looking, in edit mode, to be moved where you want it.
    setEditing(id, true)
  }

  // The preview's cells: the scale's steps in turn, a number, or a word.
  const sample = (i: number, j: number) => {
    if (draft.cell === 'number') return <span>{[42, 18, 7, 25][(i + j) % 4]}</span>
    if (draft.cell === 'text') return <span>{['yes, paid', 'no', 'beta'][(i + j) % 3]}</span>
    const s = draft.steps[(i * 2 + j) % draft.steps.length]
    return s ? draft.marks ? <span style={{ color: TONE_VAR[s.tone] }}>{s.glyph}</span> : <StepSquare steps={draft.steps} step={s} /> : null
  }

  return (
    <WizardShell
      label="A new matrix"
      steps={STEPS}
      step={step}
      onStep={setStep}
      title={QUESTION[step]}
      make="make the matrix"
      onMake={() => void make()}
      onClose={close}
      preview={
        <>
          <table className={styles.mini}>
            <thead>
              <tr>
                <th />
                {cols.slice(0, 4).map((c) => (
                  <th key={c.key} title={c.name}>
                    {c.name || 'untitled'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((r, i) => (
                <tr key={r.key}>
                  <th title={r.name}>{r.name || 'untitled'}</th>
                  {cols.slice(0, 4).map((c, j) => (
                    <td key={c.key}>{sample(i, j)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.checkHint}>
            {rows.length} {nounOf(draft.rows)} × {cols.length} {nounOf(draft.cols)}
            {rows.length > 5 || cols.length > 4 ? ' · the first few shown' : ''}
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
          options={[...TEMPLATES.map((t) => ({ value: t.key, label: t.name, line: t.hint })), { value: OWN, label: 'my own', line: 'answer the next three' }]}
          onChange={(key) => {
            const t = TEMPLATES.find((x) => x.key === key)
            if (!t) return setStep(1)
            setDraft(t.setup())
            setTemplate(t.key)
          }}
        />
      )}
      {step === 1 && <AxisEditor which="rows" axis={draft.rows} onChange={(a) => edit({ ...draft, rows: a })} />}
      {step === 2 && <AxisEditor which="cols" axis={draft.cols} onChange={(a) => edit({ ...draft, cols: a })} />}
      {step === 3 && (
        <CellsEditor
          setup={draft}
          onChange={(k, v, key) => {
            change(k, v, key)
            setTemplate(null)
          }}
        />
      )}
    </WizardShell>
  )
}
