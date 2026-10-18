// A line that says something is on its way (D-098): the quarter-block glyph turning (▖ ▘ ▝ ▗, like the loading curtain
// and the assistant's steps) and what's loading. Still under reduced motion.
import { useEffect, useState } from 'react'
import { isReducedMotion } from '../state/motion'
import styles from './Loading.module.css'

const FRAMES = '▖▘▝▗'

export function Loading({ label, className }: { label: string; className?: string }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (isReducedMotion()) return
    const id = window.setInterval(() => setI((n) => (n + 1) % FRAMES.length), 120)
    return () => window.clearInterval(id)
  }, [])
  return (
    <p className={[styles.loading, className].filter(Boolean).join(' ')} role="status">
      <span className={styles.glyph} aria-hidden>
        {FRAMES[i]}
      </span>
      {label}
    </p>
  )
}
