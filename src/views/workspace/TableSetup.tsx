// A table's setup (D-209, D-218), in the matrix's way (D-212): a tabbed panel over the bottom middle of its space (the
// screen in focus, a pane beside a plane, D-211), above the dock: rows · columns · view, and `start over from ▾` (a
// template; ⌘Z brings back what it replaced). The same editors make a new table in the wizard (TableWizard.tsx), on a
// draft instead of the piece. Rows: the cards that meet its rules (each a field, `is` or `is not`, and the values it
// takes; none required), then cards and names added by hand. Columns: the cards' own fields (switched on and off) and
// columns of its own (a mark from a scale, a number with a unit, a few words, a check), moved, renamed, taken out.
// View: rows a page, the order. Every change is one undo step; typing in a field merges into one.
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { kindOfPiece } from '../../data/pieces'
import { newId, SCALES } from '../../data/matrix'
import { choicesOf, MAX_RULES, RULE_FIELDS, rowsOf, type Rule, type RuleField, type Source, type SourceItem } from '../../data/source'
import {
  colName,
  COL_NAME_MAX,
  DEFAULT_STEPS,
  FIELDS,
  MAX_COLS,
  NAME_COL,
  OWN_KINDS,
  PAGE_SIZES,
  removeColumn,
  removeRow,
  setTable,
  setTablePart,
  TEMPLATES,
  type Column,
  type Field,
  type OwnKind,
  type TableSetup,
} from '../../data/table'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { Select } from '../../ui/Select'
import { AutosaveField } from '../../ui/AutosaveField'
import { useWs } from './context'
import { AddPill, Choices, Row, Toggle } from './MatrixSetup'
import { tableOf, useTableUi, TABLE_TABS, type TableTab } from './Table'
import { TYPE_ACCENT } from './PlaneCards'
import m from './Matrix.module.css'
import styles from './Table.module.css'

const TAB_NAME: Record<TableTab, string> = { rows: 'rows', cols: 'columns', view: 'view' }

// One part of a setup changed: on the piece (one undo step each), or on the wizard's draft.
export type SetTable = <K extends keyof TableSetup>(part: K, value: TableSetup[K] | undefined, key?: string) => void

export function TableSetupPanel({ piece }: { piece: WithId<Piece> }) {
  const { wid, cards, cells } = useWs()
  const setup = tableOf(piece)
  const tab = useTableUi((s) => s.tab)
  const part: SetTable = (k, v, key) => void setTablePart(wid, piece.id, k, v, key)
  const close = () => useTableUi.setState({ setup: null })
  const count = { rows: rowsOf(setup.rows, cards, !setup.manual).length, cols: setup.cols.length + 1 }
  const restart: MenuEntry[] = TEMPLATES.map((t) => ({ key: t.key, label: t.name, hint: t.hint, onSelect: () => void setTable(wid, piece.id, t.setup(), piece.name ? undefined : t.name) }))
  return (
    <section className={m.setup} aria-label="Set up the table" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())}>
      <header className={m.setupHead}>
        <nav className={m.tabs} role="tablist" aria-label="Setup">
          {TABLE_TABS.map((t) => (
            <button key={t} role="tab" aria-selected={t === tab} className={m.tab} onClick={() => useTableUi.setState({ tab: t })}>
              {TAB_NAME[t]}
              {t !== 'view' && <span className={m.tabCount}>{count[t]}</span>}
            </button>
          ))}
        </nav>
        <span className={m.setupEnd}>
          <Menu label="start over from" up quiet prompt="a template…" noun="templates" ariaLabel="Start over from a template (⌘Z brings back what it replaces)" items={[{ key: 'h', heading: 'replaces rows and columns' }, ...restart]} />
          <button className={m.tool} title="close (Esc)" onClick={close}>
            done
          </button>
        </span>
      </header>
      <div className={m.setupBody} role="tabpanel">
        {tab === 'rows' && (
          <RowsEditor
            setup={setup}
            onChange={part}
            // On the piece a typed row goes with its values, as its `×` on the table does.
            onRemoveItem={(item) => void removeRow(wid, piece.id, setup, { key: item.cardId ?? item.id, name: item.name ?? '', item, auto: false }, cells)}
          />
        )}
        {tab === 'cols' && <ColumnsEditor setup={setup} onChange={part} onRemoveCol={(c) => void removeColumn(wid, piece.id, setup, c.id, cells)} />}
        {tab === 'view' && <ViewEditor setup={setup} onChange={part} />}
      </div>
    </section>
  )
}

