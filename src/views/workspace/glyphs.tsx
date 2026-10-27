// Each thing's glyph, the same wherever it's listed: the side nav's `+`, go to and the finder (D-196, D-222, D-236).
import type { ReactNode } from 'react'
import type { PieceKind } from '../../data/model'

// No font has a page that reads as one (🗎 is missing, ⎘ too small, ▯ an empty box), so documents are drawn, like the
// side nav's `+`: a page with a folded corner and lines of text; the list, the same page with another one behind it.
// 1em square in the text's colour, a hairline like the font's box glyphs.
function Page({ behind }: { behind?: boolean }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" style={{ verticalAlign: '-0.175em' }}>
      {behind ? (
        <>
          <path d="M2 12V1h7" />
          <path d="M4.5 3.5h6l3 3V15h-9z M10.5 3.5v3h3 M6.5 9.5h5 M6.5 12h3.5" />
        </>
      ) : (
        <path d="M3 1.5h6.5l3.5 3.5v9.5H3z M9.5 1.5V5H13 M5.5 8h5 M5.5 10.5h5 M5.5 13h3" />
      )}
    </svg>
  )
}

export const PIECE_GLYPH: Record<PieceKind, ReactNode> = {
  plane: '▦',
  matrix: '⊞',
  table: '☰',
  documents: <Page behind />,
  document: <Page />,
  // A kanban (D-251): columns side by side.
  kanban: '▥',
  // A timeline (D-262): days in a row.
  timeline: '▤',
}
export const TEXT_GLYPH = { heading: 'T', paragraph: '¶', sticky: '▤', section: '⬚', title: '✦' } as const
