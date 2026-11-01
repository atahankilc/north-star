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