type EditorProps = { setup: TableSetup; onChange: SetTable }

// Rows: the cards that meet the rules (switched off: a list of names), the rules, and what's added by hand.
export function RowsEditor({ setup, onChange, onRemoveItem }: EditorProps & { onRemoveItem?: (item: SourceItem) => void }) {
  const { cards } = useWs()
  const rows = setup.rows
  const set = (s: Source, key?: string) => onChange('rows', s, key)
  const hidden = rows.hide?.length ?? 0
  const byId = new Map(cards.map((c) => [c.id, c]))
  const on = new Set(rowsOf(rows, cards, !setup.manual).map((r) => r.key))
  // A rule changed by hand is yours, even the one linking set (D-210).
  const setRule = (i: number, r: Rule | null, key?: string) => {
    const own = r && (({ auto: _, ...rest }) => rest)(r)
    set({ ...rows, rules: own ? rows.rules.map((x, j) => (j === i ? own : x)) : rows.rules.filter((_, j) => j !== i) }, key)
  }
  const drop = (item: SourceItem) => (onRemoveItem ? onRemoveItem(item) : set({ ...rows, items: rows.items.filter((i) => i !== item) }))
  return (
    <>
      <Row label="cards" hint="they join and leave by themselves as cards are made, changed or deleted">
        <Toggle on={!setup.manual} label="the cards that meet these rules" hint={rows.rules.length ? 'every rule must hold' : 'no rules: every card on every plane'} onChange={(v) => onChange('manual', v ? undefined : true)} />
        {hidden > 0 && (
          <button className={m.tool} title="bring back the cards taken out" onClick={() => set({ ...rows, hide: undefined })}>
            {hidden} hidden · show
          </button>
        )}
      </Row>
      {!setup.manual &&
        rows.rules.map((r, i) => <RuleLine key={i} rule={r} first={i === 0} onChange={(next, key) => setRule(i, next, key ? `rule:${i}:${key}` : undefined)} onRemove={() => setRule(i, null)} />)}
      {!setup.manual && rows.rules.length < MAX_RULES && (
        <Row label={rows.rules.length ? 'and' : 'where'}>
          <span className={m.choices}>
            {RULE_FIELDS.filter((f) => !rows.rules.some((r) => r.field === f)).map((f) => (
              <button key={f} className={m.choice} onClick={() => set({ ...rows, rules: [...rows.rules, { field: f, values: [] }] })}>
                + {f}
              </button>
            ))}
          </span>
        </Row>
      )}
      <Row label="added by hand" hint="single cards of any type, or names that aren't cards">
        <span className={m.pills}>
          {rows.items.map((item) => {
            const c = item.cardId ? byId.get(item.cardId) : undefined
            if (item.cardId && !c) return null
            return (
              <span key={item.id} className={m.pill} data-card={c ? true : undefined} style={c ? { ['--type' as string]: TYPE_ACCENT[c.type] } : undefined} title={c ? c.type : 'a typed name'}>
                <span className={m.pillMark} aria-hidden />
                {c ? c.title || `untitled ${c.type}` : item.name || 'name'}
                <button className={m.pillX} aria-label="Take it out" onClick={() => drop(item)}>
                  ×
                </button>
              </span>
            )
          })}
          <AddPill
            exclude={on}
            onCard={(c) => set({ ...rows, hide: rows.hide?.filter((h) => h !== c.id), items: rows.hide?.includes(c.id) ? rows.items : [...rows.items, { id: newId(), cardType: c.type, cardId: c.id }] })}
            onName={(n) => set({ ...rows, items: [...rows.items, { id: newId(), name: n }] })}
          />
        </span>
      </Row>
    </>
  )
}

