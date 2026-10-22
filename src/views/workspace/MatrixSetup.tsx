// A matrix's setup (D-212): a tabbed panel over the bottom middle of its space (the screen in focus, a pane beside a
// plane, D-211), above the dock: rows · columns · cells · options, and `start over from ▾` (a template; ⌘Z brings back
// what it replaced). The same editors make a new matrix in the wizard (MatrixWizard.tsx), on a draft instead of the
// piece. An axis takes every card of a type (on any plane or one) and what's added by hand: cards and typed names. The
// cells are a mark from a scale (its steps edited here: glyph, name, colour; shown as squares or as their glyphs), a
// number (with a unit) or a few words. Options: `doesn't apply`, guesses marked, the totals (where, and as what).
// Every change is one undo step; typing in a field merges into one.
import { useRef, useState, type ReactNode } from 'react'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { CARD_TYPES, type Card, type CardType } from '../../data/cards'
import { kindOfPiece } from '../../data/pieces'
import {
  CELL_KINDS,
  entriesOf,
  GLYPH_MAX,
  LABEL_MAX,
  MAX_STEPS,
  NAME_MAX,
  newId,
  removeEntry,
  SCALES,
  setPart,
  setSetup,
  TEMPLATES,
  TONE_VAR,
  TONES,
  TOTALS_AS,
  TOTALS_AT,
  type Axis,
  type AxisItem,
  type CellKind,
  type MatrixSetup,
  type Step,
} from '../../data/matrix'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { Select } from '../../ui/Select'
import { AutosaveField } from '../../ui/AutosaveField'
import { useWs } from './context'
import { closeMatrixSetup, openMatrixSetup, setupOf, setupTab, SETUP_TABS, StepSquare, useMatrixUi, type SetupTab } from './Matrix'
import { TYPE_ACCENT } from './PlaneCards'
import styles from './Matrix.module.css'

const ANY = 'any'
const TAB_NAME: Record<SetupTab, string> = { rows: 'rows', cols: 'columns', cells: 'cells', options: 'options' }

// One part of a setup changed: on the piece (one undo step each), or on the wizard's draft.
export type SetPart = <K extends keyof MatrixSetup>(part: K, value: MatrixSetup[K] | undefined, key?: string) => void

export function MatrixSetupPanel({ piece }: { piece: WithId<Piece> }) {
  const { wid, cards, cells } = useWs()
  const setup = setupOf(piece)
  const tab = setupTab(useMatrixUi((s) => s.setup)) ?? 'rows'
  const part: SetPart = (k, v, key) => void setPart(wid, piece.id, k, v, key)
  const count = { rows: entriesOf(setup.rows, cards).length, cols: entriesOf(setup.cols, cards).length }
  // Taking a typed entry out takes its cells too, as its `×` on the table does.
  const removeItem = (which: 'rows' | 'cols', item: AxisItem) =>
    void removeEntry(wid, piece.id, setup, which, { key: item.cardId ?? item.id, name: item.name ?? '', item, auto: false }, cells)
  const restart: MenuEntry[] = TEMPLATES.map((t) => ({ key: t.key, label: t.name, hint: t.hint, onSelect: () => void setSetup(wid, piece.id, t.setup(), piece.name ? undefined : t.name) }))
  return (
    <section className={styles.setup} aria-label="Set up the matrix" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), closeMatrixSetup())}>
      <header className={styles.setupHead}>
        <nav className={styles.tabs} role="tablist" aria-label="Setup">
          {SETUP_TABS.map((t) => (
            <button key={t} role="tab" aria-selected={t === tab} className={styles.tab} onClick={() => openMatrixSetup(t)}>
              {TAB_NAME[t]}
              {(t === 'rows' || t === 'cols') && <span className={styles.tabCount}>{count[t]}</span>}
            </button>
          ))}
        </nav>
        <span className={styles.setupEnd}>
          <Menu label="start over from" up quiet ariaLabel="Start over from a template (⌘Z brings back what it replaces)" items={[{ key: 'h', heading: 'replaces rows, columns and cells' }, ...restart]} />
          <button className={styles.tool} title="close (Esc)" onClick={closeMatrixSetup}>
            done
          </button>
        </span>
      </header>
      <div className={styles.setupBody} role="tabpanel">
        {(tab === 'rows' || tab === 'cols') && (
          <AxisEditor key={tab} which={tab} axis={setup[tab]} onChange={(a, key) => part(tab, a, key)} onRemoveItem={(item) => removeItem(tab, item)} />
        )}
        {tab === 'cells' && <CellsEditor setup={setup} onChange={part} />}
        {tab === 'options' && <OptionsEditor setup={setup} onChange={part} />}
      </div>
    </section>
  )
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.setupRow}>
      <span className={styles.setupLabel} title={hint}>
        {label}
      </span>
      <div className={styles.setupValue}>{children}</div>
    </div>
  )
}

