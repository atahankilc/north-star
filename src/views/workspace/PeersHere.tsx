// Inside an item's side panel: who else has this item open, and which field they're typing in (D-067).
// The field they're in gets an outline in their colour, so you can see it before your edits collide (LWW per field).
import { useEffect, useRef } from 'react'
import { usePresence, type Peer } from '../../data/presence'
import styles from './PeersHere.module.css'

export function PeersHere({ itemId }: { itemId: string }) {
  const peers = usePresence((s) => s.peers)
  const here = peers.filter((p) => p.sel === itemId || p.edit === itemId)
  const marker = useRef<HTMLDivElement>(null)

  // Outline the fields being typed in. Found by the same key the typist sent: data-field, label or placeholder.
  const typing = here.filter((p) => p.edit === itemId && p.field)
  const key = typing.map((p) => `${p.uid}:${p.field}:${p.color}`).join('|')
  useEffect(() => {
    const root = marker.current?.closest<HTMLElement>('[data-item]')
    if (!root) return
    const marked: HTMLElement[] = []
    for (const p of typing) {
      const el = fieldIn(root, p.field!)
      if (!el) continue
      el.style.setProperty('outline', `1px solid ${p.color}`)
      el.style.setProperty('outline-offset', '2px')
      marked.push(el)
    }
    return () => marked.forEach((el) => (el.style.removeProperty('outline'), el.style.removeProperty('outline-offset')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <div ref={marker} className={styles.here} aria-live="polite" hidden={here.length === 0}>
      {here.map((p) => (
        <span key={p.uid} className={styles.peer} style={{ ['--peer' as string]: p.color }}>
          {label(p, itemId)}
        </span>
      ))}
    </div>
  )
}

function label(p: Peer, itemId: string) {
  return p.edit === itemId && p.field ? `${p.name} ✎ ${p.field}` : `${p.name} is here`
}

function fieldIn(root: HTMLElement, field: string): HTMLElement | null {
  const controls = root.querySelectorAll<HTMLElement>('input, textarea, [contenteditable="true"]')
  for (const el of controls) {
    const k = el.dataset.field ?? el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? 'text'
    if (k.toLowerCase() === field) return el
  }
  return null
}
