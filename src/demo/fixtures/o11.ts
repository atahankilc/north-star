// What O11's scenes share (D-315, onboarding-lessons.md §4 text, §5 matrix and table): a wizard opened and laid out to
// read in the lesson's small slot, Pazar's matrix and table as pieces in focus, and CSS for what a scene draws in the
// body (a wizard, a menu: portals, outside the stage's `[data-scene]`). Kept apart from kit.ts (O9's) and o10.ts (O10's).
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import type { Cell, MatrixSetup } from '../../data/matrix'
import { useMatrixUi } from '../../views/workspace/Matrix'
import { useTableUi } from '../../views/workspace/Table'
import { useCanvasView } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { CHIP_MS, key, run, type Action, type Ctx } from '../director'
import { base } from './kit'
import { P } from './pazar'

// CSS for this scene only, also over what the page puts in the body: `&` is the page while this scene is on the stage
// (put in once; the tree is made again each loop, the style stays; another scene in the same frame doesn't match it).
export const pageStyle = (scene: string, css: string): Action =>
  run(() => {
    const id = `demo-o11-${scene}`
    if (document.getElementById(id)) return
    const st = document.createElement('style')
    st.id = id
    st.textContent = css.replaceAll('&', `html:has([data-scene="${scene}"])`)
    document.head.appendChild(st)
  }, 'scene css')

// The stage without the HUD (the breadcrumb's bar, the side nav, the corner: the app's top <header>), as kit's bare()
// but only that header: a setup panel's own <header> (its tabs) stays.
export const NO_HUD = '& [data-scene] [data-app] > header { display: none !important; }'

// Nothing selected or being typed (the canvas's store outlives the stage: a loop's last selection would be in its first
// frame).
export const fresh = (): Action => run(() => useCanvasView.setState({ cardSelected: null, cardMulti: [], labelSelected: null, labelEditing: null, fresh: null, linkSelected: null, drawing: null }), 'nothing selected')

// The focus dock hidden (the matrix scenes don't use it, and it would cover their last rows; its entrance builds on the
// real clock, so the first frame wasn't the same each time).
export const NO_DOCK = '& [data-learn="dock"] { visibility: hidden !important; }'

// A wizard laid out for a small stage: the whole stage, no dimmed margin, the preview a little narrower, so its words
// read in the lesson's slot (~246 px wide) as the app's own wizard, not a shrunk picture of it.
export const wizardCss = `
  & [data-learn="wizard"] { width: 100%; min-height: 100%; height: 100%; border: 0; }
  & body > div:has(> [data-learn="wizard"]) { padding: 0; }
  & [data-learn="wizard"] > div:nth-child(2) { grid-template-columns: minmax(0, 1fr) 230px; overflow: hidden; }
  & [data-learn="wizard"] [aria-label="Preview"] { padding: var(--space-3); }
  & [data-learn="wizard"] [role="tab"] { padding: var(--space-2) var(--space-3); }
  & [data-learn="wizard"] h3 { margin-bottom: 0; }
  & [data-learn="wizard"] h3 ~ div > span:first-child { width: 52px; }
  & [data-learn="wizard"] > div:nth-child(2) > div:first-child { padding: var(--space-3); }
`
// Opened (what `+ → matrix…` / `table…` does), and shut again when the stage is made anew (a module store outlives it).
export const openWizard = (which: 'matrix' | 'table'): Action =>
  run(() => {
    useMatrixUi.setState({ wizard: which === 'matrix' })
    useTableUi.setState({ wizard: which === 'table' })
  }, `${which} wizard open`)

// ——— the matrix in focus ———