// One rule: `where type is idea · feature`, `and plane is not 02`, `and title has "sync"`. Its values are picked from
// what the workspace has; a rule with none picked doesn't narrow anything yet.
function RuleLine({ rule, first, onChange, onRemove }: { rule: Rule; first: boolean; onChange: (r: Rule, key?: string) => void; onRemove: () => void }) {
  const { cards, pieces } = useWs()
  const planes = pieces.filter((p) => kindOfPiece(p) === 'plane')
  const choices = choicesOf(rule.field, cards, planes)
  const toggle = (v: string) => onChange({ ...rule, values: rule.values.includes(v) ? rule.values.filter((x) => x !== v) : [...rule.values, v] })
  return (
    <Row label={first ? 'where' : 'and'}>
      <span className={m.choices}>
        <Select<string>
          ariaLabel="What it looks at"
          className={m.select}
          value={rule.field}
          options={RULE_FIELDS.map((f) => ({ value: f, label: f }))}
          onChange={(f) => onChange({ field: f as RuleField, values: [], ...(rule.not ? { not: true } : {}) })}
        />
        <button className={m.choice} title="is, or is not" onClick={() => onChange({ ...rule, not: rule.not ? undefined : true })}>
          {rule.field === 'title' ? (rule.not ? 'lacks' : 'has') : rule.not ? 'is not' : 'is'}
        </button>
        {rule.field === 'title' ? (
          <AutosaveField className={m.pillField} label="the words" placeholder="words in the title" maxLength={200} value={rule.values[0] ?? ''} onSave={(w) => onChange({ ...rule, values: w.trim() ? [w] : [] }, 'words')} />
        ) : choices.length ? (
          choices.map((c) => (
            <button
              key={c.value}
              className={m.choice}
              aria-pressed={rule.values.includes(c.value)}
              style={rule.field === 'type' ? { ['--type' as string]: TYPE_ACCENT[c.value as keyof typeof TYPE_ACCENT] } : undefined}
              onClick={() => toggle(c.value)}
            >
              {rule.field === 'type' && <span className={m.typeTick} aria-hidden />}
              {c.label}
            </button>
          ))
        ) : (
          <span className={m.checkHint}>{rule.field === 'tag' ? 'no tags yet' : 'nothing to pick yet'}</span>
        )}
        {rule.auto && (
          <span className={styles.auto} title="set by itself: the plane it's linked to. Change it and it's yours">
            · auto
          </span>
        )}
        <button className={m.pillX} title="take the rule out" aria-label="Take the rule out" onClick={onRemove}>
          ×
        </button>
      </span>
    </Row>
  )
}

const OWN_NAME: Record<OwnKind, { label: string; name: string; sample: string; hint: string }> = {
  scale: { label: 'a mark', name: 'mark', sample: '▁▄█', hint: 'from a scale: low → high, yes / no, 1 – 5…' },
  number: { label: 'a number', name: 'number', sample: '42', hint: 'a price, hours, a score; sorts by size' },
  text: { label: 'a few words', name: 'notes', sample: 'beta', hint: 'up to 200 characters' },
  check: { label: 'a check', name: 'done', sample: '✓', hint: 'done or not' },
}

