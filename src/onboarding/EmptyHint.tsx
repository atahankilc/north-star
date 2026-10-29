// A teaching empty state (D-315, docs/specs/onboarding.md §4.1, §4.7): faint words on the canvas, not a modal; never
// pressed (the canvas under it keeps working). The empty canvas: `press + to add your first piece` at the `+`'s height,
// a straight dashed arrow to the `+` (`[data-learn="plus"]`); gone at the first piece. An empty plane or timeline in
// focus: its line in the middle of the screen (or of its piece), no arrow.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Appear } from '../ui/Appear'
import { findAnchor } from './Lesson'
import styles from './Coach.module.css'

// The line, its `+` in magenta (the side nav's `+`).
function Line({ text }: { text: string }) {
  const parts = text.split('+')
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className={styles.plus}>+</span>}
          {p}
        </span>
      ))}
    </>
  )
}

export function EmptyHint({ line, toward, anchor }: { line: string; toward?: string; anchor?: string }) {
  const el = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ x: number; y: number; arrow: { x1: number; x2: number } | null } | null>(null)
  // Placed again when the window changes size.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const on = () => setTick((n) => n + 1)
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  useLayoutEffect(() => {
    const w = el.current?.offsetWidth ?? 300
    const plus = toward ? findAnchor(toward) : null
    if (plus) {
      const r = plus.getBoundingClientRect()
      const y = r.top + r.height / 2
      // The words at the screen's middle (clear of the side nav), the arrow from them straight to the `+`.
      const x = Math.max(r.right + 160, Math.round(innerWidth / 2 - w / 2))
      setAt({ x, y, arrow: { x1: r.right + 12, x2: x - 16 } })
      return
    }
    const box = anchor ? findAnchor(anchor)?.getBoundingClientRect() : null
    const cx = box ? box.left + box.width / 2 : innerWidth / 2
    const cy = box ? box.top + box.height / 2 : innerHeight / 2
    setAt({ x: Math.round(cx - w / 2), y: Math.round(cy), arrow: null })
  }, [line, toward, anchor, tick])
  return createPortal(
    <>
      {at?.arrow && (
        <Appear as="div" className={styles.arrow} style={{ left: at.arrow.x1, top: Math.round(at.y), width: Math.max(0, at.arrow.x2 - at.arrow.x1) }} aria-hidden>
          <span className={styles.arrowHead} />
        </Appear>
      )}
      <Appear as="div" elRef={el} className={styles.empty} data-coach style={at ? { left: at.x, top: at.y } : { left: -9999, top: 0, visibility: 'hidden' }} role="note">
        <Line text={line} />
      </Appear>
    </>,
    document.body,
  )
}
