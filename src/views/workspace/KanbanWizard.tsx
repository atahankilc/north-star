// A new kanban (D-268), made as a table is (D-218): `+ → kanban…` opens a short wizard in the middle of the screen. Three
// steps, any of them at any time: start from (tasks, features by status, or my own), what it holds (tasks or cards, and
// which cards), its columns (a field's values, for cards) and rows (another field, D-269). A small preview beside it shows the columns as they'll come and
// how many cards each gets. `make the kanban` puts it at the middle of the canvas, in edit mode. Escape or a click outside
// leaves it; Enter goes to the next step, ⌘Enter makes it (D-250). Nothing is written until it's made.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { addPiece } from '../../data/pieces'
import { emptyKanban, type KanbanSetup } from '../../data/tasks'
import { canvasCenter, setEditing } from '../../state/canvasView'
import { useWs } from './context'
import { wizardEnter } from './wizardKeys'
import { useKanbanUi, type KanbanTab } from './Kanban'
import { KanbanEditor, type SetKanban } from './KanbanSetup'
import { boxKey, byBox, byColumn, columnsOf, heldCards, KANBAN_TEMPLATES, NO_VALUE, rowFieldOf, rowsOfField, type CardCol } from './kanbanCards'
import m from './Matrix.module.css'

const STEPS = ['start from', 'holds', 'columns · rows'] as const
const QUESTION = ['Start from', 'What does it hold?', 'Its columns and rows']

export function KanbanWizard() {
  const open = useKanbanUi((s) => s.wizard)
  return open ? createPortal(<Wizard />, document.body) : null
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
    const t = KANBAN_TEMPLATES.find((x) => x.key === template)
    const name = t && t.key !== 'tasks' ? t.name : cardsHere ? `cards by ${field}` : undefined
    const id = await addPiece(wid, 'kanban', canvasCenter(wid), pieces, draft, name)
    // Where you're looking, in edit mode, to be moved where you want it.
    setEditing(id, true)
  }
  enter.current = (e) => wizardEnter(e, step, STEPS.length, setStep, () => void make())
  const tab: KanbanTab = step === 1 ? 'holds' : 'cols'

  return (
    <div className={m.wizardShade} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className={m.wizard} role="dialog" aria-modal="true" aria-label="A new deck" onKeyDown={(e) => e.stopPropagation()}>
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
                {KANBAN_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    className={m.template}
                    aria-pressed={template === t.key}
                    onClick={() => {
                      setDraft({ ...emptyKanban(), ...t.setup() })
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
            {step === 1 && (
              <>
                <KanbanEditor tab="holds" setup={draft} onChange={change} />
                {cardsHere && <KanbanEditor tab="cards" setup={draft} onChange={change} />}
              </>
            )}
            {step === 2 && <KanbanEditor tab={tab} setup={draft} onChange={change} />}
          </div>
          <aside className={m.wizardPreview} aria-label="Preview">
            <span className={m.setupLabel}>preview</span>
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
              make the deck
            </button>
          </span>
        </footer>
      </section>
    </div>
  )
}
