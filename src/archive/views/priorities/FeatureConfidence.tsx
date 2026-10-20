// A feature's confidence in its panel (D-138): not set by hand, read from what it rests on, with why.
import type { WithId } from '../../data/hooks'
import type { Feature } from '../../data/model'
import { useWs } from '../workspace/context'
import styles from './FeatureConfidence.module.css'
import { Sure } from './Sure'
import { confidenceOf } from './reading'

export function FeatureConfidence({ feature }: { feature: WithId<Feature> }) {
  const ws = useWs()
  const c = confidenceOf(feature, ws)
  return (
    <div className={styles.row}>
      <span className={styles.label}>confidence</span>
      <span className={styles.value}>
        <span className={styles.level}>
          <Sure level={c.level} /> {c.level}
        </span>
        <span className={styles.why} data-warn={c.invalidated.length > 0}>
          {c.why}
        </span>
      </span>
    </div>
  )
}
