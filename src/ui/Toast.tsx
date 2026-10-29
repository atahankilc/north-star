// One line at the bottom centre for what was just done, undone or redone (Q-013). Polite live region. With something to
// do from it (`[go there]`, D-302's session 2) it stays longer and takes that click.
import { useEffect, useState } from 'react'
import { useHistory } from '../data/history'
import styles from './Toast.module.css'

const SHOW_MS = 2600
const ACTION_MS = 6000

export function Toast() {
  const notice = useHistory((s) => s.notice)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!notice) return
    setVisible(true)
    const t = window.setTimeout(() => setVisible(false), notice.action ? ACTION_MS : SHOW_MS)
    return () => window.clearTimeout(t)
  }, [notice])

  return (
    <div className={styles.toast} data-visible={visible} role="status" aria-live="polite">
      {notice?.text}
      {notice?.action && (
        <button
          className={styles.action}
          tabIndex={visible ? 0 : -1}
          onClick={() => {
            setVisible(false)
            notice.action!.run()
          }}
        >
          {notice.action.label}
        </button>
      )}
    </div>
  )
}
