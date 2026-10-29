// A new matrix (D-212): `+ → matrix` opens a short wizard in the middle of the screen instead of dropping a template.
// Four steps, any of them at any time: start from (a template, or my own), what goes down the side, what goes across the
// top, what a cell holds. A small preview beside it shows the first rows and columns as they'll come, and how many.
// `make the matrix` puts it at the middle of the canvas, named after what it crosses, selected. Escape or a click
// outside leaves it; Enter goes to the next step, ⌘Enter makes it (D-250). It works on a draft: nothing is written
// until it's made.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { entriesOf, nounOf, TEMPLATES, TONE_VAR, type MatrixSetup } from '../../data/matrix'
import { addPiece } from '../../data/pieces'
import { canvasCenter, setEditing } from '../../state/canvasView'
import { useWs } from './context'
import { wizardEnter } from './wizardKeys'
import { StepSquare, useMatrixUi } from './Matrix'
import { AxisEditor, CellsEditor, type SetPart } from './MatrixSetup'
import styles from './Matrix.module.css'

const STEPS = ['start from', 'rows', 'columns', 'cells'] as const
const QUESTION = ['Start from', 'What goes down the side?', 'What goes across the top?', 'What goes in a cell?']

export function MatrixWizard() {
  const open = useMatrixUi((s) => s.wizard)
  return open ? createPortal(<Wizard />, document.body) : null
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

  // Heard first, wherever the focus is: Escape leaves, Enter steps on (D-250).
  const enter = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-coach]')) return
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
    const id = await addPiece(wid, 'matrix', canvasCenter(wid), pieces, draft, `${nounOf(draft.rows)} × ${nounOf(draft.cols)}`)
    // Where you're looking, in edit mode, to be moved where you want it.
    setEditing(id, true)
  }
  enter.current = (e) => wizardEnter(e, step, STEPS.length, setStep, () => void make())

  // The preview's cells: the scale's steps in turn, a number, or a word.
  const sample = (i: number, j: number) => {
    if (draft.cell === 'number') return <span>{[42, 18, 7, 25][(i + j) % 4]}</span>
    if (draft.cell === 'text') return <span>{['yes, paid', 'no', 'beta'][(i + j) % 3]}</span>
    const s = draft.steps[(i * 2 + j) % draft.steps.length]
    return s ? draft.marks ? <span style={{ color: TONE_VAR[s.tone] }}>{s.glyph}</span> : <StepSquare steps={draft.steps} step={s} /> : null
  }

  return (
    <div className={styles.wizardShade} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className={styles.wizard} data-learn="wizard" role="dialog" aria-modal="true" aria-label="A new matrix" onKeyDown={(e) => e.stopPropagation()}>
        <nav className={styles.wizardSteps} role="tablist">
          {STEPS.map((s, i) => (
            <button key={s} role="tab" aria-selected={step === i} className={styles.wizardStep} onClick={() => setStep(i)}>
              <span className={styles.wizardNum}>{i + 1}</span>
              {s}
            </button>
          ))}
        </nav>
        <div className={styles.wizardMain}>
          <div className={styles.wizardQ}>
            <h3 className={styles.wizardTitle}>{QUESTION[step]}</h3>
            {step === 0 && (
              <div className={styles.templates}>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    className={styles.template}
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
                <button className={styles.template} aria-pressed={template === null} onClick={() => setStep(1)}>
                  my own
                  <small>answer the next three</small>
                </button>
              </div>
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
          </div>
          <aside className={styles.wizardPreview} aria-label="Preview">
            <span className={styles.setupLabel}>preview</span>
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
          </aside>
        </div>
        <footer className={styles.wizardFoot}>
          <span>{step > 0 && <button className={styles.tool} onClick={() => setStep(step - 1)}>back</button>}</span>
          <span className={styles.setupEnd}>
            <button className={styles.tool} onClick={close}>
              cancel
            </button>
            {step < STEPS.length - 1 && (
              <button className={styles.tool} onClick={() => setStep(step + 1)}>
                next
              </button>
            )}
            <button className={styles.tool} data-main onClick={() => void make()}>
              make the matrix
            </button>
          </span>
        </footer>
      </section>
    </div>
  )
}
