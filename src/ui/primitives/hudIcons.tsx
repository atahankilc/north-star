// The HUD's icons (D-343): every ToolButton's glyph, drawn alike on one 18-unit grid with 1.5 strokes and square ends,
// so the side nav and the corner read as one set. ToolButton sizes them (`--tool-icon`); none sets its own size. Before,
// each was drawn where it was used: 18, 20 and 16 units, strokes 1.2–1.6, and the gear a text glyph (smaller).
// A new HUD tool draws its icon here.

import type { ReactNode } from 'react'

const S = 1.5

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth={S} strokeLinecap="square">
      {children}
    </svg>
  )
}

// Fit: four corners round a square.
export const FitIcon = () => (
  <Icon>
    <path d="M1.75 6V1.75H6M12 1.75h4.25V6M16.25 12v4.25H12M6 16.25H1.75V12" />
    <rect x="6.25" y="6.25" width="5.5" height="5.5" strokeWidth="1" />
  </Icon>
)

// Find and go to: a compass, its needle to the north.
export const CompassIcon = () => (
  <Icon>
    <circle cx="9" cy="9" r="7.25" />
    <path d="M9 3.5 11 9H7z" fill="currentColor" stroke="none" />
    <path d="M7 9h4l-2 5.5z" strokeWidth="1" strokeLinejoin="round" />
  </Icon>
)

// The guide: a question mark.
export const GuideIcon = () => (
  <Icon>
    <path d="M5.75 6.25a3.25 3.25 0 1 1 4.9 2.8c-.95.55-1.65 1.2-1.65 2.3v.9" />
    <rect x="8.25" y="14.25" width="1.5" height="1.5" fill="currentColor" stroke="none" />
  </Icon>
)

// Decks and their days: a deck's columns over a bar of days.
export const DeckIcon = () => (
  <Icon>
    <path d="M1.75 1.75h3.5v8.5h-3.5zM7.25 1.75h3.5v6h-3.5zM12.75 1.75h3.5v10h-3.5z" />
    <path d="M1.75 15.25h14.5M5 13.5v3.5M13 13.5v3.5" />
  </Icon>
)

// A folder (D-415): its tab on the left, its body under it.
export const FolderIcon = () => (
  <Icon>
    <path d="M1.75 3.75h5l1.5 1.75h8v9.75H1.75z" />
  </Icon>
)

// Docs (D-412): a sheet with its corner folded, two lines of text on it.
export const DocsIcon = () => (
  <Icon>
    <path d="M3.75 1.75h7l3.5 3.5v11h-10.5z" />
    <path d="M10.75 1.75v3.5h3.5M6.5 9h5M6.5 12h5" />
  </Icon>
)

// Threads: the comment mark (Threads.tsx's CommentIcon, on this grid).
export const ThreadsIcon = () => (
  <Icon>
    <path d="M1.75 2.75h14.5v10h-8.5l-4 3.5v-3.5h-2z" strokeLinecap="butt" />
    <rect x="4.5" y="7" width="2" height="2" fill="currentColor" stroke="none" />
    <rect x="8" y="7" width="2" height="2" fill="currentColor" stroke="none" />
    <rect x="11.5" y="7" width="2" height="2" fill="currentColor" stroke="none" />
  </Icon>
)

// Settings: a gear, eight teeth round a ring.
const TEETH = [0, 45, 90, 135, 180, 225, 270, 315]
export const GearIcon = () => (
  <Icon>
    <circle cx="9" cy="9" r="4.75" />
    <circle cx="9" cy="9" r="1.75" />
    {TEETH.map((a) => (
      <path key={a} d="M9 1.5v2.75" strokeWidth="2.25" strokeLinecap="butt" transform={`rotate(${a} 9 9)`} />
    ))}
  </Icon>
)

// ── A Button's glyphs (D-384) ──
// What an `icon` Button holds when it holds a symbol: drawn, never typed. Typed, each came from whatever font had it
// (`×` and `‹` JetBrains Mono's, `✎` `⌫` `⋯` a system font's), so every one was its own size and weight and sat at its
// own height. Here they share one 12-unit box, the same ink (about 7 units across, in the middle), 1.25 strokes with
// round ends, as the round controls have. Button sizes them at 1.25em (15 px at its text, growing with a console's),
// so their ink is as tall as a capital letter beside them and their stroke as heavy as the text's.
// Letters stay letters (`B`, `H1`, `100%`). A new symbol on a button is drawn here.
const G = 1.25
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth={G} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}
const path = (d: string) => () => (
  <Glyph>
    <path d={d} />
  </Glyph>
)

// Close, take away.
export const CloseIcon = path('M2.75 2.75l6.5 6.5M9.25 2.75l-6.5 6.5')
// Before and after: a page, a week, a column's place.
export const PrevIcon = path('M7.5 2.5 4 6l3.5 3.5')
export const NextIcon = path('M4.5 2.5 8 6 4.5 9.5')
// A zoom's steps, an add.
export const MinusIcon = path('M2.5 6h7')
export const PlusIcon = path('M2.5 6h7M6 2.5v7')
// Finished, done.
export const CheckIcon = path('M2.5 6.5 5 9l4.5-6')
// At most: a column's limit.
export const LimitIcon = path('M8.5 2.25 3.5 4.75l5 2.5M3.5 9.75h5')
// Rename: a pencil.
export const EditIcon = path('M2.5 9.5l.55-2.35 5.1-5.1 1.8 1.8-5.1 5.1zM6.9 3.3l1.8 1.8')
// Write in it: a pilcrow.
export const WriteIcon = path('M9.5 2.5H5.5a2.25 2.25 0 0 0 0 4.5h1.25M6.75 2.5v7.25M8.75 2.5v7.25')
// Put it somewhere, go there.
export const PlaceIcon = path('M3 9l5.75-5.75M4.5 3.25h4.25V7.5')
// Download.
export const DownloadIcon = path('M6 2.25v5M3.5 5.25 6 7.75l2.5-2.5M2.75 9.75h6.5')
// Delete: a bin.
export const BinIcon = path('M2.5 3.75h7M4.75 3.75V2.5h2.5v1.25M3.5 3.75l.45 5.75h4.1l.45-5.75')
// A quarter turn either way.
export const TurnLeftIcon = path('M3 6.5a3.25 3.25 0 1 0 1-2.75L2.75 5M2.75 2.5V5h2.5')
export const TurnRightIcon = path('M9 6.5a3.25 3.25 0 1 1-1-2.75L9.25 5M9.25 2.5V5h-2.5')
// More: three dots.
export const MoreIcon = () => (
  <Glyph>
    <path d="M2.5 6h.01M6 6h.01M9.5 6h.01" strokeWidth="1.75" />
  </Glyph>
)
// Shared or only yours: a disc, half filled.
export const ShareIcon = () => (
  <Glyph>
    <circle cx="6" cy="6" r="3.5" />
    <path d="M6 2.5a3.5 3.5 0 0 0 0 7z" fill="currentColor" stroke="none" />
  </Glyph>
)
