// The main screen as a sheet (D-387, docs/specs/surfaces.md): a column docked to an edge (EdgeColumn) lies on the
// ground under the screen, and while one is there the screen lifts, goes round and draws back from it. The columns say
// they're there (`useSheetColumn`); this measures them, keeps the two layers that draw the sheet (Sheet.module.css)
// and tells what rides the sheet how far it has moved, as custom properties on every `[data-sheet]` element (below):
//   --sheet-x0, --sheet-x1   how far the sheet's left and right edges are from the window's: a column's reach on
//                            its side; on a side with none, the rail if the HUD has one there (below), else the gap;
//                            0 with no column
//   --sheet-b                how far its top and foot are from the window's (the gap; 0 with no column)
//   --sheet-rail             the rail's width while it shows, else 0
//   --sheet-round            the sheet's corner while it's lifted, else 0 (what sits on its foot keeps clear of it)
//   --sheet-cut              where the ground's paint starts from the window's left: the rail's width while the HUD's
//                            tools stand on it, so the ground never passes over them as the sheet travels
// The rail (D-389): the HUD's tools on the left edge stay where they are, and while a column is docked the sheet draws
// back off them too, so they're left on the ground beside it (`useSheetRail`, the HUD's).
// The layers outlive the columns: when the last one leaves, the sheet still has to travel back.
// Who reads them says so with `data-sheet`, and they are a rule for those, never on the root (pageValues.ts).
import { useLayoutEffect, type RefObject } from 'react'
import { isReducedMotion } from '../../state/motion'
import { DUR } from './motionTokens'
import { tokenPx } from '../../styles/cssToken'
import { pageValue, setPageValue } from './pageValues'
import styles from './Sheet.module.css'

type Side = 'right' | 'left'

const columns = new Map<HTMLElement, Side>()
let rails = 0
let layers: HTMLElement[] | null = null
// Kept while the sheet travels home: the tools it drew back off are still there.
let cut = 0
// How far the columns reach on each side now, and who hears it change (D-422: the canvas moves its view by half of the
// difference, so what was in the middle of the screen stays in the middle of what's left; no column covers it).
let leftWas = 0
let rightWas = 0
// Heard with each side's move and where the columns now reach (from the window's left and right edges).
type Move = (left: number, right: number, reach: { left: number; right: number }) => void
const moves = new Set<Move>()
export function onSheetMove(fn: Move) {
  moves.add(fn)
  return () => void moves.delete(fn)
}
// How far the columns reach now, from the window's left and right edges (the agent's page leaves the canvas its least
// beside what's docked on the left, D-424).
export const sheetReach = () => ({ left: leftWas, right: rightWas })

// The sheet's corner now, in px: 0 while it fills the window (the agent's tab keeps clear of it, as its CSS does).
export const sheetRound = () => parseFloat(pageValue('--sheet-round') ?? '') || 0

function make(): HTMLElement[] {
  const ground = document.createElement('div')
  const hole = document.createElement('div')
  const rim = document.createElement('div')
  ground.className = styles.ground
  hole.className = styles.hole
  rim.className = styles.rim
  ground.append(hole)
  for (const el of [ground, rim]) el.setAttribute('aria-hidden', 'true')
  for (const el of [ground, hole, rim]) el.setAttribute('data-sheet', '')
  // The ground first in the page: a column of its layer, portalled in after it, is over it.
  document.body.prepend(ground)
  document.body.append(rim)
  return [ground, hole, rim]
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
  // Read before anything is written: a token's first read works the page's style out.
  const round = open ? tokenPx('--radius-window') : 0
  const rail = open && rails > 0 && !covered ? railW : 0
  if (open) cut = rail
  else if (!layers?.[0].hasAttribute('data-open')) cut = rails > 0 ? railW : 0
  if (!open && !layers) {
    // Known before the first column: the layers are made with the cut where it will be.
    setPageValue('--sheet-cut', `${cut}px`)
    return
  }
  // Made before the first move is written, and laid out once at rest: made in the same step they'd start where they
  // end, and the sheet would jump there while everything on it travels.
  if (!layers) {
    layers = make()
    void layers[0].offsetWidth
  }
  setPageValue('--sheet-x0', `${left || rail || gap}px`)
  if (left !== leftWas || right !== rightWas) {
    const l = left - leftWas
    const r = right - rightWas
    leftWas = left
    rightWas = right
    for (const fn of moves) fn(l, r, { left, right })
  }
  setPageValue('--sheet-x1', `${right || gap}px`)
  setPageValue('--sheet-b', `${gap}px`)
  setPageValue('--sheet-rail', `${rail}px`)
  setPageValue('--sheet-round', `${round}px`)
  setPageValue('--sheet-cut', `${cut}px`)
  railGround(rail > 0)
  for (const el of layers) {
    el.toggleAttribute('data-reduced', isReducedMotion())
    el.toggleAttribute('data-open', open)
  }
}

// While the HUD's tools stand on the ground they read its colours (`data-rail-ground` on the root, tokens.css, D-421):
// at once as the sheet leaves them, and back only once it has come home over them.
let railTimer: ReturnType<typeof setTimeout> | undefined
function railGround(on: boolean) {
  clearTimeout(railTimer)
  const root = document.documentElement
  if (on || isReducedMotion()) root.toggleAttribute('data-rail-ground', on)
  else railTimer = setTimeout(() => root.removeAttribute('data-rail-ground'), DUR.slow)
}

const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
if (typeof window !== 'undefined') window.addEventListener('resize', measure)
// A column can move without changing size: the right panel steps aside as the agent's column opens and closes, and
// again once the app has narrowed for it (`data-agent-open`, then `data-agent-in`, on the root: Agent.tsx). A dragged
// width changes the column's own size, which `watch` sees.
if (typeof MutationObserver !== 'undefined')
  new MutationObserver(() => columns.size && measure()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-agent-open', 'data-agent-in'] })

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
