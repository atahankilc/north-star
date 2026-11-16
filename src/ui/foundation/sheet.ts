// The main screen as a sheet (D-387, docs/specs/surfaces.md): a column docked to an edge (EdgeColumn) lies on the
// ground under the screen, and while one is there the screen lifts, goes round and draws back from it. The columns say
// they're there (`useSheetColumn`); this measures them, keeps the two layers that draw the sheet (Sheet.module.css)
// and tells the page how far the sheet has moved, as custom properties on the root:
//   --sheet-x0, --sheet-x1   how far the sheet's left and right edges are from the window's: a column's reach on
//                            its side; on a side with none, the rail if the HUD has one there (below), else the gap;
//                            0 with no column
//   --sheet-b                how far its top and foot are from the window's (the gap; 0 with no column)
//   --sheet-rail             the rail's width while it shows, else 0
//   --sheet-round            the sheet's corner while it's lifted, else 0 (what sits on its foot keeps clear of it)
// The rail (D-389): the HUD's tools on the left edge stay where they are, and while a column is docked the sheet draws
// back off them too, so they're left on the ground beside it (`useSheetRail`, the HUD's).
// The layers outlive the columns: when the last one leaves, the sheet still has to travel back.
import { useLayoutEffect, type RefObject } from 'react'
import { isReducedMotion } from '../../state/motion'
import { tokenPx } from '../../styles/cssToken'
import styles from './Sheet.module.css'

type Side = 'right' | 'left'

const columns = new Map<HTMLElement, Side>()
let rails = 0
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
  // A column on the left that starts past the rail stands beside the HUD's tools (the threads' list, D-393); one from
  // the window's edge covers them, as it always did.
  const railW = tokenPx('--sheet-rail-w')
  let covered = false
  for (const [el, side] of columns) {
    const r = el.getBoundingClientRect()
    if (side === 'right') right = Math.max(right, window.innerWidth - r.left)
    else {
      left = Math.max(left, r.right)
      if (r.left < railW) covered = true
    }
  }
  const open = columns.size > 0
  const gap = open ? tokenPx('--sheet-gap') : 0
  const rail = open && rails > 0 && !covered ? railW : 0
  // Written only when it changes: the root's style is watched below, and a write that changed nothing must not call back.
  const style = document.documentElement.style
  const root = { setProperty: (name: string, value: string) => void (style.getPropertyValue(name) !== value && style.setProperty(name, value)) }
  root.setProperty('--sheet-x0', `${left || rail || gap}px`)
  root.setProperty('--sheet-x1', `${right || gap}px`)
  root.setProperty('--sheet-b', `${gap}px`)
  root.setProperty('--sheet-rail', `${rail}px`)
  root.setProperty('--sheet-round', `${open ? tokenPx('--radius-window') : 0}px`)
  if (!open && !layers) return
  layers ??= make()
  for (const el of layers) {
    el.toggleAttribute('data-reduced', isReducedMotion())
    el.toggleAttribute('data-open', open)
  }
}

const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
if (typeof window !== 'undefined') window.addEventListener('resize', measure)
// A column can move without changing size: the right panel steps aside as the agent's column opens and closes
// (`--ai-w`, set with `data-agent-open` on the root), and a dragged width is written on the root's style (D-378).
if (typeof MutationObserver !== 'undefined')
  new MutationObserver(() => columns.size && measure()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-agent-open', 'style'] })

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

// The HUD's tools on the left edge are there: a rail of ground is kept for them while a column is docked.
export function useSheetRail(on = true) {
  useLayoutEffect(() => {
    if (!on) return
    rails++
    measure()
    return () => {
      rails--
      measure()
    }
  }, [on])
}
