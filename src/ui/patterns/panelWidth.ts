// How wide the right panels are (D-378): one width for all of them, dragged from a panel's left edge and remembered in
// this browser. Written as `--panel-width` for the panels alone (pageValues.ts), so a drag restyles the panel and draws nothing; `--panel-w`, the
// token, stays the width to start from. Never so wide on this window that it covers the dock at the foot's middle. What
// keeps a card clear of the panel reads `sidePanelW()` when it moves.
import { PANEL_W } from '../foundation/feel'
import { tokenPx } from '../../styles/cssToken'
import { keepLocal, readLocal } from '../../state/local'
import { setPageValue } from '../foundation/pageValues'

const STORE = 'northstar.panel.width'

const widest = () => Math.max(tokenPx('--panel-w'), Math.min(PANEL_W.max, window.innerWidth / 2 - PANEL_W.dock))

// What the person asked for; what's shown is that as far as this window allows, and comes back if the window grows.
let wanted: number | null = null
let shown: number | null = null

function show() {
  if (wanted === null) return
  shown = Math.round(Math.min(widest(), wanted))
  setPageValue('--panel-width', `${shown}px`)
}

// No storage (a private window): the usual width.
const kept = Number(readLocal(STORE))
if (kept >= PANEL_W.min && kept <= PANEL_W.max) ((wanted = kept), show())
window.addEventListener('resize', show)

export const sidePanelW = () => shown ?? tokenPx('--panel-w')

// `edge`: the screen x of the panel's right edge; the pointer at `x` is its left.
export function dragPanelWidth(edge: number, x: number) {
  wanted = Math.min(widest(), Math.max(PANEL_W.min, edge - x))
  show()
}

export function keepPanelWidth() {
  if (wanted !== null) keepLocal(STORE, String(Math.round(wanted)))
}
