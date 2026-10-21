// A matrix's setup (D-204), from the focus dock's `[setup]`: a framed panel over the bottom middle of the screen, above
// the dock (the right of the screen stays free). Start from a template; each axis takes every card of a type (on any plane
// or one), named rows added by hand and single cards; the cells are a scale (its steps edited here: glyph, name, colour),
// a number (with a unit) or a text; `not relevant`, how sure and the reading are switched on and off. Every change is one
// undo step; typing in a field merges into one.
import type { ReactNode } from 'react'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { CARD_TYPES, type CardType } from '../../data/cards'
import { kindOfPiece } from '../../data/pieces'
import {
  addNamed,
  CELL_KINDS,
  GLYPH_MAX,
  LABEL_MAX,
  MAX_STEPS,
  newId,
  SCALES,
  setPart,
  setSetup,
  TEMPLATES,
  TONE_VAR,
  TONES,
  type Axis,
  type MatrixSetup,
  type Step,
} from '../../data/matrix'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { Select } from '../../ui/Select'
import { AutosaveField } from '../../ui/AutosaveField'
import { useWs } from './context'
import { addCard, setupOf, useMatrixUi } from './Matrix'
import { TYPE_ACCENT } from './PlaneCards'
import styles from './Matrix.module.css'

const NONE = 'none'
const ANY = 'any'

export function MatrixSetupPanel({ piece }: { piece: WithId<Piece> }) {
  const { wid } = useWs()
  const setup = setupOf(piece)
  const part = <K extends keyof MatrixSetup>(k: K, v: MatrixSetup[K] | undefined, key?: string) => void setPart(wid, piece.id, k, v, key)
  const close = () => useMatrixUi.setState({ setup: false })
  return (
    <section className={styles.setup} aria-label="Set up the matrix" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())}>
      <header className={styles.setupHead}>
        <span className={styles.setupTitle}>set up</span>
        <button className={styles.tool} title="close (Esc)" onClick={close}>
          done
        </button>
      </header>

      <Row label="start from">
        {TEMPLATES.map((t) => (
          <button key={t.key} className={styles.tool} title={`${t.hint}; replaces the rows, columns and cells' kind (⌘Z brings them back)`} onClick={() => void setSetup(wid, piece.id, t.setup(), piece.name ? undefined : t.name)}>
            {t.name}
          </button>
        ))}
      </Row>

      <AxisRow label="rows" which="rows" piece={piece} axis={setup.rows} />
      <AxisRow label="columns" which="cols" piece={piece} axis={setup.cols} />

      <Row label="cells">
        {CELL_KINDS.map((k) => (
          <button key={k} className={styles.tool} aria-pressed={setup.cell === k} onClick={() => part('cell', k)}>
            {k}
          </button>
        ))}
      </Row>
      {setup.cell === 'scale' && <StepsEditor steps={setup.steps} onChange={(steps, key) => part('steps', steps, key)} />}
      {setup.cell === 'number' && (
        <Row label="unit">
          <AutosaveField className={styles.field} label="unit" placeholder="€, h, %…" maxLength={20} value={setup.unit ?? ''} onSave={(u) => part('unit', u.trim() || undefined, 'unit')} />
        </Row>
      )}

      <Row label="also">
        <Toggle on={!!setup.notRelevant} label="— not relevant" title="a cell can say they aren't comparable at all: left out of the readings" onChange={(v) => part('notRelevant', v || undefined)} />
        <Toggle on={!!setup.confidence} label="how sure ~ ?" title="a cell can say how sure it is: documented, ~ inferred, ? a guess" onChange={(v) => part('confidence', v || undefined)} />
        <Toggle on={!!setup.reading} label="reading" title="each row and column summed up at its end" onChange={(v) => part('reading', v || undefined)} />
      </Row>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.setupRow}>
      <span className={styles.setupLabel}>{label}</span>
      <div className={styles.setupValue}>{children}</div>
    </div>
  )
}

function Toggle({ on, label, title, onChange }: { on: boolean; label: string; title: string; onChange: (v: boolean) => void }) {
  return (
    <button className={styles.check} aria-pressed={on} title={title} onClick={() => onChange(!on)}>
      <span className={styles.box}>{on ? '[x]' : '[ ]'}</span> {label}
    </button>
  )
}

