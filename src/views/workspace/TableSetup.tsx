// A table's setup (D-209), from the focus dock's `[setup]`: a framed panel over the bottom middle of the screen, above
// the dock, like the matrix's. Start from a template; the rows' rules (each a field, `is` or `is not`, and the values it
// takes; none required), cards taken out, names and cards added by hand; the columns (a card's field, or one of its own:
// a scale, a number with a unit, a text, a check), moved, renamed, taken out. Every change is one undo step; typing in
// a field merges into one.
import type { ReactNode } from 'react'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { CARD_TYPES } from '../../data/cards'
import { kindOfPiece } from '../../data/pieces'
import { SCALES } from '../../data/matrix'
import { choicesOf, MAX_RULES, RULE_FIELDS, type Rule, type RuleField } from '../../data/source'
import {
  addCardRow,
  addColumn,
  addNamedRow,
  colName,
  COL_NAME_MAX,
  DEFAULT_STEPS,
  editColumn,
  FIELDS,
  MAX_COLS,
  moveColumn,
  OWN_KINDS,
  removeColumn,
  setRows,
  setTable,
  setTablePart,
  TEMPLATES,
  type Column,
  type Field,
  type OwnKind,
} from '../../data/table'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { Select } from '../../ui/Select'
import { AutosaveField } from '../../ui/AutosaveField'
import { useWs } from './context'
import { tableOf, useTableUi } from './Table'
import { TYPE_ACCENT } from './PlaneCards'
import styles from './Table.module.css'

const ADD = '+'

