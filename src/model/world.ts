// The world's geometry (D-325): sizes in canvas px that TS measures with (layout, boxes, what fits) and CSS draws with.
// One source: TS reads these numbers; CSS reads them as the --w-* custom properties below, written on <html> once when
// this module first loads in a browser (every entry imports it through grid.ts). Change a size here, never in a CSS file.
export const WORLD = {
  grid: 25, // the canvas's grid: snapping, a plane's `+` marks (D-182)
  cardPad: 7, // a card's padding
  cardEdge: 4, // a card's type edge on its left
  chipGap: 5, // between a card's tag chips
  rowPart: 15, // a part's row in a folded feature, a package member's row
  rowFeature: 21, // a competitor feature's small card (18 + 3 apart)
  rowCategory: 13, // a category's name over its features
  stickyH: 125, // a sticky note's height to start, and folded (D-257)
  docPad: 36, // a document piece's text margins
}

const VARS: Record<keyof typeof WORLD, string> = {
  grid: '--w-grid',
  cardPad: '--w-card-pad',
  cardEdge: '--w-card-edge',
  chipGap: '--w-chip-gap',
  rowPart: '--w-row-part',
  rowFeature: '--w-row-feature',
  rowCategory: '--w-row-category',
  stickyH: '--w-sticky-h',
  docPad: '--w-doc-pad',
}

export function writeWorldCss(root: HTMLElement) {
  for (const k of Object.keys(WORLD) as (keyof typeof WORLD)[]) root.style.setProperty(VARS[k], `${WORLD[k]}px`)
}

if (typeof document !== 'undefined') writeWorldCss(document.documentElement)

// Pieces' own geometry, in their px (D-325): TS lays them out with these; their CSS reads the ones it needs as variables
// set on the piece (--col, --head, --bar, --left…). Re-exported where they were (K, M, T, D) under the same names.

// A deck (Kanban.tsx `K`): a column's width and the gap between, its head, the gap under a task, the `+ column` head's
// width; what an unmeasured task is guessed at (a line of title, its meta line, its padding), the SOON band.
export const DECK = { col: 256, gap: 28, head: 32, cardGap: 8, add: 120, line: 18, meta: 26, pad: 22, soon: 40 }
// A matrix (Matrix.tsx `M`): the row heads' column, a cell, the column heads' row, a row, the gap between them, the end
// totals' column and row.
export const MATRIX = { head: 220, cell: 104, top: 72, row: 44, gap: 6, end: 120, endRow: 36 }
// A timeline (Timeline.tsx `T`): the rows' names, the overview, the days' head, a task, the gap between, a row's padding,
// the tray; how many days a pane beside a deck showed before the strip (kept for the tasks side view's call).
export const STRIP = { left: 150, over: 34, head: 44, bar: 30, gap: 6, pad: 10, tray: 56, besideDays: 7 }
// A documents list (Documents.tsx `D`): the table's head and rows, the shelf's sheets.
export const DOCS = { head: 40, row: 54, pad: 16, sheet: { w: 140, h: 186, gap: 16, cols: 5 } }
// The project title (titleLayout.ts `T`), top to bottom: the caption (the north star and PROJECT), the name, the rule,
// what it's building; the caption's text starts two stars and kickGap in.
export const TITLE = { pad: 44, caption: 18, name: 92, nameLead: 1, desc: 26, descLead: 1.5, gap: 27, rule: 4, star: 15, arm: 48, stroke: 3, kickGap: 13 }
