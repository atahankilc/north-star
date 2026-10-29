// A nudge (D-315, docs/specs/onboarding.md §4.5): one line by the tool it points at (`── ⌘F finds anything · ×`), at
// most one a session, retired by doing the thing. Not a dialog: it never takes focus; a short magenta lead to its
// anchor's right; no anchor: low in the middle.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Appear } from '../ui/Appear'
import { findAnchor } from './Lesson'
import { Btn, stopCanvas, Words } from './Pages'
import { fill, type Fill } from './words'
import styles from './Coach.module.css'

export function Nudge({ line, anchor, names, onClose }: { line: string; anchor?: string; names: Fill; onClose: () => void }) {
  const el = useRef<HTMLElement>(null)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  // Placed again when the window changes size.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const on = () => setTick((n) => n + 1)
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  useLayoutEffect(() => {
    const a = findAnchor(anchor)
    const h = el.current?.offsetHeight ?? 20
    const w = el.current?.offsetWidth ?? 240
    if (a) {
      const r = a.getBoundingClientRect()
      // Right of the anchor, at its middle; when that runs off the screen, left of it.
      const right = r.right + 12
      setAt({ left: right + w < innerWidth - 16 ? right : Math.max(16, r.left - 12 - w), top: Math.round(r.top + r.height / 2 - h / 2) })
    } else setAt({ left: Math.round((innerWidth - w) / 2), top: innerHeight - 96 })
  }, [anchor, line, tick])
  return createPortal(
    <Appear
      as="div"
      elRef={el}
      className={styles.nudge}
      data-coach
      style={at ?? { left: -9999, top: 0, visibility: 'hidden' }}
      role="status"
      aria-live="polite"
      {...stopCanvas}
    >
      <span className={styles.nudgeLead} aria-hidden />
      <span className={styles.nudgeTxt}>
        <Words text={fill(line, names)} />
      </span>
      <span aria-hidden>·</span>
      <Btn bare tone="out" onClick={onClose} label="dismiss">
        ×
      </Btn>
    </Appear>,
    document.body,
  )
}