// An axis: every card of a type (on one plane or any), then what's added by hand: a name, or one card.
function AxisRow({ label, which, piece, axis }: { label: string; which: 'rows' | 'cols'; piece: WithId<Piece>; axis: Axis }) {
  const { wid, cards, pieces } = useWs()
  const setup = setupOf(piece)
  const set = (a: Axis) => void setPart(wid, piece.id, which, a)
  const planes = pieces.filter((p) => kindOfPiece(p) === 'plane')
  const hidden = axis.hide?.length ?? 0
  const picks: MenuEntry[] = CARD_TYPES.flatMap((t) => {
    const of = cards.filter((c) => c.type === t)
    if (!of.length) return []
    return [
      { key: `h-${t}`, heading: `${t}s` },
      ...of.map((c) => ({ key: c.id, label: c.title || `untitled ${t}`, glyph: '▌', tone: TYPE_ACCENT[t], onSelect: () => addCard(wid, piece, which, c) })),
    ]
  })
  return (
    <Row label={label}>
      <span className={styles.inline}>
        every
        <Select<CardType | typeof NONE>
          ariaLabel={`${label}: every card of a type`}
          className={styles.select}
          value={axis.type ?? NONE}
          options={[{ value: NONE, label: 'nothing' }, ...CARD_TYPES.map((t) => ({ value: t, label: t }))]}
          onChange={(v) => set({ ...axis, type: v === NONE ? undefined : v, hide: undefined })}
        />
      </span>
      {axis.type && planes.length > 0 && (
        <span className={styles.inline}>
          on
          <Select
            ariaLabel={`${label}: on which plane`}
            className={styles.select}
            value={axis.plane ?? ANY}
            options={[{ value: ANY, label: 'any plane' }, ...planes.map((p) => ({ value: p.id, label: p.name || 'unnamed plane' }))]}
            onChange={(v) => set({ ...axis, plane: v === ANY ? undefined : v })}
          />
        </span>
      )}
      {hidden > 0 && (
        <button className={styles.tool} title="bring back the cards taken out" onClick={() => set({ ...axis, hide: undefined })}>
          {hidden} taken out
        </button>
      )}
      <button className={styles.tool} onClick={() => void addNamed(wid, piece.id, setup, which).then((id) => useMatrixUi.setState({ naming: id }))}>
        + name
      </button>
      {picks.length > 0 && <Menu label="+ card" up search="find a card" ariaLabel={`Add a card to the ${label}`} items={picks} />}
    </Row>
  )
}

// The scale's steps, low to high: a glyph, a name, a colour (click to change), taken out by `×`. Presets replace them.
function StepsEditor({ steps, onChange }: { steps: Step[]; onChange: (steps: Step[], key?: string) => void }) {
  const edit = (i: number, s: Partial<Step>, key?: string) => onChange(steps.map((x, j) => (j === i ? { ...x, ...s } : x)), key)
  return (
    <>
      <Row label="scale">
        {SCALES.map((sc) => (
          <button key={sc.key} className={styles.tool} title="replace the steps" onClick={() => onChange(sc.steps)}>
            {sc.name}
          </button>
        ))}
      </Row>
      <ol className={styles.steps}>
        {steps.map((s, i) => (
          <li key={s.id} className={styles.step}>
            <span className={styles.stepKey}>{i + 1}</span>
            <AutosaveField className={styles.glyphField} label={`step ${i + 1} glyph`} maxLength={GLYPH_MAX} value={s.glyph} onSave={(g) => g.trim() && edit(i, { glyph: g.trim() }, `glyph:${s.id}`)} />
            <AutosaveField className={styles.field} label={`step ${i + 1} name`} maxLength={LABEL_MAX} value={s.label} onSave={(l) => l.trim() && edit(i, { label: l.trim() }, `label:${s.id}`)} />
            <button
              className={styles.tone}
              style={{ ['--tone' as string]: TONE_VAR[s.tone] }}
              title={`colour: ${s.tone} (click for the next)`}
              aria-label={`Step ${i + 1} colour, ${s.tone}`}
              onClick={() => edit(i, { tone: TONES[(TONES.indexOf(s.tone) + 1) % TONES.length] })}
            >
              ■
            </button>
            {steps.length > 1 && (
              <button className={styles.remove} data-shown title="take the step out (cells set to it read as empty)" aria-label={`Take step ${i + 1} out`} onClick={() => onChange(steps.filter((x) => x !== s))}>
                ×
              </button>
            )}
          </li>
        ))}
      </ol>
      {steps.length < MAX_STEPS && (
        <div className={styles.setupRow}>
          <span className={styles.setupLabel} />
          <div className={styles.setupValue}>
            <button className={styles.tool} onClick={() => onChange([...steps, { id: newId(), glyph: '◆', label: 'new step', tone: 'fg' }])}>
              + step
            </button>
          </div>
        </div>
      )}
    </>
  )
}