export function TableSetupPanel({ piece }: { piece: WithId<Piece> }) {
  const { wid, cards, cells } = useWs()
  const setup = tableOf(piece)
  const close = () => useTableUi.setState({ setup: null })
  const rows = setup.rows
  const hidden = rows.hide?.length ?? 0
  const used = new Set(setup.cols.map((c) => c.field).filter(Boolean))
  // A card to add as a row, found by its title.
  const picks: MenuEntry[] = CARD_TYPES.flatMap((t) => {
    const of = cards.filter((c) => c.type === t)
    if (!of.length) return []
    return [
      { key: `h-${t}`, heading: `${t}s` },
      ...of.map((c) => ({ key: c.id, label: c.title || `untitled ${t}`, glyph: '▌', tone: TYPE_ACCENT[t], onSelect: () => void addCardRow(wid, piece.id, setup, c) })),
    ]
  })
  // A rule changed by hand is yours, even the one sticking set (D-210).
  const setRule = (i: number, r: Rule | null, key?: string) => {
    const own = r && (({ auto: _, ...rest }) => rest)(r)
    void setRows(wid, piece.id, { ...rows, rules: own ? rows.rules.map((x, j) => (j === i ? own : x)) : rows.rules.filter((_, j) => j !== i) }, key)
  }
  const addRule = (field: RuleField) => void setRows(wid, piece.id, { ...rows, rules: [...rows.rules, { field, values: [] }] })
  const col = (c: Column, change: Partial<Column>, key?: string) => void editColumn(wid, piece.id, setup, c.id, change, key)

  return (
    <section className={styles.setup} aria-label="Set up the table" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())}>
      <header className={styles.setupHead}>
        <span className={styles.setupTitle}>set up</span>
        {/* The card picker opens over the panel, so it stays out of the scrolling body. */}
        {picks.length > 0 && <Menu label="+ card" up alignEnd search="find a card" ariaLabel="Add a card as a row" items={picks} />}
        <button className={styles.tool} onClick={() => void addNamedRow(wid, piece.id, setup).then((id) => useTableUi.setState({ naming: id }))}>
          + name
        </button>
        <button className={styles.tool} title="close (Esc)" onClick={close}>
          done
        </button>
      </header>

      <div className={styles.setupBody}>
        <Row label="start from">
          {TEMPLATES.map((t) => (
            <button key={t.key} className={styles.tool} title={`${t.hint}; replaces the rows and columns (⌘Z brings them back)`} onClick={() => void setTable(wid, piece.id, t.setup(), piece.name ? undefined : t.name)}>
              {t.name}
            </button>
          ))}
        </Row>

        <Row label="rows">
          <button className={styles.check} aria-pressed={!setup.manual} title="cards that meet the rules below join by themselves" onClick={() => void setTablePart(wid, piece.id, 'manual', setup.manual ? undefined : true)}>
            <span className={styles.box}>{setup.manual ? '[ ]' : '[x]'}</span> cards that meet the rules
          </button>
          {!setup.manual && !rows.rules.length && <span className={styles.dim}>no rules: every card on every plane</span>}
          {hidden > 0 && (
            <button className={styles.tool} title="bring back the cards taken out" onClick={() => void setRows(wid, piece.id, { ...rows, hide: undefined })}>
              {hidden} taken out
            </button>
          )}
        </Row>
        {!setup.manual &&
          rows.rules.map((r, i) => <RuleLine key={i} rule={r} first={i === 0} onChange={(next, key) => setRule(i, next, key ? `rule:${i}:${key}` : undefined)} onRemove={() => setRule(i, null)} />)}
        {!setup.manual && rows.rules.length < MAX_RULES && (
          <div className={styles.line}>
            <Select<string>
              ariaLabel="Add a rule"
              className={styles.select}
              value={ADD}
              options={[{ value: ADD, label: '+ rule' }, ...RULE_FIELDS.map((f) => ({ value: f, label: f }))]}
              onChange={(v) => v !== ADD && addRule(v as RuleField)}
            />
          </div>
        )}

        <Row label="columns">
          <span className={styles.dim}>first, the {setup.manual ? 'name' : 'title'}; then</span>
        </Row>
        {setup.cols.map((c, i) => (
          <div key={c.id} className={styles.line}>
            <button className={styles.tool} disabled={i === 0} title="move it left" aria-label="Move left" onClick={() => void moveColumn(wid, piece.id, setup, c.id, -1)}>
              ‹
            </button>
            <button className={styles.tool} disabled={i === setup.cols.length - 1} title="move it right" aria-label="Move right" onClick={() => void moveColumn(wid, piece.id, setup, c.id, 1)}>
              ›
            </button>
            {c.field ? (
              <span className={styles.colName}>{colName(c)}</span>
            ) : (
              <AutosaveField className={`${styles.field} ${styles.colName}`} label="column name" maxLength={COL_NAME_MAX} value={c.name ?? ''} placeholder="name" onSave={(n) => col(c, { name: n.trim() || undefined }, 'name')} />
            )}
            {c.field ? (
              <span className={styles.dim}>the card's, as it is</span>
            ) : (
              <>
                {OWN_KINDS.map((k) => (
                  <button key={k} className={styles.tool} aria-pressed={c.kind === k} onClick={() => col(c, { kind: k, ...(k === 'scale' && !c.steps ? { steps: DEFAULT_STEPS } : {}) })}>
                    {k}
                  </button>
                ))}
                {c.kind === 'number' && (
                  <AutosaveField className={styles.field} label="unit" placeholder="unit: €, h, %…" maxLength={20} value={c.unit ?? ''} onSave={(u) => col(c, { unit: u.trim() || undefined }, 'unit')} />
                )}
                {c.kind === 'scale' && (
                  <Select<string>
                    ariaLabel="Its steps"
                    className={styles.select}
                    value={SCALES.find((s) => JSON.stringify(s.steps) === JSON.stringify(c.steps ?? DEFAULT_STEPS))?.key ?? 'own'}
                    options={[...SCALES.map((s) => ({ value: s.key, label: `${s.name}  ${s.steps.map((x) => x.glyph).join('')}` })), { value: 'own', label: 'its own steps' }]}
                    onChange={(k) => {
                      const s = SCALES.find((x) => x.key === k)
                      if (s) col(c, { steps: s.steps })
                    }}
                  />
                )}
              </>
            )}
            <button className={styles.remove} style={{ opacity: 1 }} title="take the column out (its values go; ⌘Z brings them back)" aria-label={`Take ${colName(c)} out`} onClick={() => void removeColumn(wid, piece.id, setup, c.id, cells)}>
              ×
            </button>
          </div>
        ))}
        {setup.cols.length < MAX_COLS && (
          <div className={styles.line}>
            <Select<string>
              ariaLabel="Add one of its own columns"
              className={styles.select}
              value={ADD}
              options={[{ value: ADD, label: '+ column' }, ...OWN_KINDS.map((k) => ({ value: k, label: k }))]}
              onChange={(k) => k !== ADD && void addColumn(wid, piece.id, setup, { name: k === 'check' ? 'done' : k, kind: k as OwnKind, ...(k === 'scale' ? { steps: DEFAULT_STEPS } : {}) })}
            />
            {FIELDS.some((f) => !used.has(f)) && (
              <Select<string>
                ariaLabel="Add a card's field"
                className={styles.select}
                value={ADD}
                options={[{ value: ADD, label: "+ card's field" }, ...FIELDS.filter((f) => !used.has(f)).map((f) => ({ value: f, label: f }))]}
                onChange={(f) => f !== ADD && void addColumn(wid, piece.id, setup, { field: f as Field })}
              />
            )}
          </div>
        )}
      </div>
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

