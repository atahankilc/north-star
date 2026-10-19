// /workspaces/:wid/priorities (D-138): our features on impact × effort, each with how sure we are of it (from its
// chain's status, reading.ts), and beside it the order impact × confidence ÷ effort suggests next to the priority set.
// Clicking a feature opens its panel, where impact and effort are set.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { workspacePath } from '../../app/paths'
import { FEATURE_EFFORTS, FEATURE_IMPACTS } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { Appear } from '../../ui/Appear'
import { DecodeText } from '../../ui/DecodeText'
import { useBoardItems } from '../canvas/boardKinds'
import { DetailPanel } from '../canvas/DetailPanel'
import { useWs } from '../workspace/context'
import styles from './PrioritiesView.module.css'
import { PlaneFilter } from '../canvas/PlaneSwitcher'
import { planeIds, useViewPlane } from '../canvas/planes'
import { ranked, type Ranked } from './reading'
import { Sure } from './Sure'

const IMPACT_ROWS = [...FEATURE_IMPACTS].reverse()
// The four corners have names; the middle doesn't need one.
const CORNER: Record<string, string> = { 'high S': 'quick wins', 'high L': 'big bets', 'low S': 'fill-ins', 'low L': 'money pits' }
const EFFORT_WORD: Record<string, string> = { S: 'small', M: 'medium', L: 'large' }

export function PrioritiesView() {
  const ws = useWs()
  const all = useBoardItems()
  // With a plane filter (D-143): the features and packages on it.
  const plane = useViewPlane(ws)
  const list = useMemo(() => ranked(ws, planeIds(ws, plane)), [ws, plane])
  const rated = list.filter((r) => r.score !== null)
  const unrated = list.filter((r) => r.score === null)

  if (!ws.features.length) {
    return (
      <main className={styles.page}>
        <div className={styles.emptyState}>
          <DecodeText text="Priorities rank your features by impact, confidence and effort" />
          <p className={styles.emptyHint}>
            <Link to={workspacePath(ws.wid)}>add a feature</Link> on the board to start.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className={styles.columns}>
        <Appear className={styles.frame}>
          <div className={styles.grid} role="grid" aria-label="Features by impact and effort">
            <span className={styles.corner}>impact · effort</span>
            {FEATURE_EFFORTS.map((e) => (
              <span key={e} className={styles.colHead}>
                {e} <span className={styles.dim}>{EFFORT_WORD[e]}</span>
              </span>
            ))}
            {IMPACT_ROWS.map((impact) => (
              <Row key={impact} impact={impact} rated={rated} />
            ))}
          </div>
          {unrated.length > 0 && (
            <div className={styles.unrated}>
              <span className={styles.label}>not rated yet · {unrated.length}</span>
              <span className={styles.hint}>Set impact and effort in a feature's panel to place it.</span>
              <div className={styles.chips}>
                {unrated.map((r) => (
                  <Chip key={r.feature.id} r={r} />
                ))}
              </div>
            </div>
          )}
        </Appear>

        <Appear className={styles.frame}>
          <div className={styles.order}>
            <span className={styles.label}>suggested order</span>
            <span className={styles.hint}>Impact × confidence ÷ effort. Confidence comes from the status of what each feature rests on.</span>
            {rated.length ? (
              <ol className={styles.ranks}>
                {rated.map((r, i) => (
                  <RankRow key={r.feature.id} r={r} n={i + 1} />
                ))}
              </ol>
            ) : (
              <span className={styles.hint}>Nothing rated yet.</span>
            )}
          </div>
        </Appear>
      </div>

      <footer className={styles.legend}>
        <PlaneFilter up />
        <span>
          <Sure level="high" /> <span className={styles.dim}>confidence: high</span>
        </span>
        <span>
          <Sure level="medium" /> <span className={styles.dim}>medium</span>
        </span>
        <span>
          <Sure level="low" /> <span className={styles.dim}>low</span>
        </span>
        <span>
          ! <span className={styles.dim}>rests on something shown wrong</span>
        </span>
      </footer>

      <DetailPanel items={all} />
    </main>
  )
}

function Row({ impact, rated }: { impact: string; rated: Ranked[] }) {
  return (
    <>
      <span className={styles.rowHead}>{impact}</span>
      {FEATURE_EFFORTS.map((effort) => {
        const here = rated.filter((r) => r.feature.impact === impact && r.feature.effort === effort)
        const name = CORNER[`${impact} ${effort}`]
        return (
          <div key={effort} className={styles.cell} data-corner={name ? name.replace(' ', '-') : undefined} role="gridcell">
            {name && <span className={styles.cellName}>{name}</span>}
            {here.map((r) => (
              <Chip key={r.feature.id} r={r} />
            ))}
          </div>
        )
      })}
    </>
  )
}

function Chip({ r }: { r: Ranked }) {
  const selected = useCanvas((s) => s.selectedId === r.feature.id)
  const { level, why, invalidated } = r.confidence
  return (
    <button
      className={styles.chip}
      data-pkg={r.pkg}
      data-selected={selected}
      title={why}
      onClick={() => useCanvas.getState().select(selected ? null : r.feature.id)}
    >
      <span className={styles.chipTitle}>
        {r.pkg && <span className={styles.pkg}>package · </span>}
        {r.feature.title || 'Untitled'}
      </span>
      <span className={styles.chipMeta}>
        <Sure level={level} />
        {invalidated.length > 0 && <span className={styles.warn}>!</span>}
        {r.feature.priority && <span>{r.feature.priority}</span>}
      </span>
    </button>
  )
}

// Set and suggested priority side by side; a difference is lit.
function RankRow({ r, n }: { r: Ranked; n: number }) {
  const selected = useCanvas((s) => s.selectedId === r.feature.id)
  const differs = r.feature.priority && r.feature.priority !== r.suggested
  return (
    <li>
      <button className={styles.rank} data-selected={selected} title={r.confidence.why} onClick={() => useCanvas.getState().select(selected ? null : r.feature.id)}>
        <span className={styles.n}>{n}</span>
        <span className={styles.rankTitle}>
          {r.pkg && <span className={styles.pkg}>package · </span>}
          {r.feature.title || 'Untitled'}
        </span>
        <Sure level={r.confidence.level} />
        <span className={styles.score}>{r.score!.toFixed(1)}</span>
        <span className={styles.pri} data-differs={!!differs}>
          {r.feature.priority ?? '—'}
          {differs && <span title={`Suggested ${r.suggested}`}> → {r.suggested}</span>}
          {!r.feature.priority && <span className={styles.dim}> ({r.suggested})</span>}
        </span>
      </button>
    </li>
  )
}