function Toggle({ on, label, hint, onChange }: { on: boolean; label: string; hint: string; onChange: (v: boolean) => void }) {
  return (
    <button className={styles.check} aria-pressed={on} onClick={() => onChange(!on)}>
      <span className={styles.box}>{on ? '[x]' : '[ ]'}</span>
      <span>
        {label}
        <small className={styles.checkHint}>{hint}</small>
      </span>
    </button>
  )
}

// Pick one of a few: framed choices, the picked one cyan.
function Choices<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <span className={styles.choices}>
      {options.map((o) => (
        <button key={o.value} className={styles.choice} aria-pressed={o.value === value} title={o.hint} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  )
}

type AxisProps = {
  which: 'rows' | 'cols'
  axis: Axis
  onChange: (a: Axis, key?: string) => void
  // On a piece, a typed entry goes with its cells; on a draft it's just dropped.
  onRemoveItem?: (item: AxisItem) => void
}

// An axis: every card of one type (on any plane or one), then what's added by hand, cards and typed names; and what one
// of them is called in the corner.
export function AxisEditor({ which, axis, onChange, onRemoveItem }: AxisProps) {
  const { cards, pieces } = useWs()
  const planes = pieces.filter((p) => kindOfPiece(p) === 'plane')
  const hidden = axis.hide?.length ?? 0
  const byId = new Map(cards.map((c) => [c.id, c]))
  const on = new Set([...entriesOf(axis, cards).map((e) => e.key)])
  const ofType = (t: string) => cards.filter((c) => c.type === t && (!axis.plane || c.pieceId === axis.plane)).length
  const drop = (item: AxisItem) => (onRemoveItem ? onRemoveItem(item) : onChange({ ...axis, items: axis.items.filter((i) => i !== item) }))
  return (
    <>
      <Row label="all cards of" hint="they join and leave by themselves as cards are made or deleted">
        <span className={styles.choices}>
          {CARD_TYPES.map((t) => (
            <button
              key={t}
              className={styles.choice}
              aria-pressed={axis.type === t}
              style={{ ['--type' as string]: TYPE_ACCENT[t] }}
              title={axis.type === t ? 'click again for none' : `every ${t}`}
              onClick={() => onChange({ ...axis, type: axis.type === t ? undefined : t, hide: undefined })}
            >
              <span className={styles.typeTick} aria-hidden />
              {t}s <span className={styles.tabCount}>{ofType(t)}</span>
            </button>
          ))}
        </span>
      </Row>
      {axis.type && (
        <Row label="on">
          <Select
            ariaLabel={`${which}: on which plane`}
            className={styles.select}
            value={axis.plane ?? ANY}
            options={[{ value: ANY, label: 'any plane' }, ...planes.map((p) => ({ value: p.id, label: p.name || 'unnamed plane' }))]}
            onChange={(v) => onChange({ ...axis, plane: v === ANY ? undefined : v })}
          />
          {hidden > 0 && (
            <button className={styles.tool} title="bring back the cards taken out" onClick={() => onChange({ ...axis, hide: undefined })}>
              {hidden} hidden · show
            </button>
          )}
        </Row>
      )}
      <Row label="added by hand" hint="single cards of any type, or names that aren't cards (criteria, questions…)">
        <span className={styles.pills}>
          {axis.items.map((item) => {
            const c = item.cardId ? byId.get(item.cardId) : undefined
            if (item.cardId && !c) return null
            return (
              <span key={item.id} className={styles.pill} data-card={c ? true : undefined} style={c ? { ['--type' as string]: TYPE_ACCENT[c.type] } : undefined} title={c ? c.type : 'a typed name'}>
                <span className={styles.pillMark} aria-hidden />
                {c ? c.title || `untitled ${c.type}` : item.name || 'name'}
                <button className={styles.pillX} aria-label="Take it out" onClick={() => drop(item)}>
                  ×
                </button>
              </span>
            )
          })}
          <AddPill
            exclude={on}
            prefer={axis.type}
            onCard={(c) => onChange({ ...axis, items: [...axis.items, { id: newId(), cardType: c.type, cardId: c.id }] })}
            onName={(n) => onChange({ ...axis, items: [...axis.items, { id: newId(), name: n }] })}
          />
        </span>
      </Row>
      <Row label="called" hint="what one of them is, in the table's corner">
        <AutosaveField className={styles.pillField} label="called" placeholder={axis.type ? `${axis.type}s` : 'names'} maxLength={40} value={axis.noun ?? ''} onSave={(n) => n.trim() !== (axis.noun ?? '') && onChange({ ...axis, noun: n.trim() || undefined }, 'noun')} />
      </Row>
    </>
  )
}

// One field to add by hand (D-216), shaped like the pills it adds: type and it lists the cards that match (the axis's
// type first) under `+ "…" as a name`; arrows move, Enter or a click takes the lit one, Escape lets go. Focused empty,
// the axis's type's cards not on it yet are offered. The list opens upward: the setup sits at the screen's bottom.
function AddPill({ exclude, prefer, onCard, onName }: { exclude: Set<string>; prefer?: CardType; onCard: (c: Card) => void; onName: (n: string) => void }) {
  const { cards } = useWs()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [lit, setLit] = useState(0)
  const field = useRef<HTMLInputElement>(null)
  const query = q.trim().toLowerCase()
  const free = cards.filter((c) => !exclude.has(c.id))
  const matches = (query ? free.filter((c) => c.title.toLowerCase().includes(query)) : free.filter((c) => c.type === prefer))
    .sort((a, b) => Number(b.type === prefer) - Number(a.type === prefer))
    .slice(0, 6)
  const options: ({ name: string } | { card: Card })[] = [...(query ? [{ name: q.trim().slice(0, NAME_MAX) }] : []), ...matches.map((card) => ({ card }))]
  const take = (o: (typeof options)[number]) => {
    if ('card' in o) onCard(o.card)
    else onName(o.name)
    setQ('')
    setLit(0)
    field.current?.focus()
  }
  return (
    <span className={styles.addPill} data-open={open || undefined}>
      <span className={styles.pillPlus} aria-hidden>
        +
      </span>
      <input
        ref={field}
        className={styles.addPillField}
        value={q}
        maxLength={NAME_MAX}
        placeholder="a card, or type a name"
        aria-label="Add a card or a name"
        role="combobox"
        aria-expanded={open && options.length > 0}
        onFocus={() => setOpen(true)}
        onBlur={(e) => !e.currentTarget.parentElement?.contains(e.relatedTarget as Node) && setOpen(false)}
        onChange={(e) => {
          setQ(e.target.value)
          setLit(0)
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const n = options.length
            if (n) setLit((lit + (e.key === 'ArrowDown' ? 1 : n - 1)) % n)
          }
          if (e.key === 'Enter' && options[lit]) take(options[lit])
          if (e.key === 'Escape') {
            setQ('')
            e.currentTarget.blur()
          }
        }}
      />
      {open && options.length > 0 && (
        <span className={styles.addList} role="listbox">
          {options.map((o, i) => (
            <button
              key={'card' in o ? o.card.id : 'name'}
              role="option"
              aria-selected={i === lit}
              className={styles.addOpt}
              style={'card' in o ? { ['--type' as string]: TYPE_ACCENT[o.card.type] } : undefined}
              data-card={'card' in o || undefined}
              onPointerEnter={() => setLit(i)}
              onClick={() => take(o)}
            >
              <span className={styles.pillMark} aria-hidden />
              {'card' in o ? (
                <>
                  <span className={styles.addOptName}>{o.card.title || `untitled ${o.card.type}`}</span>
                  <span className={styles.addOptType}>{o.card.type}</span>
                </>
              ) : (
                <span className={styles.addOptName}>"{o.name}" as a name</span>
              )}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}

const KIND: Record<CellKind, { label: ReactNode; hint: string }> = {
  scale: { label: 'a mark', hint: 'from a scale: none → full, yes / no, 1 – 5, or your own' },
  number: { label: 'a number', hint: 'a price, hours, a score; the totals give the average' },
  text: { label: 'a few words', hint: 'up to 200 characters; the totals count what is written' },
}

// What goes in a cell: a mark from a scale (its steps), a number (its unit) or a few words.
export function CellsEditor({ setup, onChange }: { setup: MatrixSetup; onChange: SetPart }) {
  return (
    <>
      <Row label="a cell holds">
        <span className={styles.kinds}>
          {CELL_KINDS.map((k) => (
            <button key={k} className={styles.kind} aria-pressed={setup.cell === k} onClick={() => onChange('cell', k)}>
              <span className={styles.kindSample} aria-hidden>
                {k === 'scale' ? setup.steps.slice(-3).map((s) => <StepSquare key={s.id} steps={setup.steps} step={s} />) : k === 'number' ? `42${setup.unit ?? ''}` : 'beta only'}
              </span>
              {KIND[k].label}
              <small>{KIND[k].hint}</small>
            </button>
          ))}
        </span>
      </Row>
      {setup.cell === 'scale' && (
        <>
          <Row label="start from">
            {SCALES.map((sc) => (
              <button key={sc.key} className={styles.tool} title="replace the steps" onClick={() => onChange('steps', sc.steps)}>
                {sc.name}
              </button>
            ))}
          </Row>
          <StepsEditor steps={setup.steps} marks={!!setup.marks} onChange={(steps, key) => onChange('steps', steps, key)} />
          <Row label="show as" hint="squares filled to the step, or the steps' own glyphs">
            <Choices
              value={setup.marks ? 'marks' : 'squares'}
              options={[
                { value: 'squares', label: 'squares' },
                { value: 'marks', label: 'glyphs' },
              ]}
              onChange={(v) => onChange('marks', v === 'marks' || undefined)}
            />
          </Row>
        </>
      )}
      {setup.cell === 'number' && (
        <Row label="unit">
          <AutosaveField className={styles.field} label="unit" placeholder="€, h, %…" maxLength={20} value={setup.unit ?? ''} onSave={(u) => onChange('unit', u.trim() || undefined, 'unit')} />
        </Row>
      )}
    </>
  )
}

// The scale's steps, low to high: the key that sets it, how it shows, a glyph, a name, a colour (click for the next),
// taken out by `×`.
function StepsEditor({ steps, marks, onChange }: { steps: Step[]; marks: boolean; onChange: (steps: Step[], key?: string) => void }) {
  const edit = (i: number, s: Partial<Step>, key?: string) => onChange(steps.map((x, j) => (j === i ? { ...x, ...s } : x)), key)
  return (
    <ol className={styles.steps}>
      {steps.map((s, i) => (
        <li key={s.id} className={styles.step}>
          <span className={styles.stepKey}>{i + 1}</span>
          <span className={styles.stepLook} style={{ ['--tone' as string]: TONE_VAR[s.tone] }}>
            {marks ? s.glyph : <StepSquare steps={steps} step={s} />}
          </span>
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
      {steps.length < MAX_STEPS && (
        <li className={styles.step}>
          <span className={styles.stepKey} />
          <button className={styles.tool} onClick={() => onChange([...steps, { id: newId(), glyph: '◆', label: 'new step', tone: 'fg' }])}>
            + step
          </button>
        </li>
      )}
    </ol>
  )
}

const AT_NAME: Record<(typeof TOTALS_AT)[number], string> = { head: 'in the heads', end: 'at the ends', both: 'both' }
const AS_NAME: Record<(typeof TOTALS_AS)[number], string> = { squares: 'squares', number: 'a number', bar: 'a line' }

// `doesn't apply`, guesses marked, and the totals: whether, where and as what.
export function OptionsEditor({ setup, onChange }: { setup: MatrixSetup; onChange: SetPart }) {
  return (
    <>
      <Row label="cells">
        <Toggle on={!!setup.notRelevant} label={'allow "doesn\'t apply" (—)'} hint="the two can't be compared; left out of the totals. Key -" onChange={(v) => onChange('notRelevant', v || undefined)} />
        <Toggle on={!!setup.confidence} label="mark guesses" hint="~ inferred, ? a guess, in the cell's corner; documented has no mark" onChange={(v) => onChange('confidence', v || undefined)} />
      </Row>
      <Row label="totals">
        <Toggle on={!!setup.reading} label="show totals" hint="each row and column summed up" onChange={(v) => onChange('reading', v || undefined)} />
      </Row>
      {setup.reading && (
        <>
          <Row label="where">
            <Choices value={setup.totalsAt ?? 'head'} options={TOTALS_AT.map((v) => ({ value: v, label: AT_NAME[v] }))} onChange={(v) => onChange('totalsAt', v === 'head' ? undefined : v)} />
          </Row>
          <Row label="as" hint={setup.cell === 'scale' ? undefined : 'numbers show their average, words how many are written'}>
            {setup.cell === 'scale' ? (
              <Choices
                value={setup.totalsAs ?? 'squares'}
                options={TOTALS_AS.map((v) => ({
                  value: v,
                  label: (
                    <>
                      <TotalsSample as={v} steps={setup.steps} /> {AS_NAME[v]}
                    </>
                  ),
                }))}
                onChange={(v) => onChange('totalsAs', v === 'squares' ? undefined : v)}
              />
            ) : (
              <span className={styles.checkHint}>{setup.cell === 'number' ? 'the average' : 'how many are written'}</span>
            )}
          </Row>
        </>
      )}
    </>
  )
}

// How each look of the totals reads, small, in the choice.
function TotalsSample({ as, steps }: { as: (typeof TOTALS_AS)[number]; steps: Step[] }) {
  const tones = steps.slice(-3).map((s) => TONE_VAR[s.tone])
  if (as === 'number') return <span className={styles.sampleNum}>3/5</span>
  if (as === 'bar')
    return (
      <span className={styles.sampleBar} aria-hidden>
        {tones.map((t, i) => (
          <span key={i} style={{ background: t, flexGrow: i + 1 }} />
        ))}
        <span style={{ flexGrow: 2 }} />
      </span>
    )
  return (
    <span className={styles.sampleSquares} aria-hidden>
      {tones.map((t, i) => (
        <i key={i} style={{ background: t }} />
      ))}
      <i data-empty />
      <i data-empty />
    </span>
  )
}
