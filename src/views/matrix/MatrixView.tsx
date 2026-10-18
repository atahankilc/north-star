// /workspaces/:wid/matrix: our features × competitors. Each cell says how well that competitor covers the
// feature: once the feature has criteria, which of them they meet (D-133). The last column reads the row as a whole
// (gap, table stakes, mixed) and counts the criteria nobody meets.
import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { itemPath, workspacePath } from '../../app/paths'
import { cellId, setCell } from '../../data/comparisons'
import type { WithId } from '../../data/hooks'
import { CONFIDENCES, COVERAGES, type Comparison, type Confidence, type Coverage, type CriterionScore, type Feature } from '../../data/model'
import { Appear } from '../../ui/Appear'
import { AutosaveField } from '../../ui/AutosaveField'
import { Choice } from '../../ui/Choice'
import { DecodeText } from '../../ui/DecodeText'
import { Select } from '../../ui/Select'
import { setPresenceSelection } from '../../data/presence'
import { useCanvas } from '../../state/canvasStore'
import { useWs } from '../workspace/context'
import { CellPeers, MarkOn, markHoverOf, markRing, PeersOn } from '../workspace/PeerMarks'
import { useMarkOf, useStage } from '../workspace/stage'
import styles from './MatrixView.module.css'
import { CriteriaEditor, CriterionScores, SCORE_TONE } from './Criteria'
import { coverageOf, matrixCols, matrixRows, openCriteria, relevant, scoresOf, verdict } from './reading'

// Not assessed → none → partial → full → better → not assessed.
const GLYPH: Record<Coverage | 'unset', string> = { unset: '·', none: '○', partial: '◐', full: '●', better: '★' }
const TONE: Record<Coverage, string> = {
  none: 'var(--fg-dim)',
  partial: 'var(--accent-yellow)',
  full: 'var(--accent-cyan)',
  better: 'var(--accent-magenta)',
}

const next = (c: Coverage | undefined): Coverage | undefined =>
  c === undefined ? COVERAGES[0] : COVERAGES[COVERAGES.indexOf(c) + 1]

type Pos = { row: number; col: number }

