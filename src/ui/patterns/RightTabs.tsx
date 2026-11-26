// The tabs of the right side's one column (D-435, foundation/rightColumn.ts), over the panel's own head: the thing's kind
// and `agent`. Nothing while only one of them is there.
import { bringFront, useRightColumn } from '../foundation/rightColumn'
import { Tabs } from '../primitives/Tabs'
import styles from './RightTabs.module.css'

export function RightTabs() {
  const { thing, agent, front } = useRightColumn()
  if (!thing || !agent) return null
  return (
    <div className={styles.row}>
      <Tabs
        look="segments"
        label="What the right column shows"
        value={front}
        onChange={bringFront}
        options={[
          { value: 'thing', label: thing },
          { value: 'agent', label: 'agent' },
        ]}
      />
    </div>
  )
}
