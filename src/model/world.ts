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