// Columns: the name first (always); the cards' fields switched on and off; columns of its own, each a kind of value.
export function ColumnsEditor({ setup, onChange, onRemoveCol }: EditorProps & { onRemoveCol?: (c: Column) => void }) {
  const cols = setup.cols
  const set = (next: Column[], key?: string) => onChange('cols', next, key)
  const edit = (c: Column, change: Partial<Column>, key?: string) => set(cols.map((x) => (x.id === c.id ? { ...x, ...change } : x)), key ? `col:${c.id}:${key}` : undefined)
  const drop = (c: Column) => (onRemoveCol ? onRemoveCol(c) : set(cols.filter((x) => x !== c)))
  const move = (i: number, by: -1 | 1) => {
    const j = i + by
    if (j < 0 || j >= cols.length) return
    const next = [...cols]
    ;[next[i], next[j]] = [next[j], next[i]]
    set(next)
  }
  const full = cols.length >= MAX_COLS
  return (
    <>
      <Row label="the card's" hint="shown as they are on the card; switch one on to add it, off to take it out">
        <span className={m.choices}>
          {FIELDS.map((f) => {
            const c = cols.find((x) => x.field === f)
            return (
              <button key={f} className={m.choice} aria-pressed={!!c} disabled={!c && full} onClick={() => (c ? drop(c) : set([...cols, { id: newId(), field: f as Field }]))}>
                {f}
              </button>
            )
          })}
        </span>
      </Row>
      <Row label="its own" hint="values only this table holds">
        <span className={m.kinds}>
          {OWN_KINDS.map((k) => (
            <button
              key={k}
              className={m.kind}
              disabled={full}
              onClick={() => set([...cols, { id: newId(), name: OWN_NAME[k].name, kind: k, ...(k === 'scale' ? { steps: DEFAULT_STEPS } : {}) }])}
            >
              <span className={m.kindSample} aria-hidden>
                {OWN_NAME[k].sample}
              </span>
              + {OWN_NAME[k].label}
              <small>{OWN_NAME[k].hint}</small>
            </button>
          ))}
        </span>
      </Row>
      <Row label="in order" hint="the name always comes first">
        <ol className={styles.colList}>
          <li className={styles.colItem}>
            <span className={styles.colFixed}>{setup.manual ? 'name' : 'title'}</span>
            <span className={m.checkHint}>always first</span>
          </li>
          {cols.map((c, i) => (
            <li key={c.id} className={styles.colItem}>
              <button className={m.tool} disabled={i === 0} title="move it left" aria-label="Move left" onClick={() => move(i, -1)}>
                ‹
              </button>
              <button className={m.tool} disabled={i === cols.length - 1} title="move it right" aria-label="Move right" onClick={() => move(i, 1)}>
                ›
              </button>
              {c.field ? (
                <span className={styles.colFixed}>{colName(c)}</span>
              ) : (
                <AutosaveField className={m.pillField} label="column name" maxLength={COL_NAME_MAX} value={c.name ?? ''} placeholder="name" onSave={(n) => edit(c, { name: n.trim() || undefined }, 'name')} />
              )}
              {c.field ? (
                <span className={m.checkHint}>the card's</span>
              ) : (
                <>
                  <Choices<OwnKind>
                    value={c.kind ?? 'text'}
                    options={OWN_KINDS.map((k) => ({ value: k, label: OWN_NAME[k].sample, hint: OWN_NAME[k].label }))}
                    onChange={(k) => edit(c, { kind: k, ...(k === 'scale' && !c.steps ? { steps: DEFAULT_STEPS } : {}) })}
                  />
                  {c.kind === 'number' && (
                    <AutosaveField className={m.field} label="unit" placeholder="unit: €, h, %…" maxLength={20} value={c.unit ?? ''} onSave={(u) => edit(c, { unit: u.trim() || undefined }, 'unit')} />
                  )}
                  {c.kind === 'scale' && (
                    <Select<string>
                      ariaLabel="Its steps"
                      className={m.select}
                      value={SCALES.find((s) => JSON.stringify(s.steps) === JSON.stringify(c.steps ?? DEFAULT_STEPS))?.key ?? 'own'}
                      options={[...SCALES.map((s) => ({ value: s.key, label: `${s.name}  ${s.steps.map((x) => x.glyph).join('')}` })), { value: 'own', label: 'its own steps' }]}
                      onChange={(k) => {
                        const s = SCALES.find((x) => x.key === k)
                        if (s) edit(c, { steps: s.steps })
                      }}
                    />
                  )}
                </>
              )}
              <button className={m.pillX} title="take the column out (its values go; ⌘Z brings them back)" aria-label={`Take ${colName(c)} out`} onClick={() => drop(c)}>
                ×
              </button>
            </li>
          ))}
        </ol>
      </Row>
    </>
  )
}

const ALL = 'all'
const NONE = 'none'

// View: how many rows a page, and the order (the heads sort too).
export function ViewEditor({ setup, onChange }: EditorProps) {
  return (
    <>
      <Row label="rows a page" hint="the dock pages through them">
        <Choices<string>
          value={setup.pageSize ? String(setup.pageSize) : ALL}
          options={[{ value: ALL, label: 'all' }, ...PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))]}
          onChange={(v) => onChange('pageSize', v === ALL ? undefined : Number(v))}
        />
      </Row>
      <Row label="in order of" hint="a column's head sorts by it too">
        <span className={m.choices}>
          <Select<string>
            ariaLabel="Sort by"
            className={m.select}
            value={setup.sort?.col ?? NONE}
            options={[{ value: NONE, label: 'as they come' }, { value: NAME_COL, label: setup.manual ? 'name' : 'title' }, ...setup.cols.map((c) => ({ value: c.id, label: colName(c) }))]}
            onChange={(v) => onChange('sort', v === NONE ? undefined : { col: v, ...(setup.sort?.desc ? { desc: true } : {}) })}
          />
          {setup.sort && (
            <Choices<string>
              value={setup.sort.desc ? 'down' : 'up'}
              options={[
                { value: 'up', label: '↑ a → z' },
                { value: 'down', label: '↓ z → a' },
              ]}
              onChange={(v) => onChange('sort', { col: setup.sort!.col, ...(v === 'down' ? { desc: true } : {}) })}
            />
          )}
        </span>
      </Row>
    </>
  )
}
