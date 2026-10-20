// A feature's criteria (D-133): what it must do to count. Written in the feature's panel or the matrix cell's; each
// matrix cell scores a competitor against them, so "partial" says which part, and the ones nobody meets are the white space.
import { useState } from 'react'
import { newCriterionId, setCriteria, setScore } from '../../data/comparisons'
import type { WithId } from '../../data/hooks'
import { CRITERION_SCORES, MAX_CRITERIA, type Comparison, type CriterionScore, type Feature } from '../../data/model'
import { AutosaveField } from '../../ui/AutosaveField'
import { Choice } from '../../ui/Choice'
import { useWs } from '../workspace/context'
import styles from './Criteria.module.css'

export const SCORE_TONE: Record<CriterionScore, string> = {
  met: 'var(--accent-cyan)',
  part: 'var(--accent-yellow)',
  no: 'var(--fg-dim)',
}

// The list, editable, each with how many competitors meet it ("open" when nobody does).
// `bare`: without its own label, where the panel already names it.
export function CriteriaEditor({ feature, bare }: { feature: WithId<Feature>; bare?: boolean }) {
  const { wid, comparisons } = useWs()
  const [draft, setDraft] = useState('')
  const list = feature.criteria ?? []
  const mine = comparisons.filter((c) => c.featureId === feature.id)
  const scored = mine.filter((c) => list.some((k) => c.criteria?.[k.id]))
  const write = (next: typeof list, key?: string) => void setCriteria(wid, feature.id, next, comparisons, key)

  const add = () => {
    const text = draft.trim()
    if (!text || list.length >= MAX_CRITERIA) return
    write([...list, { id: newCriterionId(), text }])
    setDraft('')
  }

  return (
    <div className={styles.editor}>
      {!bare && <span className={styles.label}>criteria</span>}
      {list.length > 0 && (
        <ol className={styles.list}>
          {list.map((k, i) => {
            const met = scored.filter((c) => c.criteria?.[k.id] === 'met').length
            return (
              <li key={k.id} className={styles.item}>
                <span className={styles.num}>{i + 1}</span>
                <AutosaveField
                  className={styles.text}
                  label={`Criterion ${i + 1}`}
                  value={k.text}
                  wrap
                  maxLength={200}
                  onSave={(text) => write(list.map((x) => (x.id === k.id ? { ...x, text } : x)), k.id)}
                />
                {scored.length > 0 && (
                  <span
                    className={styles.met}
                    data-open={met === 0}
                    title={met === 0 ? 'No competitor assessed meets this: white space' : `${met} of ${scored.length} assessed competitors meet this`}
                  >
                    {met === 0 ? '◇ open' : `met by ${met}`}
                  </span>
                )}
                <button className={styles.remove} onClick={() => write(list.filter((x) => x.id !== k.id))} aria-label={`Remove criterion ${i + 1}`}>
                  ×
                </button>
              </li>
            )
          })}
        </ol>
      )}
      {list.length < MAX_CRITERIA && (
        <input
          className={styles.add}
          aria-label="Add a criterion"
          placeholder={list.length ? '+ another criterion' : '+ what must it do? e.g. traces each request'}
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
        />
      )}
      <span className={styles.hint}>
        {list.length
          ? 'Score each competitor against these in the matrix: its cells then show which ones they meet.'
          : 'A few must-haves that define this feature. The matrix scores competitors against them, so partial says which part.'}
      </span>
    </div>
  )
}

// One cell's scores: met, part or no for each criterion; clicking the active one clears it.
export function CriterionScores({ feature, competitorId, cell }: { feature: WithId<Feature>; competitorId: string; cell: Comparison | undefined }) {
  const { wid } = useWs()
  return (
    <ol className={styles.scores}>
      {(feature.criteria ?? []).map((k, i) => (
        <li key={k.id} className={styles.score}>
          <span className={styles.scoreText}>
            <span className={styles.num}>{i + 1}</span>
            {k.text || 'Untitled'}
          </span>
          <Choice
            bare
            label={k.text || `Criterion ${i + 1}`}
            options={CRITERION_SCORES}
            value={cell?.criteria?.[k.id]}
            tones={SCORE_TONE}
            onChange={(score) => void setScore(wid, feature.id, competitorId, k.id, score)}
          />
        </li>
      ))}
    </ol>
  )
}
