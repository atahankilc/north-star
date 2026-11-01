// The one spinner (D-098, D-326): the quarter-block glyph turning in place, ▖ ▘ ▝ ▗, a step every DUR.snap; still on its
// first glyph under reduced motion. Loading's line, the curtain's and the agent's steps all draw this one; the caller's
// class gives its colour and size.
import { useEffect, useState } from 'react'
import { useMotion } from '../../state/motion'
import { DUR } from '../foundation/motionTokens'
import styles from './Spinner.module.css'

const FRAMES = '▖▘▝▗'

export function Spinner({ className }: { className?: string }) {
  const reduced = useMotion((s) => s.reduced)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduced) return setI(0)
    const id = window.setInterval(() => setI((n) => (n + 1) % FRAMES.length), DUR.snap)
    return () => window.clearInterval(id)
  }, [reduced])
  return (
    <span className={[styles.spinner, className].filter(Boolean).join(' ')} aria-hidden>
      {FRAMES[i]}
    </span>
  )
}