export const MATRIX = P.matrix
export const matrixPiece = base.pieces.find((p) => p.id === MATRIX)!
export const matrixRoute = `/workspaces/${base.wid}?focus=${MATRIX}`
// Pazar with its matrix's setup changed (fewer columns, criteria unfolding, …).
export const withMatrix = (change: (m: MatrixSetup) => MatrixSetup, cells: Cell[] = base.cells) => ({
  ...base,
  pieces: base.pieces.map((p): WithId<Piece> => (p.id === MATRIX ? { ...p, matrix: change(p.matrix as MatrixSetup) } : p)),
  cells,
})
// A cell written (the demo refuses the write; what it would have made, at once).
export const cellSet = (matrixId: string, row: string, col: string, fields: Partial<Cell>): Action => ({
  what: `cell ${row} × ${col}`,
  ms: 0,
  start: (c: Ctx) => {
    const ws = c.store.get()
    const old = ws.cells.find((x) => x.matrixId === matrixId && x.row === row && x.col === col)
    const next: Cell = { ...(old ?? { matrixId, row, col, updatedAt: 0 }), ...fields, updatedAt: (old?.updatedAt ?? 0) + 1 }
    for (const k of Object.keys(fields) as (keyof Cell)[]) if (fields[k] === undefined) delete next[k]
    c.store.set({ ...ws, cells: [...ws.cells.filter((x) => x !== old), next] })
    c.store.tell()
  },
})
// A piece's setup changed (the demo refuses the write).
export const pieceSet = (id: string, change: (p: WithId<Piece>) => WithId<Piece>, what = `piece ${id} changed`): Action => ({
  what,
  ms: 0,
  start: (c: Ctx) => {
    const ws = c.store.get()
    c.store.set({ ...ws, pieces: ws.pieces.map((p) => (p.id === id ? change(p) : p)) })
    c.store.tell()
  },
})

// `→` / `←` pressed, its chip shown (the director's keys know `↑` `↓` but not these: the real key sent by its name,
// then the chip; the chip's own key event, `→`, means nothing to the app).
export const arrow = (dir: '→' | '←'): Action => {
  const real = key(dir === '→' ? 'ArrowRight' : 'ArrowLeft', 0)
  const chip = key(dir, CHIP_MS)
  return { what: `key ${dir}`, ms: 0, start: (c) => (real.start?.(c), chip.start?.(c)) }
}

// ——— the focused piece's view, gliding ———
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const glide = (what: string, ms: number, aim: () => { zoom: number; ox: number; oy: number } | null): Action => {
  let from = { zoom: 1, ox: 0, oy: 0 }
  let to = from
  return {
    what,
    ms,
    start: () => {
      from = useCanvasView.getState().planeCam ?? from
      to = aim() ?? from
    },
    frame: (_c, k) => {
      const e = isReducedMotion() ? 1 : ease(k)
      useCanvasView.setState({ planeCam: { zoom: from.zoom + (to.zoom - from.zoom) * e, ox: from.ox + (to.ox - from.ox) * e, oy: from.oy + (to.oy - from.oy) * e } })
    },
  }
}
// To a view put exactly (plane px 0 at ox, oy on the stage, at `zoom`), eased both ends: a gentle camera move.
export const glideTo = (zoom: number, ox: number, oy: number, ms: number): Action => glide('focus view glides', ms, () => ({ zoom, ox, oy }))
// The view gliding, its zoom kept, until what `selector` names sits at (x, y) on the stage (its right edge, when `right`).
export const glideToShow = (selector: string, x: number, y: number, ms: number, right = false): Action =>
  glide(`focus view glides to ${selector}`, ms, () => {
    const v = useCanvasView.getState().planeCam
    const el = [...document.querySelectorAll(selector)].at(-1)
    if (!v || !el) return null
    const r = el.getBoundingClientRect()
    const scale = (document.querySelector('[data-scene]') as HTMLElement | null)?.getBoundingClientRect().width ?? 0
    const k = scale ? scale / (document.querySelector('[data-scene]') as HTMLElement).offsetWidth : 1
    return { ...v, ox: v.ox + x - (right ? r.right : r.left) / k, oy: v.oy + y - r.top / k }
  })
