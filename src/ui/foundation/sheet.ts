// The main screen as a sheet (D-387, docs/specs/surfaces.md): a column docked to an edge (EdgeColumn) lies on the
// ground under the screen, and while one is there the screen lifts, goes round and draws back from it. The columns say
// they're there (`useSheetColumn`); this measures them, keeps the two layers that draw the sheet (Sheet.module.css)
// and tells the page how far the sheet has moved, as custom properties on the root:
//   --sheet-x0, --sheet-x1   how far the sheet's left and right edges are from the window's: a column's reach on
//                            its side, the gap on the other; 0 with no column
//   --sheet-b                how far its top and foot are from the window's (the gap; 0 with no column)
// The layers outlive the columns: when the last one leaves, the sheet still has to travel back.
import { useLayoutEffect, type RefObject } from 'react'
import { isReducedMotion } from '../../state/motion'
import { tokenPx } from '../../styles/cssToken'
import styles from './Sheet.module.css'

type Side = 'right' | 'left'

const columns = new Map<HTMLElement, Side>()
let layers: [HTMLElement, HTMLElement] | null = null

function make(): [HTMLElement, HTMLElement] {
  const ground = document.createElement('div')
  const rim = document.createElement('div')
  ground.className = styles.ground
  rim.className = styles.rim
  for (const el of [ground, rim]) el.setAttribute('aria-hidden', 'true')
  // The ground first in the page: a column of its layer, portalled in after it, is over it.
  document.body.prepend(ground)
  document.body.append(rim)
  return [ground, rim]
}

function measure() {
  let right = 0
  let left = 0
  for (const [el, side] of columns) {
    const r = el.getBoundingClientRect()
    if (side === 'right') right = Math.max(right, window.innerWidth - r.left)
    else left = Math.max(left, r.right)
  }
  const open = columns.size > 0
  const gap = open ? tokenPx('--sheet-gap') : 0
  const root = document.documentElement.style
  root.setProperty('--sheet-x0', `${left || gap}px`)
  root.setProperty('--sheet-x1', `${right || gap}px`)
  root.setProperty('--sheet-b', `${gap}px`)
  if (!open && !layers) return
  layers ??= make()
  for (const el of layers) {
    el.toggleAttribute('data-reduced', isReducedMotion())
    el.toggleAttribute('data-open', open)
  }
}

const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
if (typeof window !== 'undefined') window.addEventListener('resize', measure)

// A docked column is on the ground while `present` (false as soon as it starts leaving, so the sheet comes back as it
// breaks apart, not after).
export function useSheetColumn(ref: RefObject<HTMLElement | null>, side: Side, present = true) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !present) return
    columns.set(el, side)
    watch?.observe(el)
    measure()
    return () => {
      columns.delete(el)
      watch?.unobserve(el)
      measure()
    }
  }, [ref, side, present])
}
