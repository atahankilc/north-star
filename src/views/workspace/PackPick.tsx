// Picking a package's cards (D-240), as a section is drawn (D-188): the side nav's `+` → package in a focused plane;
// clicks put cards in or out, a drag on the plane boxes them in; a strip over the focus dock says how many and makes it
// (`[package N]` or Enter), Escape stops. Whatever was selected when it began is picked to start.
import { useEffect } from 'react'
import { useCanvasView } from '../../state/canvasView'
import { Appear } from '../../ui/Appear'
import type { Card } from '../../data/cards'
import { useWs } from './context'
import { packageThese, setSelection } from './selection'
import styles from './PackPick.module.css'

export function PackPick({ cards }: { cards: Card[] }) {
  const { wid, cards: every } = useWs()
  const multi = useCanvasView((s) => s.cardMulti)
  const one = useCanvasView((s) => s.cardSelected)
  const ids = multi.length ? multi : one ? [one] : []
  const picked = cards.filter((c) => ids.includes(c.id) && c.type !== 'package')
  const stop = () => useCanvasView.setState({ packing: null })
  const make = () => {
    if (!picked.length) return
    stop()
    setSelection([packageThese(wid, picked, every)])
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable=true]')) return
      if (e.key !== 'Escape' && e.key !== 'Enter') return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.key === 'Escape') stop()
      else make()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })
  // Leaving the plane stops it (checked a moment later: strict mode mounts it twice).
  useEffect(() => () => void setTimeout(() => !document.querySelector('[data-packing]') && stop()), [])
  return (
    <Appear className={styles.strip} role="group" aria-label="Pick a package's cards">
      <span className={styles.kind}>package</span>
      <span>{picked.length ? `${picked.length} picked` : 'click cards or drag a box round them'}</span>
      <button className={styles.make} disabled={!picked.length} onClick={make}>
        package {picked.length || ''}
      </button>
      <button className={styles.stop} onClick={stop}>
        cancel
      </button>
      <span className={styles.esc}>esc</span>
    </Appear>
  )
}