export function MatrixView() {
  const { wid, features, competitors, comparisons } = useWs()
  const marks = useStage((s) => s.preview?.marks) ?? NO_MARKS
  const [selected, setSelected] = useState<Pos | null>(null)

  const rows = useMemo(() => matrixRows(features), [features])
  const cols = useMemo(() => matrixCols(competitors), [competitors])
  const cells = useMemo(() => new Map(comparisons.map((c) => [c.id, c])), [comparisons])
  const cellAt = (r: number, c: number) => cells.get(cellId(rows[r].id, cols[c].id))

  const sel = selected && selected.row < rows.length && selected.col < cols.length ? selected : null

  // Your selected cell is what others see you on here (D-068); leaving the matrix hands back the item selection.
  const selCell = sel ? cellId(rows[sel.row].id, cols[sel.col].id) : null
  useEffect(() => {
    const { selectedId, selection } = useCanvas.getState()
    setPresenceSelection(selCell ?? selectedId, selCell ? [] : selection)
  }, [selCell])
  useEffect(() => () => setPresenceSelection(useCanvas.getState().selectedId, useCanvas.getState().selection), [])

  const setCoverage = (pos: Pos, coverage: Coverage | undefined) =>
    void setCell(wid, rows[pos.row].id, cols[pos.col].id, { coverage })

  // Arrows move, 1–4 set coverage, 0 / Backspace clears, Escape closes.
  useEffect(() => {
    if (!sel) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select')) return
      const move = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]
      if (move) {
        e.preventDefault()
        const row = Math.min(rows.length - 1, Math.max(0, sel.row + move[0]))
        const col = Math.min(cols.length - 1, Math.max(0, sel.col + move[1]))
        setSelected({ row, col })
        document.getElementById(`cell-${row}-${col}`)?.focus()
      } else if (/^[1-4]$/.test(e.key)) {
        setCoverage(sel, COVERAGES[Number(e.key) - 1])
      } else if (e.key === '0' || e.key === 'Backspace') {
        setCoverage(sel, undefined)
      } else if (e.key === 'Escape') {
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, rows, cols])

  if (rows.length === 0 || cols.length === 0) {
    return (
      <main className={styles.page}>
        <div className={styles.emptyState}>
          <DecodeText text="The matrix compares your features with your competitors" />
          <p className={styles.emptyHint}>
            <Link to={workspacePath(wid)}>
              add {rows.length === 0 && 'a feature'}
              {rows.length === 0 && cols.length === 0 && ' and '}
              {cols.length === 0 && 'a competitor'}
            </Link>
            {' on the board to start.'}
          </p>
        </div>
      </main>
    )
  }

  // Out of the features this competitor is comparable on (D-136).
  const coveredIn = (c: number) =>
    rows.filter((f, r) => {
      const v = coverageOf(cellAt(r, c), f)
      return relevant(cellAt(r, c)) && (v === 'full' || v === 'better')
    }).length
  const comparableIn = (c: number) => rows.filter((_, r) => relevant(cellAt(r, c))).length

  return (
    <main className={styles.page}>
      <Appear className={styles.frame}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.featureHead}>our features</th>
              <th className={styles.metaHead}>pri</th>
              <th className={styles.metaHead}>status</th>
              {cols.map((c) => (
                <th key={c.id} className={styles.compHead} data-mark={marks.get(c.id)} data-mark-id={marks.has(c.id) ? c.id : undefined} {...markHoverOf(c.id, marks.get(c.id))}>
                  <Link to={itemPath(wid, c.id)} title={c.name}>
                    {c.name || 'Untitled'}
                  </Link>
                  <MarkOn id={c.id} className={styles.headMark} />
                  <PeersOn id={c.id} className={styles.headPeers} max={2} />
                </th>
              ))}
              <th className={styles.verdictHead}>reading</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f, r) => {
              const mine = cols.map((_, c) => cellAt(r, c))
              const v = verdict(mine, f)
              const open = openCriteria(f, mine)
              return (
                <tr key={f.id} data-selected={sel?.row === r}>
                  <th scope="row" className={styles.feature} data-mark={marks.get(f.id)} data-mark-id={marks.has(f.id) ? f.id : undefined} {...markHoverOf(f.id, marks.get(f.id))}>
                    <Link to={itemPath(wid, f.id)}>{f.title || 'Untitled'}</Link> <MarkOn id={f.id} /> <PeersOn id={f.id} />
                  </th>
                  <td className={styles.meta}>{f.priority ?? ''}</td>
                  <td className={styles.meta}>{f.status ?? ''}</td>
                  {cols.map((c, col) => {
                    const cell = cellAt(r, col)
                    const out = !relevant(cell)
                    const cov = out ? undefined : coverageOf(cell, f)
                    const scores = out ? null : scoresOf(cell, f)
                    const isSel = sel?.row === r && sel.col === col
                    return (
                      <td key={c.id} className={styles.cellTd} data-col-selected={sel?.col === col}>
                        <button
                          id={`cell-${r}-${col}`}
                          className={styles.cell}
                          data-selected={isSel}
                          style={cov ? { ['--tone' as string]: TONE[cov] } : undefined}
                          aria-label={`${f.title || 'Untitled'} at ${c.name || 'Untitled'}: ${out ? 'not relevant' : (cov ?? 'not assessed')}${scores ? `, ${metOf(scores)}` : ''}${cell?.confidence ? `, ${cell.confidence}` : ''}`}
                          title={cell?.notes ? clip(cell.notes) : undefined}
                          // Scored cells read from their criteria, and a cell left out has none: clicking only selects (D-133, D-136).
                          onClick={() => (isSel && !scores && !out ? setCoverage({ row: r, col }, next(cell?.coverage)) : setSelected({ row: r, col }))}
                        >
                          {out ? (
                            <span className={styles.out}>—</span>
                          ) : scores ? (
                            <ScoreBar scores={scores} />
                          ) : (
                            <span className={styles.glyph}>{GLYPH[cov ?? 'unset']}</span>
                          )}
                          {cell?.notes && <span className={styles.noted} aria-hidden />}
                          {!out && cell?.confidence && CONFIDENCE_MARK[cell.confidence] && (
                            <span className={styles.sure} aria-hidden>
                              {CONFIDENCE_MARK[cell.confidence]}
                            </span>
                          )}
                          <CellMark id={cellId(f.id, c.id)} />
                          <CellPeers id={cellId(f.id, c.id)} />
                        </button>
                      </td>
                    )
                  })}
                  <td className={styles.verdict}>
                    {v && (
                      <span style={{ color: v.tone }} title={v.title}>
                        {v.label}
                      </span>
                    )}
                    {open && open.length > 0 && (
                      <span className={styles.open} title={`Nobody meets: ${open.map((k) => k.text).join(' · ')}`}>
                        ◇ {open.length} open
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th className={styles.footHead} colSpan={3}>
                fully covered
              </th>
              {cols.map((c, col) => (
                <td key={c.id} className={styles.footCount}>
                  {coveredIn(col)}/{comparableIn(col)}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </Appear>

      <footer className={styles.legend}>
        {(['unset', ...COVERAGES] as const).map((k) => (
          <span key={k} style={k !== 'unset' ? { color: TONE[k] } : undefined}>
            {GLYPH[k]} <span className={styles.legendLabel}>{k === 'unset' ? 'not assessed' : k}</span>
          </span>
        ))}
        <span>
          — <span className={styles.legendLabel}>not relevant</span>
        </span>
        <span>
          ~ <span className={styles.legendLabel}>inferred</span> ? <span className={styles.legendLabel}>a guess</span>
        </span>
        <span className={styles.legendBar}>
          <ScoreBar scores={['met', 'part', 'no', undefined]} /> <span className={styles.legendLabel}>criteria: met · part · no · not assessed</span>
        </span>
        <span className={styles.hints} data-preview-hide>click: select · click again or 1–4: coverage · 0: clear · arrows: move</span>
      </footer>

      <AnimatePresence>
        {sel && (
          <CellPanel
            key="cell"
            feature={rows[sel.row]}
            competitorId={cols[sel.col].id}
            competitorName={cols[sel.col].name}
            cell={cellAt(sel.row, sel.col)}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </main>
  )
}

const NO_MARKS = new Map<string, never>()
const NOT_RELEVANT = ['not relevant'] as const

// How sure a cell is, in its corner (D-136): documented needs no mark.
const CONFIDENCE_MARK: Record<Confidence, string> = { documented: '', inferred: '~', guess: '?' }

const clip = (s: string) => (s.length > 400 ? `${s.slice(0, 400)}…` : s)
const metOf = (scores: (CriterionScore | undefined)[]) => `${scores.filter((s) => s === 'met').length} of ${scores.length} criteria met`

// One block per criterion, in the feature's order (D-133): met cyan, part yellow, no a dim outline, not assessed a dot.
function ScoreBar({ scores }: { scores: (CriterionScore | undefined)[] }) {
  return (
    <span className={styles.bar} aria-hidden>
      {scores.map((s, i) => (
        <span key={i} className={styles.block} data-score={s ?? 'unset'} style={s ? { ['--tone' as string]: SCORE_TONE[s] } : undefined} />
      ))}
    </span>
  )
}

// A cell the assistant's preview changes (D-096): a ring and its diff sign inside, and an edit's old coverage before the
// new one (`○→◐`; a struck circle would read as another glyph).
function CellMark({ id }: { id: string }) {
  const { mark, before, lit } = useMarkOf(id)
  if (!mark) return null
  const was = before && 'coverage' in before ? GLYPH[(before.coverage as keyof typeof GLYPH | undefined) ?? 'unset'] : null
  return (
    <span className={styles.cellMark} data-mark-id={id} style={{ boxShadow: markRing(mark, lit, true) }} {...markHoverOf(id, mark)}>
      {/* With the old value beside it there's no room for the sign too; the ring's colour already says edited. */}
      {!was && <MarkOn id={id} className={styles.cellSign} />}
      {was && (
        <span className={styles.cellWas} title="before">
          {was}→
        </span>
      )}
    </span>
  )
}

function CellPanel({
  feature,
  competitorId,
  competitorName,
  cell,
  onClose,
}: {
  feature: WithId<Feature>
  competitorId: string
  competitorName: string
  cell: Comparison | undefined
  onClose: () => void
}) {
  const { wid, competitorFeatures } = useWs()
  const theirs = competitorFeatures.filter((f) => f.competitorId === competitorId)
  const set = (fields: Parameters<typeof setCell>[3]) => void setCell(wid, feature.id, competitorId, fields)
  const hasCriteria = (feature.criteria?.length ?? 0) > 0
  // Writing a feature's first criteria keeps the list open for the next one, until `done`.
  const [editing, setEditing] = useState(!hasCriteria)
  useEffect(() => {
    if (!hasCriteria) setEditing(true)
  }, [hasCriteria])
  const scores = scoresOf(cell, feature)
  const out = !relevant(cell)

  return (
    <Appear as="aside" className={styles.panel} data-side-panel="narrow" aria-label="Cell details">
      <header className={styles.panelHead}>
        <span className={styles.kicker}>cell</span>
        <button className={styles.close} onClick={onClose} aria-label="Close panel">
          [×]
        </button>
      </header>
      <h2 className={styles.panelTitle}>
        {feature.title || 'Untitled'}
        <span className={styles.times}> × </span>
        {competitorName || 'Untitled'}
      </h2>

      {/* Not comparable at all: left out of the row's reading, the counts and the white space (D-136). */}
      <Choice
        label="compare"
        options={NOT_RELEVANT}
        value={out ? 'not relevant' : undefined}
        onChange={(v) => set({ notRelevant: v ? true : undefined })}
      />
      {out ? (
        <p className={styles.outHint}>
          They don't do this kind of thing at all, so this cell is left out of the reading and the counts. Use none when they
          could and don't.
        </p>
      ) : (
        <>
        {scores ? (
          <div className={styles.derived}>
            <span className={styles.fieldLabel}>coverage</span>
            <span style={{ color: TONE[coverageOf(cell, feature)!] }}>{coverageOf(cell, feature)}</span>
            <span className={styles.derivedHint}>{metOf(scores)}</span>
          </div>
        ) : (
          <Choice label="coverage" options={COVERAGES} value={cell?.coverage} onChange={(coverage) => set({ coverage })} tones={TONE} />
        )}

        {/* What the feature must do, and how they do on each (D-133). */}
        <div className={styles.field}>
          <span className={styles.criteriaHead}>
            <span className={styles.fieldLabel}>{editing || !hasCriteria ? 'criteria of this feature' : 'criteria'}</span>
            {hasCriteria && (
              <button className={styles.edit} onClick={() => setEditing(!editing)}>
                {editing ? 'done' : 'edit'}
              </button>
            )}
          </span>
          {editing || !hasCriteria ? (
            <CriteriaEditor feature={feature} bare />
          ) : (
            <CriterionScores feature={feature} competitorId={competitorId} cell={cell} />
          )}
        </div>

          <Choice label="sure" options={CONFIDENCES} value={cell?.confidence} onChange={(confidence) => set({ confidence })} />
        </>
      )}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>their version</span>
        <Select
          className={styles.select}
          ariaLabel="Their version"
          value={cell?.competitorFeatureId ?? ''}
          options={[
            { value: '', label: theirs.length ? '— none —' : 'no features listed yet' },
            ...theirs.map((f) => ({ value: f.id, label: `${f.category ? `${f.category} · ` : ''}${f.name || 'Untitled'}` })),
          ]}
          onChange={(v) => set({ competitorFeatureId: v || undefined })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>notes</span>
        <AutosaveField
          key={`${feature.id}_${competitorId}`}
          className={styles.textarea}
          label="Notes"
          placeholder="How they do it, and how well"
          value={cell?.notes ?? ''}
          onSave={(notes) => set({ notes: notes.trim() ? notes : undefined })}
          multiline
          rows={6}
        />
      </label>
    </Appear>
  )
}
