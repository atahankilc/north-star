// One line at the bottom centre for what was just done, undone or redone (Q-013). Polite live region.
import { useEffect, useState } from 'react'
import { useHistory } from '../data/history'
import styles from './Toast.module.css'

const SHOW_MS = 2600

export function Toast() {
  const notice = useHistory((s) => s.notice)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!notice) return
    setVisible(true)
    const t = window.setTimeout(() => setVisible(false), SHOW_MS)
    return () => window.clearTimeout(t)
  }, [notice])

  return (
    <div className={styles.toast} data-visible={visible} role="status" aria-live="polite">
      {notice?.text}
    </div>
  )
}