// One rule: `where plane is 01 · 02`, `and type is not competitor`, `and title has "sync"`. Its values are picked from
// what the workspace has; a rule with none picked doesn't narrow anything yet.
function RuleLine({ rule, first, onChange, onRemove }: { rule: Rule; first: boolean; onChange: (r: Rule, key?: string) => void; onRemove: () => void }) {
  const { cards, pieces } = useWs()
  const planes = pieces.filter((p) => kindOfPiece(p) === 'plane')
  const choices = choicesOf(rule.field, cards, planes)
  const toggle = (v: string) => onChange({ ...rule, values: rule.values.includes(v) ? rule.values.filter((x) => x !== v) : [...rule.values, v] })
  return (
    <div className={styles.line}>
      <span className={styles.word}>{first ? 'where' : 'and'}</span>
      <Select<string>
        ariaLabel="What it looks at"
        className={styles.select}
        value={rule.field}
        options={RULE_FIELDS.map((f) => ({ value: f, label: f }))}
        onChange={(f) => onChange({ field: f as RuleField, values: [], ...(rule.not ? { not: true } : {}) })}
      />
      <button className={styles.tool} title="is, or is not" onClick={() => onChange({ ...rule, not: rule.not ? undefined : true })}>
        {rule.field === 'title' ? (rule.not ? 'lacks' : 'has') : rule.not ? 'is not' : 'is'}
      </button>
      {rule.field === 'title' ? (
        <AutosaveField className={styles.field} label="the words" placeholder="words in the title" maxLength={200} value={rule.values[0] ?? ''} onSave={(w) => onChange({ ...rule, values: w.trim() ? [w] : [] }, 'words')} />
      ) : choices.length ? (
        choices.map((c) => (
          <button
            key={c.value}
            className={styles.pick}
            aria-pressed={rule.values.includes(c.value)}
            style={rule.field === 'type' ? { ['--tone' as string]: TYPE_ACCENT[c.value as keyof typeof TYPE_ACCENT] } : undefined}
            onClick={() => toggle(c.value)}
          >
            {c.label}
          </button>
        ))
      ) : (
        <span className={styles.dim}>{rule.field === 'tag' ? 'no tags yet' : 'nothing to pick yet'}</span>
      )}
      {rule.auto && (
        <span className={styles.auto} title="set by itself: the plane it's stuck to. Change it and it's yours">
          · auto
        </span>
      )}
      <button className={styles.remove} style={{ opacity: 1 }} title="take the rule out" aria-label="Take the rule out" onClick={onRemove}>
        ×
      </button>
    </div>
  )
}
