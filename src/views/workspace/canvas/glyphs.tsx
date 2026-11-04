// Each thing's glyph, the same wherever it's listed: the side nav's `+`, go to and the finder (D-196, D-222, D-236).
import type { ReactNode } from 'react'
import type { PieceKind } from '../../../data/model'

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

// A piece's own small picture (D-365), drawn since the font's `▦ ▥ ▤` read as one when small: 1em square, as Page is.
function Drawn({ children }: { children: ReactNode }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" style={{ verticalAlign: '-0.125em' }} aria-hidden>
      {children}
    </svg>
  )
}

export const PIECE_GLYPH: Record<PieceKind, ReactNode> = {
  // Two cards and a link.
  plane: (
    <Drawn>
      <path d="M1.5 2.5h8v5h-8z M8.5 10.5h8v5h-8z M6 7.5l5 3" />
    </Drawn>
  ),
  // A grid with a cell filled.
  matrix: (
    <Drawn>
      <path d="M2 2h14v14H2z M2 6.7h14 M2 11.3h14 M6.7 2v14 M11.3 2v14" />
      <path d="M6.7 6.7h4.6v4.6H6.7z" fill="currentColor" stroke="none" />
    </Drawn>
  ),
  // A head and rows.
  table: (
    <Drawn>
      <path d="M2 3h14v3H2z" fill="currentColor" stroke="none" />
      <path d="M2 9h14 M2 12h14 M2 15h14" />
    </Drawn>
  ),
  documents: <Page behind />,
  document: <Page />,
  // A kanban (D-251): columns side by side.
  kanban: (
    <Drawn>
      <path d="M2 2.5h3.6v13H2z M7.2 2.5h3.6v8H7.2z M12.4 2.5H16V13h-3.6z" />
    </Drawn>
  ),
  // A timeline (D-262): tasks along the days.
  timeline: (
    <Drawn>
      <path d="M2 2v14" />
      <path d="M4 3h7v3H4z M7 8h8v3H7z M4.5 13h5v2.6h-5z" fill="currentColor" stroke="none" />
    </Drawn>
  ),
}
export const TEXT_GLYPH = { heading: 'T', paragraph: '¶', sticky: '▤', section: '⬚', title: '✦' } as const
