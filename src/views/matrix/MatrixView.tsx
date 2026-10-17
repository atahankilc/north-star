// /workspaces/:wid/matrix: our features × competitors. Each cell says how well that competitor covers the
// feature; the last column reads the row as a whole (gap, table stakes, mixed).
import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { itemPath, workspacePath } from '../../app/paths'
import { cellId, setCell } from '../../data/comparisons'
import type { WithId } from '../../data/hooks'
import { COVERAGES, FEATURE_PRIORITIES, type Comparison, type Coverage, type Feature } from '../../data/model'
import { Appear } from '../../ui/Appear'
import { AutosaveField } from '../../ui/AutosaveField'
import { Choice } from '../../ui/Choice'
import { DecodeText } from '../../ui/DecodeText'
import { setPresenceSelection } from '../../data/presence'
import { useCanvas } from '../../state/canvasStore'
import { useWs } from '../workspace/context'
import { CellPeers, PeersOn } from '../workspace/PeerMarks'
import styles from './MatrixView.module.css'

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

type Verdict = { label: string; tone: string; title: string }

// Gap: nobody covers it (an opening). Table stakes: most competitors fully cover it.
function verdict(cells: (Comparison | undefined)[]): Verdict | null {
  const assessed = cells.filter((c) => c?.coverage)
  if (cells.length === 0 || assessed.length === 0) return null
  const covered = assessed.filter((c) => c!.coverage === 'full' || c!.coverage === 'better').length
  const some = assessed.filter((c) => c!.coverage !== 'none').length
  if (some === 0) return { label: 'gap', tone: 'var(--accent-green)', title: 'No competitor covers this: an opening' }
  if (covered * 2 >= cells.length)
    return { label: 'table stakes', tone: 'var(--accent-yellow)', title: 'Most competitors cover this fully' }
  return { label: 'mixed', tone: 'var(--fg-dim)', title: 'Some competitors cover this' }
}

const rank = (f: Feature) => {
  const p = FEATURE_PRIORITIES.indexOf(f.priority as (typeof FEATURE_PRIORITIES)[number])
  return p < 0 ? FEATURE_PRIORITIES.length : p
}

type Pos = { row: number; col: number }

export function MatrixView() {
  const { wid, features, competitors, comparisons } = useWs()
  const [selected, setSelected] = useState<Pos | null>(null)

  const rows = useMemo(() => [...features].sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt), [features])
  const cols = useMemo(() => [...competitors].sort((a, b) => a.createdAt - b.createdAt), [competitors])
  const cells = useMemo(() => new Map(comparisons.map((c) => [c.id, c])), [comparisons])
  const cellAt = (r: number, c: number) => cells.get(cellId(rows[r].id, cols[c].id))

  const sel = selected && selected.row < rows.length && selected.col < cols.length ? selected : null

  // Your selected cell is what others see you on here (D-068); leaving the matrix hands back the item selection.
  const selCell = sel ? cellId(rows[sel.row].id, cols[sel.col].id) : null
  useEffect(() => setPresenceSelection(selCell ?? useCanvas.getState().selectedId), [selCell])
  useEffect(() => () => setPresenceSelection(useCanvas.getState().selectedId), [])

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

  const coverageOf = (c: number) =>
    rows.filter((_, r) => {
      const v = cellAt(r, c)?.coverage
      return v === 'full' || v === 'better'
    }).length

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
                <th key={c.id} className={styles.compHead}>
                  <Link to={itemPath(wid, c.id)} title={c.name}>
                    {c.name || 'Untitled'}
                  </Link>
                  <PeersOn id={c.id} className={styles.headPeers} max={2} />
                </th>
              ))}
              <th className={styles.verdictHead}>reading</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f, r) => {
              const v = verdict(cols.map((_, c) => cellAt(r, c)))
              return (
                <tr key={f.id} data-selected={sel?.row === r}>
                  <th scope="row" className={styles.feature}>
                    <Link to={itemPath(wid, f.id)}>{f.title || 'Untitled'}</Link> <PeersOn id={f.id} />
                  </th>
                  <td className={styles.meta}>{f.priority ?? ''}</td>
                  <td className={styles.meta}>{f.status ?? ''}</td>
                  {cols.map((c, col) => {
                    const cell = cellAt(r, col)
                    const cov = cell?.coverage
                    const isSel = sel?.row === r && sel.col === col
                    return (
                      <td key={c.id} className={styles.cellTd} data-col-selected={sel?.col === col}>
                        <button
                          id={`cell-${r}-${col}`}
                          className={styles.cell}
                          data-selected={isSel}
                          style={cov ? { ['--tone' as string]: TONE[cov] } : undefined}
                          aria-label={`${f.title || 'Untitled'} at ${c.name || 'Untitled'}: ${cov ?? 'not assessed'}`}
                          onClick={() => (isSel ? setCoverage({ row: r, col }, next(cov)) : setSelected({ row: r, col }))}
                        >
                          <span className={styles.glyph}>{GLYPH[cov ?? 'unset']}</span>
                          {cell?.notes && <span className={styles.noted} aria-hidden />}
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
                  {coverageOf(col)}/{rows.length}
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
        <span className={styles.hints}>click: select · click again or 1–4: coverage · 0: clear · arrows: move</span>
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

  return (
    <Appear as="aside" className={styles.panel} aria-label="Cell details">
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

      <Choice
        label="coverage"
        options={COVERAGES}
        value={cell?.coverage}
        onChange={(coverage) => set({ coverage })}
        tones={TONE}
      />

      <label className={styles.field}>
        <span className={styles.fieldLabel}>their version</span>
        <select
          className={styles.select}
          value={cell?.competitorFeatureId ?? ''}
          onChange={(e) => set({ competitorFeatureId: e.target.value || undefined })}
        >
          <option value="">{theirs.length ? '— none —' : 'no features listed yet'}</option>
          {theirs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.category ? `${f.category} · ` : ''}
              {f.name || 'Untitled'}
            </option>
          ))}
        </select>
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
